import prisma from "../../config/prisma.js";
import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import { publishEvent } from "../events/event.publisher.js";
import { EVENT_TYPES } from "../events/event.types.js";
import { requestRefundService } from "../payments/payment.service.js";

const withTransaction = (callback) => prisma.$transaction(callback, { timeout: 15000 });

export const listDisputesService = async ({ status, page = 1, limit = 20 } = {}) => {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: {
        order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true } },
        openedBy: { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);
  return { items, total, page, limit };
};

export const getDisputeService = async (id) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          buyer: { select: { id: true, fullName: true, email: true } },
          sellerOrders: {
            include: { seller: { select: { id: true, businessName: true } }, items: true, fulfillments: true },
          },
          payments: { select: { id: true, reference: true, status: true, amount: true, currency: true, createdAt: true } },
        },
      },
      openedBy: { select: { id: true, fullName: true, email: true } },
      assignedTo: { select: { id: true, fullName: true, email: true } },
      resolvedBy: { select: { id: true, fullName: true, email: true } },
    },
  });
  if (!dispute) throw new NotFoundError("Dispute not found");
  return dispute;
};

export const reviewDisputeService = async (actorId, disputeId) => {
  return withTransaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundError("Dispute not found");
    if (dispute.status === "UNDER_REVIEW" && dispute.assignedToId === actorId) return dispute;
    if (dispute.status !== "OPEN") {
      throw new ConflictError(`Dispute cannot enter review from status ${dispute.status}`);
    }
    const updated = await tx.dispute.updateMany({
      where: { id: disputeId, status: "OPEN" },
      data: { status: "UNDER_REVIEW", assignedToId: actorId },
    });
    if (updated.count !== 1) throw new ConflictError("Dispute status changed before review could be assigned");
    await tx.auditLog.create({
      data: { userId: actorId, action: "DISPUTE_REVIEW_STARTED", resource: "Dispute", resourceId: disputeId, metadata: { orderId: dispute.orderId } },
    });
    return tx.dispute.findUnique({ where: { id: disputeId } });
  });
};

export const resolveDisputeService = async (actorId, disputeId, { resolution, resolutionNotes, refundAmount }) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new NotFoundError("Dispute not found");
  if (!["OPEN", "UNDER_REVIEW"].includes(dispute.status)) {
    throw new ConflictError(`Dispute cannot be resolved from status ${dispute.status}`);
  }

  if (["REFUND_FULL", "REFUND_PARTIAL"].includes(resolution)) {
    if (dispute.resolution && dispute.resolution !== resolution) {
      throw new ConflictError("A different resolution has already been recorded for this dispute");
    }
    if (resolution === "REFUND_PARTIAL" && !(Number(refundAmount) > 0)) {
      throw new ConflictError("A positive refundAmount is required for a partial refund");
    }

    // Claim the resolution before creating the refund, so a parallel admin
    // cannot close the dispute with a conflicting outcome.
    await withTransaction(async (tx) => {
      const claimed = await tx.dispute.updateMany({
        where: {
          id: disputeId,
          status: { in: ["OPEN", "UNDER_REVIEW"] },
          OR: [{ resolution: null }, { resolution }],
        },
        data: {
          status: "UNDER_REVIEW",
          assignedToId: actorId,
          resolution,
          resolutionNotes: resolutionNotes || null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictError("Dispute has already been resolved or has a different resolution in progress");
      }
      await tx.auditLog.create({
        data: { userId: actorId, action: "DISPUTE_REFUND_DECISION_RECORDED", resource: "Dispute", resourceId: disputeId, metadata: { orderId: dispute.orderId, resolution } },
      });
    });

    const refund = await requestRefundService(actorId, {
      orderId: dispute.orderId,
      amount: resolution === "REFUND_PARTIAL" ? Number(refundAmount) : undefined,
      reason: resolutionNotes || `Refund approved as dispute resolution ${resolution}`,
      idempotencyKey: `dispute-refund:${dispute.id}:${resolution}`,
    });

    return {
      dispute: await prisma.dispute.findUnique({ where: { id: disputeId } }),
      refund,
    };
  }

  return withTransaction(async (tx) => {
    const current = await tx.dispute.findUnique({ where: { id: disputeId } });
    if (!current || !["OPEN", "UNDER_REVIEW"].includes(current.status)) {
      throw new ConflictError("Dispute status changed before resolution");
    }
    const now = new Date();
    const updated = await tx.dispute.updateMany({
      where: { id: disputeId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
      data: {
        status: "RESOLVED",
        assignedToId: actorId,
        resolvedById: actorId,
        resolution,
        resolutionNotes,
        resolvedAt: now,
      },
    });
    if (updated.count !== 1) throw new ConflictError("Dispute status changed before resolution");
    await tx.order.updateMany({
      where: { id: dispute.orderId, status: "DELIVERED" },
      data: { disputedAt: null, disputeNotes: null, completionDueAt: now },
    });
    await tx.auditLog.create({
      data: { userId: actorId, action: "DISPUTE_RESOLVED", resource: "Dispute", resourceId: disputeId, metadata: { orderId: dispute.orderId, resolution } },
    });
    await publishEvent({
      eventType: EVENT_TYPES.DISPUTE_RESOLVED,
      aggregateType: "DISPUTE",
      aggregateId: disputeId,
      payload: { disputeId, orderId: dispute.orderId, resolution, resolvedById: actorId },
    }, tx);
    return tx.dispute.findUnique({ where: { id: disputeId } });
  });
};


// ============================================================
// SELLER SETTLEMENTS (manual payout reconciliation)
// ============================================================

export const listSettlementsService = async ({ status, page = 1, limit = 20 } = {}) => {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.sellerSettlement.findMany({
      where,
      include: {
        sellerOrder: {
          select: {
            id: true,
            status: true,
            total: true,
            seller: { select: { id: true, businessName: true, businessEmail: true, businessPhone: true } },
            order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true, disputedAt: true } },
          },
        },
        requestedBy: { select: { id: true, fullName: true, email: true } },
        processedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sellerSettlement.count({ where }),
  ]);
  return { items, total, page, limit };
};

export const requestSellerSettlementService = async (actorId, sellerOrderId) => {
  return withTransaction(async (tx) => {
    const sellerOrder = await tx.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      include: { order: true, seller: { select: { id: true, businessName: true } } },
    });
    if (!sellerOrder) throw new NotFoundError("Seller order not found");
    if (sellerOrder.status !== "COMPLETED") {
      throw new ConflictError("Seller order must be completed before settlement");
    }
    if (sellerOrder.order.paymentStatus !== "SUCCESS") {
      throw new ConflictError("Parent order does not have a settled successful payment");
    }
    if (sellerOrder.order.disputedAt) {
      throw new ConflictError("A disputed order cannot be settled");
    }

    const refundExposure = await tx.refund.aggregate({
      where: {
        orderId: sellerOrder.orderId,
        status: { in: ["REQUESTED", "APPROVED", "PROCESSING", "SUCCEEDED"] },
      },
      _sum: { amount: true },
    });
    if (Number(refundExposure._sum.amount ?? 0) > 0) {
      throw new ConflictError("Order has refund exposure; finance must reconcile refunds before seller settlement");
    }

    const existing = await tx.sellerSettlement.findUnique({ where: { sellerOrderId } });
    if (existing && existing.status !== "FAILED" && existing.status !== "CANCELLED") {
      return existing;
    }
    if (existing) {
      const reset = await tx.sellerSettlement.updateMany({
        where: { id: existing.id, status: { in: ["FAILED", "CANCELLED"] } },
        data: { status: "REQUESTED", requestedById: actorId, failureReason: null, amount: sellerOrder.total },
      });
      if (reset.count !== 1) throw new ConflictError("Settlement state changed before it could be re-requested");
      await tx.auditLog.create({
        data: { userId: actorId, action: "SELLER_SETTLEMENT_REQUESTED", resource: "SellerSettlement", resourceId: existing.id, metadata: { sellerOrderId, amount: Number(sellerOrder.total), retried: true } },
      });
      return tx.sellerSettlement.findUnique({ where: { id: existing.id } });
    }

    const settlement = await tx.sellerSettlement.create({
      data: {
        sellerOrderId,
        requestedById: actorId,
        amount: sellerOrder.total,
        currency: "NGN",
        status: "REQUESTED",
      },
    });
    await tx.auditLog.create({
      data: { userId: actorId, action: "SELLER_SETTLEMENT_REQUESTED", resource: "SellerSettlement", resourceId: settlement.id, metadata: { sellerOrderId, amount: Number(sellerOrder.total) } },
    });
    return settlement;
  });
};

export const approveSellerSettlementService = async (actorId, settlementId) => {
  return withTransaction(async (tx) => {
    const settlement = await tx.sellerSettlement.findUnique({
      where: { id: settlementId },
      include: { sellerOrder: { include: { order: true } } },
    });
    if (!settlement) throw new NotFoundError("Settlement not found");
    if (settlement.status === "APPROVED") return settlement;
    if (!["REQUESTED", "FAILED"].includes(settlement.status)) {
      throw new ConflictError(`Settlement cannot be approved from status ${settlement.status}`);
    }
    if (settlement.sellerOrder.status !== "COMPLETED" ||
        settlement.sellerOrder.order.paymentStatus !== "SUCCESS" ||
        settlement.sellerOrder.order.disputedAt) {
      throw new ConflictError("Settlement eligibility changed; order must be completed, paid, and undisputed");
    }
    const changed = await tx.sellerSettlement.updateMany({
      where: { id: settlementId, status: settlement.status },
      data: { status: "APPROVED", processedById: actorId, failureReason: null },
    });
    if (changed.count !== 1) throw new ConflictError("Settlement status changed before approval");
    await tx.auditLog.create({
      data: { userId: actorId, action: "SELLER_SETTLEMENT_APPROVED", resource: "SellerSettlement", resourceId: settlementId, metadata: { sellerOrderId: settlement.sellerOrderId, amount: Number(settlement.amount) } },
    });
    return tx.sellerSettlement.findUnique({ where: { id: settlementId } });
  });
};

export const markSellerSettlementPaidService = async (actorId, settlementId, externalReference) => {
  return withTransaction(async (tx) => {
    const settlement = await tx.sellerSettlement.findUnique({
      where: { id: settlementId },
      include: { sellerOrder: { include: { order: true } } },
    });
    if (!settlement) throw new NotFoundError("Settlement not found");
    if (settlement.status === "PAID") return settlement;
    if (settlement.status !== "APPROVED") {
      throw new ConflictError("Only approved settlements can be marked paid");
    }
    if (settlement.sellerOrder.status !== "COMPLETED" ||
        settlement.sellerOrder.order.paymentStatus !== "SUCCESS" ||
        settlement.sellerOrder.order.disputedAt) {
      throw new ConflictError("Settlement eligibility changed before payout confirmation");
    }

    const changed = await tx.sellerSettlement.updateMany({
      where: { id: settlementId, status: "APPROVED" },
      data: { status: "PAID", externalReference, processedById: actorId, paidAt: new Date(), failureReason: null },
    });
    if (changed.count !== 1) throw new ConflictError("Settlement status changed before payout confirmation");

    await tx.ledgerTransaction.create({
      data: {
        type: "SELLER_SETTLEMENT",
        idempotencyKey: `seller-settlement:${settlementId}`,
        reference: `SETTLE-${settlementId}`,
        orderId: settlement.sellerOrder.orderId,
        settlementId,
        amount: settlement.amount,
        currency: settlement.currency,
        metadata: { externalReference, sellerOrderId: settlement.sellerOrderId, processedById: actorId },
        entries: {
          create: [
            { account: "SELLER_PAYABLE", direction: "DEBIT", amount: settlement.amount, currency: settlement.currency, sellerOrderId: settlement.sellerOrderId },
            { account: "PAYMENT_CLEARING", direction: "CREDIT", amount: settlement.amount, currency: settlement.currency },
          ],
        },
      },
    });
    await tx.auditLog.create({
      data: { userId: actorId, action: "SELLER_SETTLEMENT_PAID", resource: "SellerSettlement", resourceId: settlementId, metadata: { sellerOrderId: settlement.sellerOrderId, amount: Number(settlement.amount), externalReference } },
    });
    return tx.sellerSettlement.findUnique({ where: { id: settlementId } });
  });
};
