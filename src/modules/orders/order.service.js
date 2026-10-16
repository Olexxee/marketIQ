import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import {
  releaseReservationForOrderItem,
} from "../inventory/inventory.ledger.js";
import { publishEvent } from "../events/event.publisher.js";
import { EVENT_TYPES } from "../events/event.types.js";
import {
  countBuyerOrders,
  countSellerOrders,
  findBuyerOrderById,
  findBuyerOrders,
  findOrderById,
  findOrderItems,
  findSellerOrderById,
  findSellerOrders,
  findSellerOrdersByOrderId,
  completeDeliveredSellerOrders,
  updateSellerOrderStatus,
  withTransaction,
} from "./order.db.js";
import { recalculateOrderStatus } from "./order.status.service.js";
import { areSellerOrdersResolved } from "./order.completion-policy.js";

// ============================================================
// STATE MACHINE (seller-driven)
// ============================================================

const SELLER_TRANSITIONS = {
  PENDING: ["CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  COMPLETED: [],
  CANCELLED: [],
};

const lockSort = (items) =>
  [...items].sort((a, b) =>
    String(a.inventoryId || "").localeCompare(String(b.inventoryId || "")),
  );

// ============================================================
// BUYER READS
// ============================================================

export const listBuyerOrdersService = async (userId, filters = {}) => {
  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findBuyerOrders({ buyerId: userId, status: filters.status, skip, take }),
    countBuyerOrders({ buyerId: userId, status: filters.status }),
  ]);

  return { items, total, page, limit };
};

export const getBuyerOrderService = async (userId, orderId) => {
  const order = await findBuyerOrderById(orderId, userId);

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return order;
};

// ============================================================
// BUYER CANCEL
// ============================================================

export const cancelBuyerOrderService = async (userId, orderId, notes) => {
  return withTransaction(async (tx) => {
    const order = await findOrderById(orderId, tx);

    if (!order || order.buyerId !== userId) {
      throw new NotFoundError("Order not found");
    }

    if (order.status === "CANCELLED") {
      throw new ConflictError("Order is already cancelled");
    }

    if (order.paymentStatus === "SUCCESS") {
      throw new ConflictError(
        "Paid orders cannot be cancelled through this endpoint",
      );
    }

    if (order.status === "DELIVERED" || order.status === "COMPLETED") {
      throw new ConflictError("Order cannot be cancelled in its current state");
    }

    const items = await findOrderItems(orderId, tx);

    for (const item of lockSort(items)) {
      await releaseReservationForOrderItem(item, tx);
    }

    await updateManySellerOrderStatus(orderId, "CANCELLED", tx);

    if (notes) {
      await tx.order.update({
        where: { id: orderId },
        data: { notes: order.notes ? `${order.notes}\n${notes}` : notes },
      });
    }

       await recalculateOrderStatus(orderId, tx);

       
       await publishEvent(
         {
           eventType: EVENT_TYPES.ORDER_CANCELLED,
           aggregateType: "ORDER",
           aggregateId: orderId,
           payload: {
             orderId,
             userId,
             reason: notes || "Buyer cancelled",
           },
         },
         tx,
       );

       return findBuyerOrderById(orderId, userId, tx);
  });
};

// ============================================================
// BUYER CONFIRM
// ============================================================

export const confirmBuyerOrderService = async (userId, orderId) => {
  return withTransaction(async (tx) => {
    const order = await findOrderById(orderId, tx);

    if (!order || order.buyerId !== userId) {
      throw new NotFoundError("Order not found");
    }

    if (order.disputedAt) {
      throw new ConflictError("This order is disputed and cannot be completed");
    }

    if (order.status === "COMPLETED") {
      return findBuyerOrderById(orderId, userId, tx);
    }

    const sellerOrders = await findSellerOrdersByOrderId(orderId, tx);

    if (!sellerOrders.length) {
      throw new ConflictError("Order has no seller orders");
    }

    const allResolved = areSellerOrdersResolved(sellerOrders);

    if (!allResolved) {
      throw new ConflictError(
        "All seller orders must be delivered before confirmation",
      );
    }

    if (order.status !== "DELIVERED") {
      throw new ConflictError("Order must be delivered before confirmation");
    }

    const completionClaim = await tx.order.updateMany({
      where: { id: orderId, status: "DELIVERED", disputedAt: null },
      data: { completionDueAt: null },
    });
    if (completionClaim.count !== 1) {
      throw new ConflictError("Order state changed before receipt confirmation");
    }

    await completeDeliveredSellerOrders(orderId, tx);
    await recalculateOrderStatus(orderId, tx);

    await publishEvent(
      {
        eventType: EVENT_TYPES.ORDER_COMPLETED,
        aggregateType: "ORDER",
        aggregateId: orderId,
        payload: { orderId, completedBy: "BUYER" },
      },
      tx,
    );

    return findBuyerOrderById(orderId, userId, tx);
  });
};

export const disputeBuyerOrderService = async (userId, orderId, notes) => {
  return withTransaction(async (tx) => {
    const order = await findOrderById(orderId, tx);

    if (!order || order.buyerId !== userId) {
      throw new NotFoundError("Order not found");
    }

    if (order.status !== "DELIVERED") {
      throw new ConflictError("Only delivered orders can be disputed");
    }

    if (order.disputedAt) {
      throw new ConflictError("This order is already disputed");
    }

    const disputedAt = new Date();
    const disputed = await tx.order.updateMany({
      where: { id: orderId, status: "DELIVERED", disputedAt: null },
      data: { disputedAt, disputeNotes: notes, completionDueAt: null },
    });

    if (disputed.count !== 1) {
      throw new ConflictError("Order state changed before the dispute could be recorded");
    }

    const dispute = await tx.dispute.create({
      data: { orderId, openedById: userId, reason: notes, status: "OPEN" },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "ORDER_DISPUTED",
        resource: "Dispute",
        resourceId: dispute.id,
        metadata: { orderId, status: "OPEN" },
      },
    });

    await publishEvent({
      eventType: EVENT_TYPES.DISPUTE_OPENED,
      aggregateType: "DISPUTE",
      aggregateId: dispute.id,
      payload: { disputeId: dispute.id, orderId, openedById: userId },
    }, tx);

    return findBuyerOrderById(orderId, userId, tx);
  });
};

// ============================================================
// DISPUTE EVIDENCE
// ============================================================

const ACTIVE_DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW"];

const createDisputeEvidence = async (tx, dispute, actorId, payload) => {
  await tx.$queryRaw`SELECT id FROM "Dispute" WHERE id = ${dispute.id} AND status IN ('OPEN', 'UNDER_REVIEW') FOR UPDATE`;
  const currentDispute = await tx.dispute.findUnique({ where: { id: dispute.id } });
  if (!currentDispute || !ACTIVE_DISPUTE_STATUSES.includes(currentDispute.status)) {
    throw new ConflictError("Dispute is no longer accepting evidence");
  }

  const evidence = await tx.disputeEvidence.create({
    data: {
      disputeId: dispute.id,
      submittedById: actorId,
      type: payload.type,
      description: payload.description,
      url: payload.url ?? null,
    },
  });

  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: "DISPUTE_EVIDENCE_SUBMITTED",
      resource: "DisputeEvidence",
      resourceId: evidence.id,
      metadata: {
        disputeId: dispute.id,
        orderId: dispute.orderId,
        type: payload.type,
        hasUrl: Boolean(payload.url),
      },
    },
  });

  return tx.disputeEvidence.findUnique({
    where: { id: evidence.id },
    include: {
      submittedBy: { select: { id: true, fullName: true } },
    },
  });
};

export const submitBuyerDisputeEvidenceService = async (userId, orderId, payload) => {
  return withTransaction(async (tx) => {
    const order = await findOrderById(orderId, tx);
    if (!order || order.buyerId !== userId) {
      throw new NotFoundError("Order not found");
    }

    const dispute = await tx.dispute.findFirst({
      where: { orderId, status: { in: ACTIVE_DISPUTE_STATUSES } },
      orderBy: { createdAt: "desc" },
    });
    if (!dispute) {
      throw new ConflictError("There is no open dispute for this order");
    }

    return createDisputeEvidence(tx, dispute, userId, payload);
  });
};

export const submitSellerDisputeEvidenceService = async (
  actorId,
  sellerId,
  sellerOrderId,
  payload,
) => {
  return withTransaction(async (tx) => {
    const sellerOrder = await findSellerOrderById(sellerOrderId, sellerId, tx);
    if (!sellerOrder) {
      throw new NotFoundError("Seller order not found");
    }

    const dispute = await tx.dispute.findFirst({
      where: {
        orderId: sellerOrder.orderId,
        status: { in: ACTIVE_DISPUTE_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!dispute) {
      throw new ConflictError("There is no open dispute for this order");
    }

    return createDisputeEvidence(tx, dispute, actorId, payload);
  });
};


// ============================================================
// SELLER READS
// ============================================================

export const listSellerOrdersService = async (sellerId, filters = {}) => {
  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findSellerOrders({ sellerId, status: filters.status, skip, take }),
    countSellerOrders({ sellerId, status: filters.status }),
  ]);

  return { items, total, page, limit };
};

export const getSellerOrderService = async (sellerId, id) => {
  const sellerOrder = await findSellerOrderById(id, sellerId);

  if (!sellerOrder) {
    throw new NotFoundError("Seller order not found");
  }

  return sellerOrder;
};

// ============================================================
// SELLER STATUS UPDATE
// ============================================================

export const updateSellerOrderStatusService = async (
  sellerId,
  id,
  nextStatus,
) => {
  return withTransaction(async (tx) => {
    const sellerOrder = await findSellerOrderById(id, sellerId, tx);

    if (!sellerOrder) {
      throw new NotFoundError("Seller order not found");
    }

    if (nextStatus === "DELIVERED") {
      throw new ConflictError(
        "Report delivery through the fulfillment endpoint; sellers cannot directly mark orders delivered",
      );
    }

    const allowed = SELLER_TRANSITIONS[sellerOrder.status] || [];

    if (!allowed.includes(nextStatus)) {
      throw new ConflictError(
        `Cannot move seller order from ${sellerOrder.status} to ${nextStatus}`,
      );
    }

    if (nextStatus === "CANCELLED") {
      const order = await findOrderById(sellerOrder.orderId, tx);

      if (order?.paymentStatus === "SUCCESS") {
        throw new ConflictError(
          "Paid orders cannot be cancelled by the seller. Refund flow required.",
        );
      }
      
      const items = await findOrderItems(sellerOrder.orderId, tx);
      const sellerItems = items.filter((i) => i.sellerOrderId === id);

      for (const item of lockSort(sellerItems)) {
        await releaseReservationForOrderItem(item, tx);
      }
    }

    await updateSellerOrderStatus(id, nextStatus, tx);
    await recalculateOrderStatus(sellerOrder.orderId, tx);

    return findSellerOrderById(id, sellerId, tx);
  });
};
