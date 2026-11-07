export const createLogisticsTrackingRepository = ({ prismaClient } = {}) => {
  if (!prismaClient) throw new Error("A Prisma client is required.");

  return Object.freeze({
    findOwnedLogisticsShipmentTracking: (sellerOrderId, buyerId) =>
      prismaClient.logisticsShipment.findFirst({
        where: {
          sellerOrderId,
          provider: { code: "LOGISTIC_HUB" },
          sellerOrder: { order: { buyerId } },
        },
        select: {
          externalBookingReference: true,
          trackingReference: true,
          status: true,
          providerStatus: true,
          lastEventSequence: true,
          lastEventAt: true,
          bookedAt: true,
          events: {
            orderBy: { sequence: "asc" },
            select: {
              externalEventId: true,
              eventType: true,
              sequence: true,
              occurredAt: true,
              payload: true,
            },
          },
        },
      }),
  });
};
