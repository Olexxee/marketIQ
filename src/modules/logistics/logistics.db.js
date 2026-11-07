import prisma from "../../config/prisma.js";

export const findActiveCartForSeller = (userId, sellerId) => prisma.cart.findFirst({
  where: { userId, status: "ACTIVE" },
  include: {
    items: {
      where: { variant: { sellerId } },
      include: {
        variant: {
          include: {
            product: {
              select: {
                id: true, name: true, categoryId: true, sellerId: true, status: true,
                seller: { select: { id: true, status: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    },
  },
});

export const findOwnedDeliveryAddress = (addressId, userId) =>
  prisma.address.findFirst({ where: { id: addressId, userId } });

export const findActiveLogisticsProvider = () =>
  prisma.logisticsProvider.findFirst({ where: { code: "LOGISTIC_HUB", isActive: true } });

export const findEligibleWarehouseMappings = (providerId, sellerId) =>
  prisma.logisticsWarehouseMapping.findMany({
    where: {
      providerId, isActive: true, verifiedAt: { not: null },
      externalServiceZoneId: { not: null },
      warehouse: {
        sellerId, isActive: true,
        coordinatesVerifiedAt: { not: null },
        coordinatesSource: { not: null },
        latitude: { not: null }, longitude: { not: null },
      },
    },
    include: { warehouse: true },
  });

export const findActiveDestinationZoneMapping = (providerId, lgaId) =>
  prisma.logisticsServiceZoneMapping.findFirst({
    where: { providerId, lgaId, isActive: true, verifiedAt: { not: null } },
  });

export const findActivePackageCategoryMappings = (providerId, categoryIds) =>
  prisma.logisticsPackageCategoryMapping.findMany({
    where: {
      providerId, categoryId: { in: categoryIds },
      isActive: true, verifiedAt: { not: null },
    },
  });

export const findQuoteByIdempotency = (providerId, idempotencyKey) =>
  prisma.logisticsQuote.findUnique({
    where: { providerId_idempotencyKey: { providerId, idempotencyKey } },
    include: { options: true, selectedOption: true },
  });

export const findOwnedQuote = (quoteId, userId) =>
  prisma.logisticsQuote.findFirst({
    where: { id: quoteId, cart: { userId, status: "ACTIVE" } },
    include: { provider: true, options: true, selectedOption: true },
  });

export const createQuoteWithOptions = (quote, options) =>
  prisma.$transaction(async tx => {
    const created = await tx.logisticsQuote.create({ data: quote });
    if (options.length) {
      await tx.logisticsQuoteOption.createMany({
        data: options.map(option => ({ ...option, quoteId: created.id })),
      });
    }
    return tx.logisticsQuote.findUnique({
      where: { id: created.id },
      include: { options: true, provider: { select: { id: true, code: true, name: true } } },
    });
  });

export const acceptLocalQuoteOption = ({ quoteId, optionId, customerChargeMinor, logisticsCostMinor, acceptedAt }) =>
  prisma.$transaction(async tx => {
    const current = await tx.logisticsQuote.findUnique({ where: { id: quoteId } });
    if (!current) return null;
    if (current.status === "ACCEPTED") {
      if (current.selectedOptionId === optionId) {
        return tx.logisticsQuote.findUnique({ where: { id: quoteId }, include: { options: true, selectedOption: true } });
      }
      return null;
    }
    const updated = await tx.logisticsQuote.updateMany({
      where: { id: quoteId, status: "QUOTED", selectedOptionId: null, expiresAt: { gt: acceptedAt } },
      data: {
        status: "ACCEPTED", selectedOptionId: optionId,
        customerDeliveryChargeMinor, agreedLogisticsCostMinor, acceptedAt,
      },
    });
    if (updated.count !== 1) return null;
    return tx.logisticsQuote.findUnique({ where: { id: quoteId }, include: { options: true, selectedOption: true } });
  });
