import prisma from "../../config/prisma.js";

const reviewInclude = {
  buyer: { select: { id: true, fullName: true } },
  sellerOrder: {
    select: {
      id: true,
      status: true,
      subtotal: true,
      shippingTotal: true,
      total: true,
      seller: { select: { id: true, businessName: true } },
      settlement: {
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          externalReference: true,
          adjustmentReason: true,
          failureReason: true,
          paidAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          subtotal: true,
          shippingTotal: true,
          tax: true,
          total: true,
          createdAt: true,
          updatedAt: true,
          payments: {
            select: {
              id: true,
              reference: true,
              amount: true,
              currency: true,
              status: true,
              provider: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
          refunds: {
            select: {
              id: true,
              paymentId: true,
              amount: true,
              currency: true,
              reason: true,
              status: true,
              providerReference: true,
              failureReason: true,
              reviewedAt: true,
              processedAt: true,
              createdAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
          ledgerTransactions: {
            select: {
              id: true,
              type: true,
              reference: true,
              amount: true,
              currency: true,
              createdAt: true,
              entries: {
                select: {
                  sellerOrderId: true,
                  account: true,
                  direction: true,
                  amount: true,
                  currency: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  },
  shipment: {
    select: {
      id: true,
      externalReference: true,
      trackingReference: true,
      status: true,
      providerStatus: true,
      lastEventSequence: true,
      customerDeliveryChargeMinor: true,
      agreedLogisticsCostMinor: true,
      currency: true,
      billingAgreementReference: true,
      bookedAt: true,
      createdAt: true,
      updatedAt: true,

      events: {
        select: {
          externalEventId: true,
          eventType: true,
          sequence: true,
          occurredAt: true,
          payload: true,
          createdAt: true,
        },
        orderBy: [{ sequence: "asc" }, { occurredAt: "asc" }],
      },
      packingReview: {
        select: {
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
          closedAt: true,
        },
      },
    },
  },
};

export const listLogisticsResolutionReviews = async ({ status, skip, take }) => {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.shipmentResolutionRequest.findMany({
      where,
      include: reviewInclude,
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    prisma.shipmentResolutionRequest.count({ where }),
  ]);
  return { items, total };
};

export const findLogisticsResolutionReviewById = (id) =>
  prisma.shipmentResolutionRequest.findUnique({
    where: { id },
    include: reviewInclude,
  });
