import prisma from "../../config/prisma.js";
const dbClient = (tx) => tx || prisma;

const MEDIA_ORDER = [{ isPrimary: "desc" }, { sortOrder: "asc" }];

const VARIANT_INCLUDE = {
  media: { orderBy: MEDIA_ORDER },
  _count: {
    select: { inventories: true, reviews: true, orderItems: true },
  },
};

export const createVariant = async (data, tx) => {
  return dbClient(tx).productVariant.create({ data });
};

export const updateVariant = async (id, data, tx) => {
  return dbClient(tx).productVariant.update({ where: { id }, data });
};

export const deactivateVariant = async (id, tx) => {
  return dbClient(tx).productVariant.update({
    where: { id },
    data: { isActive: false },
  });
};

export const findVariantById = async (id, tx) => {
  return dbClient(tx).productVariant.findUnique({
    where: { id },
    include: VARIANT_INCLUDE,
  });
};

export const findVariantBySkuForSeller = async (sellerId, sku, tx) => {
  return dbClient(tx).productVariant.findUnique({
    where: { sellerId_sku: { sellerId, sku } },
  });
};

export const findVariantsByProduct = async (
  productId,
  { includeInactive = true } = {},
  tx,
) => {
  return dbClient(tx).productVariant.findMany({
    where: {
      productId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: VARIANT_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
};

export const countVariantsByProduct = async (
  productId,
  { includeInactive = true } = {},
  tx,
) => {
  return dbClient(tx).productVariant.count({
    where: {
      productId,
      ...(includeInactive ? {} : { isActive: true }),
    },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
