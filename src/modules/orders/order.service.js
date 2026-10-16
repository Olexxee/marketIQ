import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import {
  releaseReservationForOrderItem,
  commitSaleForOrderItem,
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
  updateManySellerOrderStatus,
  updateSellerOrderStatus,
  withTransaction,
} from "./order.db.js";
import { recalculateOrderStatus } from "./order.status.service.js";

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

    const allResolved = sellerOrders.every(
      (so) => so.status === "DELIVERED" || so.status === "COMPLETED",
    );

    if (!allResolved) {
      throw new ConflictError(
        "All seller orders must be delivered before confirmation",
      );
    }

    if (order.status !== "DELIVERED") {
      throw new ConflictError("Order must be delivered before confirmation");
    }

    await updateManySellerOrderStatus(orderId, "COMPLETED", tx);
    await tx.order.update({
      where: { id: orderId },
      data: { completionDueAt: null },
    });
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

    await tx.order.update({
      where: { id: orderId },
      data: {
        disputedAt: new Date(),
        disputeNotes: notes,
        completionDueAt: null,
      },
    });

    return findBuyerOrderById(orderId, userId, tx);
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
      
      if (nextStatus === "DELIVERED") {
        const items = await findOrderItems(sellerOrder.orderId, tx);
        const sellerItems = items.filter((i) => i.sellerOrderId === id);

        for (const item of lockSort(sellerItems)) {
          await commitSaleForOrderItem(item, tx);
        }
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
