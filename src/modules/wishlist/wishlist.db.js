import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const WISHLIST_INCLUDE = {
  product: {
    include: {
      seller: { select: { id: true, businessName: true, status: true } },
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true } },
      media: { orderBy: { createdAt: "asc" }, take: 1 },
      variants: {
        where: { isActive: true },
        select: { id: true, name: true, sku: true, price: true, isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  },
};

export const listWishlistByUser = async (userId, tx) =>
  dbClient(tx).wishlist.findMany({
    where: {
      userId,
      product: { status: "ACTIVE", seller: { status: "ACTIVE" } },
    },
    include: WISHLIST_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

export const findWishlistItem = async ({ userId, productId }, tx) =>
  dbClient(tx).wishlist.findFirst({
    where: { userId, productId, variantId: null },
    include: WISHLIST_INCLUDE,
  });

export const findPublicProduct = async (productId, tx) =>
  dbClient(tx).product.findFirst({
    where: { id: productId, status: "ACTIVE", seller: { status: "ACTIVE" } },
    select: {
      id: true,
      sellerId: true,
      categoryId: true,
      brandId: true,
      collectionId: true,
    },
  });

export const createWishlistItem = async (data, tx) =>
  dbClient(tx).wishlist.create({ data, include: WISHLIST_INCLUDE });

export const deleteWishlistItem = async (id, tx) =>
  dbClient(tx).wishlist.delete({ where: { id } });

export const deleteWishlistItemForUser = async ({ userId, productId }, tx) =>
  dbClient(tx).wishlist.deleteMany({
    where: { userId, productId, variantId: null },
  });

export const withWishlistTransaction = (callback) => prisma.$transaction(callback);
