import prisma from "../../config/prisma.js";

export const findSellerFulfillmentForPackingEvidence = (fulfillmentId, sellerId) =>
  prisma.fulfillment.findFirst({
    where: { id: fulfillmentId, sellerOrder: { sellerId } },
    select: {
      id: true,
      status: true,
      sellerOrder: {
        select: {
          id: true,
          sellerId: true,
          status: true,
          order: { select: { paymentStatus: true } },
          logisticsShipment: {
            select: {
              externalReference: true,
              status: true,
              provider: { select: { code: true, baseUrl: true, isActive: true } },
            },
          },
        },
      },
    },
  });

export const findBuyerShipmentForPackingEvidence = (sellerOrderId, buyerId) =>
  prisma.logisticsShipment.findFirst({
    where: {
      sellerOrderId,
      provider: { code: "LOGISTIC_HUB" },
      sellerOrder: { order: { buyerId } },
    },
    select: {
      externalReference: true,
      status: true,
      provider: { select: { baseUrl: true, isActive: true } },
    },
  });
