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

    const refund = await requestRefundService(actorId, {
      orderId: dispute.orderId,
      amount: resolution === "REFUND_PARTIAL" ? Number(refundAmount) : undefined,
      reason: resolutionNotes || `Refund approved as dispute resolution ${resolution}`,
      idempotencyKey: `dispute-refund:${dispute.id}:${resolution}`,
    });

    return withTransaction(async (tx) => {
      const updated = await tx.dispute.updateMany({
        where: { id: disputeId, status: { in: ["OPEN", "UNDER_REVIEW"] } },
        data: {
          status: "UNDER_REVIEW",
          assignedToId: actorId,
          resolution,
          resolutionNotes: resolutionNotes || null,
        },
      });
      if (updated.count !== 1) throw new ConflictError("Dispute changed while the refund request was being created");
      await tx.auditLog.create({
        data: { userId: actorId, action: "DISPUTE_REFUND_REQUESTED", resource: "Dispute", resourceId: disputeId, metadata: { orderId: dispute.orderId, refundId: refund.id, resolution } },
      });
      return { dispute: await tx.dispute.findUnique({ where: { id: disputeId } }), refund };
    });
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
