import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

// ============================================================
// CREATE
// ============================================================

export const createMarketActivity = async (data, tx) => {
  return dbClient(tx).marketActivity.create({ data });
};

// ============================================================
// PUBLIC DISCOVERY TARGETS
// Return only the catalog references required to classify an event.
// ============================================================

export const findPublicProductActivityTarget = async (productId, tx) => {
  return dbClient(tx).product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      seller: { status: "ACTIVE" },
    },
    select: {
      id: true,
      sellerId: true,
      categoryId: true,
      brandId: true,
      collectionId: true,
    },
  });
};

export const findActiveCategoryActivityTarget = async (categoryId, tx) => {
  return dbClient(tx).category.findFirst({
    where: { id: categoryId, isActive: true, type: "PRODUCT" },
    select: { id: true },
  });
};

export const findActiveSellerActivityTarget = async (sellerId, tx) => {
  return dbClient(tx).sellerProfile.findFirst({
    where: { id: sellerId, status: "ACTIVE" },
    select: { id: true },
  });
};

// ============================================================
// LIST
// ============================================================

export const findMarketActivities = async (
  {
    activityType,
    userId,
    productId,
    variantId,
    sellerId,
    categoryId,
    brandId,
    collectionId,
    countryId,
    stateId,
    lgaId,
    cityId,
    from,
    to,
    page = 1,
    limit = 50,
  },
  tx,
) => {
  const where = {};

  if (activityType) where.activityType = activityType;
  if (userId) where.userId = userId;
  if (productId) where.productId = productId;
  if (variantId) where.variantId = variantId;
  if (sellerId) where.sellerId = sellerId;
  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (collectionId) where.collectionId = collectionId;

  if (countryId) where.countryId = countryId;
  if (stateId) where.stateId = stateId;
  if (lgaId) where.lgaId = lgaId;
  if (cityId) where.cityId = cityId;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const skip = (page - 1) * limit;
  const client = dbClient(tx);

  const [items, total] = await Promise.all([
    client.marketActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    client.marketActivity.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
