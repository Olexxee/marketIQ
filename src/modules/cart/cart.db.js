import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const CART_ITEM_INCLUDE = {
  variant: {
    select: {
      id: true,
      sku: true,
      name: true,
      color: true,
      size: true,
      price: true,
      compareAtPrice: true,
      isActive: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          sellerId: true,
          seller: {
            select: {
              id: true,
              businessName: true,
              status: true,
            },
          },
        },
      },
    },
  },
};

const CART_INCLUDE = {
  items: {
    include: CART_ITEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  },
};

// ============================================================
// CART
// ============================================================

export const findActiveCartByUser = async (userId, tx) => {
  return dbClient(tx).cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: CART_INCLUDE,
  });
};

export const createCart = async (data, tx) => {
  return dbClient(tx).cart.create({
    data,
    include: CART_INCLUDE,
  });
};

export const updateCartStatus = async (cartId, status, tx) => {
  return dbClient(tx).cart.update({
    where: { id: cartId },
    data: { status },
  });
};

// ============================================================
// CART ITEMS
// ============================================================

export const findCartItem = async ({ cartId, variantId }, tx) => {
  return dbClient(tx).cartItem.findUnique({
    where: {
      cartId_variantId: { cartId, variantId },
    },
    include: CART_ITEM_INCLUDE,
  });
};

export const findCartItemById = async (id, tx) => {
  return dbClient(tx).cartItem.findUnique({
    where: { id },
    include: {
      ...CART_ITEM_INCLUDE,
      cart: { select: { id: true, userId: true, status: true } },
    },
  });
};

export const createCartItem = async (data, tx) => {
  return dbClient(tx).cartItem.create({ data });
};

export const updateCartItem = async (id, data, tx) => {
  return dbClient(tx).cartItem.update({
    where: { id },
    data,
  });
};

export const deleteCartItem = async (id, tx) => {
  return dbClient(tx).cartItem.delete({ where: { id } });
};

export const deleteCartItemsByCart = async (cartId, tx) => {
  return dbClient(tx).cartItem.deleteMany({ where: { cartId } });
};

// ============================================================
// VARIANT + INVENTORY VALIDATION HELPERS
// ============================================================

export const findVariantContext = async (variantId, tx) => {
  return dbClient(tx).productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      sku: true,
      name: true,
      price: true,
      isActive: true,
      productId: true,
      sellerId: true,
      product: {
        select: {
          id: true,
          status: true,
          seller: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });
};

/**
 * Returns a Map<variantId, availableQuantity> for the given variant IDs.
 * availableQuantity = sum(quantity) - sum(reservedQty) across all active
 * inventory rows for that variant.
 */
export const getAvailableQuantities = async (variantIds, tx) => {
  const map = new Map();
  for (const id of variantIds) map.set(id, 0);

  if (!variantIds.length) return map;

  const rows = await dbClient(tx).inventory.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: variantIds },
      isActive: true,
    },
    _sum: { quantity: true, reservedQty: true },
  });

  for (const row of rows) {
    const total = row._sum.quantity ?? 0;
    const reserved = row._sum.reservedQty ?? 0;
    map.set(row.variantId, Math.max(0, total - reserved));
  }

  return map;
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
