import prisma from "../../config/prisma.js";

const reviewInclude = {
  buyer: { select: { id: true, fullName: true } },
  sellerOrder: {
    include: {
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
        include: {
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
    include: {
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
