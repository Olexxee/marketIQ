import prisma from "../../config/prisma.js";

const REVIEW_WINDOW_MS = 4 * 60 * 60 * 1000;
const EVIDENCE_DEADLINE_MS = 24 * 60 * 60 * 1000;

const notifyOperationsOfOverdueEvidence = async (tx, { reviewId, sellerOrderId, shipmentId }) => {
  const admins = await tx.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  if (!admins.length) return;
  await tx.notification.createMany({
    data: admins.map(admin => ({
      userId: admin.id,
      type: "PACKING_EVIDENCE_OVERDUE",
      title: "Packing evidence deadline missed",
      message: "A paid shipment has not received all four required packing photos within 24 hours. Dispatch remains blocked and operations review is required.",
      data: { shipmentReviewId: reviewId, sellerOrderId, shipmentId },
    })),
  });
};

export const ensureShipmentReviewForBookedShipment = async sellerOrderId => {
  const shipment = await prisma.logisticsShipment.findUnique({
    where: { sellerOrderId },
    select: {
      id: true,
      bookedAt: true,
      sellerOrder: { select: { id: true, order: { select: { buyerId: true } } } },
    },
  });
  if (!shipment?.bookedAt || !shipment.sellerOrder?.order?.buyerId) {
    throw new Error("A booked shipment and buyer are required to initialize its packing review.");
  }
  const evidenceDeadlineAt = new Date(shipment.bookedAt.getTime() + EVIDENCE_DEADLINE_MS);
  return prisma.shipmentReview.upsert({
    where: { sellerOrderId },
    create: {
      sellerOrderId,
      shipmentId: shipment.id,
      buyerId: shipment.sellerOrder.order.buyerId,
      evidenceDeadlineAt,
    },
    update: {},
  });
};

export const startPackingReview = async ({ sellerOrderId, shipmentId, buyerId, now = new Date() }) =>
  prisma.$transaction(async tx => {
    const review = await tx.shipmentReview.findUnique({ where: { sellerOrderId } });
    if (!review || review.shipmentId !== shipmentId || review.buyerId !== buyerId) {
      throw new Error("The packing review does not match its shipment or buyer.");
    }
    if (review.status !== "WAITING_FOR_EVIDENCE") return review;
    if (review.evidenceDeadlineAt <= now) {
      const changed = await tx.shipmentReview.updateMany({
        where: { id: review.id, status: "WAITING_FOR_EVIDENCE" },
        data: { status: "EVIDENCE_OVERDUE" },
      });
      if (changed.count === 1) {
        await notifyOperationsOfOverdueEvidence(tx, { reviewId: review.id, sellerOrderId, shipmentId });
      }
      return tx.shipmentReview.findUnique({ where: { id: review.id } });
    }
    const reviewExpiresAt = new Date(now.getTime() + REVIEW_WINDOW_MS);
    const changed = await tx.shipmentReview.updateMany({
      where: { id: review.id, status: "WAITING_FOR_EVIDENCE" },
      data: {
        status: "PENDING_BUYER_REVIEW",
        evidenceCompletedAt: now,
        reviewStartedAt: now,
        reviewExpiresAt,
      },
    });
    if (changed.count === 1) {
      await tx.notification.create({
        data: {
          userId: buyerId,
          type: "PACKING_REVIEW_STARTED",
          title: "Your order is ready for review",
          message: "The seller has submitted all four packing photos. Review the parcel within four hours; dispatch will be authorized automatically when the review window expires.",
          data: { sellerOrderId, shipmentReviewId: review.id, reviewExpiresAt: reviewExpiresAt.toISOString() },
        },
      });
    }
    return tx.shipmentReview.findUnique({ where: { id: review.id } });
  });

export const findBuyerPackingReview = (sellerOrderId, buyerId) =>
  prisma.shipmentReview.findFirst({
    where: { sellerOrderId, buyerId },
    select: {
      id: true,
      sellerOrderId: true,
      status: true,
      policyVersion: true,
      evidenceDeadlineAt: true,
      evidenceCompletedAt: true,
      reviewStartedAt: true,
      reviewExpiresAt: true,
      buyerApprovedAt: true,
      dispatchAuthorizedAt: true,
      cancellationRequestedAt: true,
      cancellationReason: true,
      returnRequestedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const approveBuyerPackingReview = ({ buyerId, sellerOrderId, now }) =>
  prisma.$transaction(async tx => {
    const review = await tx.shipmentReview.findFirst({
      where: { sellerOrderId, buyerId },
      select: { id: true, status: true, reviewExpiresAt: true, shipment: { select: { externalReference: true } } },
    });
    if (!review) return { notFound: true };
    if (review.status === "APPROVED" || review.status === "AUTO_AUTHORIZED") {
      return { review: await tx.shipmentReview.findUnique({ where: { id: review.id } }), replay: true };
    }
    if (review.status !== "PENDING_BUYER_REVIEW") return { blocker: true };
    if (!review.reviewExpiresAt || review.reviewExpiresAt <= now) return { expired: true };
    const changed = await tx.shipmentReview.updateMany({
      where: { id: review.id, status: "PENDING_BUYER_REVIEW", reviewExpiresAt: { gt: now } },
      data: { status: "APPROVED", buyerApprovedAt: now },
    });
    if (changed.count !== 1) return { blocker: true };
    await tx.outboxEvent.create({
      data: {
        eventType: "LOGISTICS_DISPATCH_RELEASE_REQUESTED",
        aggregateType: "SHIPMENT_REVIEW",
        aggregateId: review.id,
        dedupeKey: `li02gb-dispatch-release:${review.id}:buyer-approved`,
        payload: {
          shipmentReviewId: review.id,
          sellerOrderId,
          externalReference: review.shipment.externalReference,
          reason: "BUYER_APPROVED",
        },
      },
    });
    return { review: await tx.shipmentReview.findUnique({ where: { id: review.id } }), replay: false };
  });
