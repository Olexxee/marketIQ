import prisma from "../../config/prisma.js";

const EVENT_TYPE = "LOGISTICS_SHIPMENT_RESOLUTION_REQUESTED";

export const createBuyerShipmentResolutionRequest = async ({ buyerId, sellerOrderId, reason }) =>
  prisma.$transaction(async tx => {
    const shipment = await tx.logisticsShipment.findFirst({
      where: {
        sellerOrderId,
        provider: { code: "LOGISTIC_HUB", isActive: true },
        sellerOrder: { order: { buyerId, paymentStatus: "SUCCESS" } },
      },
      select: {
        id: true,
        status: true,
        sellerOrderId: true,
        sellerOrder: { select: { id: true } },
        packingReview: { select: { id: true, status: true } },
      },
    });
    if (!shipment || shipment.status !== "BOOKED") return { notFound: true };

    const existing = await tx.shipmentResolutionRequest.findUnique({
      where: { shipmentId: shipment.id },
    });
    if (existing) return { request: existing, replay: true };

    if (shipment.packingReview && ["CLOSED", "CANCELLATION_CONFIRMED", "RETURN_REQUESTED"].includes(shipment.packingReview.status)) {
      return { conflict: true };
    }

    const request = await tx.shipmentResolutionRequest.create({
      data: {
        sellerOrderId,
        shipmentId: shipment.id,
        buyerId,
        reason,
        status: "COMMAND_PENDING",
      },
    });

    if (shipment.packingReview) {
      await tx.shipmentReview.updateMany({
        where: { id: shipment.packingReview.id },
        data: {
          status: "CANCELLATION_REQUESTED",
          cancellationRequestedAt: new Date(),
          cancellationReason: reason,
        },
      });
    }

    await tx.outboxEvent.create({
      data: {
        eventType: EVENT_TYPE,
        aggregateType: "SHIPMENT_RESOLUTION_REQUEST",
        aggregateId: request.id,
        dedupeKey: `li02gc3-resolution:${request.id}:v1`,
        payload: { shipmentResolutionRequestId: request.id },
      },
    });

    return { request, replay: false };
  });

export const findBuyerShipmentResolutionRequest = (buyerId, sellerOrderId) =>
  prisma.shipmentResolutionRequest.findFirst({
    where: { buyerId, sellerOrderId },
    select: {
      id: true,
      sellerOrderId: true,
      status: true,
      reason: true,
      physicalReturnConfirmed: true,
      requestedAt: true,
      commandAcceptedAt: true,
      resolvedAt: true,
      hubResponse: true,
      createdAt: true,
      updatedAt: true,
    },
  });
