import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const findActiveProductForReviews = (productId) =>
  dbClient().product.findFirst({
    where: { id: productId, status: "ACTIVE", seller: { status: "ACTIVE" } },
    select: { id: true },
  });

export const findActiveReviewProduct = (productId, variantId, tx) =>
  dbClient(tx).product.findFirst({
    where: {
      id: productId,
      status: "ACTIVE",
      seller: { status: "ACTIVE" },
      variants: { some: { id: variantId, isActive: true } },
    },
    select: {
      id: true,
      name: true,
      sellerId: true,
      categoryId: true,
      brandId: true,
      collectionId: true,
      seller: { select: { userId: true } },
      variants: {
        where: { id: variantId, isActive: true },
        select: { id: true, sku: true, name: true },
        take: 1,
      },
    },
  });

export const findEligiblePurchase = (userId, variantId, tx) =>
  dbClient(tx).orderItem.findFirst({
    where: {
      variantId,
      order: {
        buyerId: userId,
        paymentStatus: "SUCCESS",
        status: { in: ["DELIVERED", "COMPLETED"] },
      },
    },
    select: { orderId: true },
    orderBy: { createdAt: "desc" },
  });

export const findUserVariantReview = (userId, variantId, tx) =>
  dbClient(tx).review.findFirst({
    where: { userId, variantId },
  });

export const createReview = (data, tx) =>
  dbClient(tx).review.create({
    data,
    include: {
      user: { select: { id: true, fullName: true } },
      variant: { select: { id: true, sku: true, name: true, productId: true } },
    },
  });

export const updateReview = (reviewId, data, tx) =>
  dbClient(tx).review.update({
    where: { id: reviewId },
    data,
    include: {
      user: { select: { id: true, fullName: true } },
      variant: { select: { id: true, sku: true, name: true, productId: true } },
    },
  });

export const deleteReview = (reviewId, tx) =>
  dbClient(tx).review.delete({ where: { id: reviewId } });

export const findReviewById = (reviewId, tx) =>
  dbClient(tx).review.findUnique({ where: { id: reviewId } });

export const findApprovedProductReviews = async ({ productId, page, limit }) => {
  const where = {
    status: "APPROVED",
    variant: { productId },
  };
  const client = dbClient();
  const [items, total] = await Promise.all([
    client.review.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true } },
        variant: { select: { id: true, sku: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.review.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getApprovedProductReviewSummary = async (productId) =>
  dbClient().review.aggregate({
    where: { status: "APPROVED", variant: { productId } },
    _avg: { rating: true },
    _count: { _all: true },
  });

export const findMyReviews = ({ userId, page, limit }) => {
  const where = { userId };
  const client = dbClient();
  return Promise.all([
    client.review.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            name: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.review.count({ where }),
  ]).then(([items, total]) => ({
    items, total, page, limit, totalPages: Math.ceil(total / limit),
  }));
};

export const withReviewTransaction = (callback) => prisma.$transaction(callback);
