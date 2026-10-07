import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../classes/errorClasses.js";
import { publishEvent } from "../../events/event.publisher.js";
import { EVENT_TYPES } from "../../events/event.types.js";
import {
  createCart,
  createCartItem,
  deleteCartItem,
  deleteCartItemsByCart,
  findActiveCartByUser,
  findCartItem,
  findCartItemById,
  findVariantContext,
  getAvailableQuantities,
  updateCartItem,
  withTransaction,
} from "./cart.db.js";

// ============================================================
// HELPERS
// ============================================================

const ensureVariantIsPurchasable = async (variantId, tx) => {
  const variant = await findVariantContext(variantId, tx);

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }
  if (!variant.isActive) {
    throw new BadRequestError("Variant is not active");
  }
  if (variant.product.status !== "ACTIVE") {
    throw new BadRequestError("Product is not active");
  }
  if (variant.product.seller.status !== "ACTIVE") {
    throw new BadRequestError("Seller is not active");
  }

  return variant;
};

const buildCartResponse = async (cart, tx) => {
  const variantIds = cart.items.map((item) => item.variantId);
  const availableMap = await getAvailableQuantities(variantIds, tx);

  const items = cart.items.map((item) => {
    const currentPrice = Number(item.variant.price);
    const snapshotPrice = Number(item.unitPriceSnapshot);
    const available = availableMap.get(item.variantId) ?? 0;

    return {
      id: item.id,
      quantity: item.quantity,
      unitPriceSnapshot: snapshotPrice,
      currentPrice,
      priceChanged: snapshotPrice !== currentPrice,
      lineTotal: currentPrice * item.quantity,
      availableQuantity: available,
      variant: {
        id: item.variant.id,
        sku: item.variant.sku,
        name: item.variant.name,
        color: item.variant.color,
        size: item.variant.size,
        isActive: item.variant.isActive,
      },
      product: {
        id: item.variant.product.id,
        name: item.variant.product.name,
        slug: item.variant.product.slug,
        status: item.variant.product.status,
      },
      seller: {
        id: item.variant.product.seller.id,
        businessName: item.variant.product.seller.businessName,
        status: item.variant.product.seller.status,
      },
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    id: cart.id,
    status: cart.status,
    items,
    summary: {
      itemCount: items.length,
      totalQuantity,
      subtotal,
      currency: "NGN",
    },
  };
};

const getActiveCartOrThrow = async (userId, tx) => {
  const cart = await findActiveCartByUser(userId, tx);
  if (!cart) {
    throw new NotFoundError("Cart is empty");
  }
  return cart;
};

const getOrCreateActiveCart = async (userId, tx) => {
  let cart = await findActiveCartByUser(userId, tx);
  if (!cart) {
    cart = await createCart({ userId, status: "ACTIVE" }, tx);
  }
  return cart;
};

// ============================================================
// MARKET ACTIVITY HELPERS
// ============================================================

const recordCartAddition = async (
  { userId, cartId, cartItemId, variant, quantity },
  tx,
) => {
  await publishEvent(
    {
      eventType: EVENT_TYPES.PRODUCT_ADDED_TO_CART,
      aggregateType: "CART_ITEM",
      aggregateId: cartItemId,
      payload: {
        userId,
        cartId,
        cartItemId,
        productId: variant.product.id,
        variantId: variant.id,
        sellerId: variant.product.seller.id, 
        quantity, 
      },
    },
    tx,
  );
};

const recordCartRemoval = async (
  { userId, cartId, cartItemId, variant, quantity },
  tx,
) => {
  // ✅ Standardized to publishEvent to match the Outbox pattern used in additions
  await publishEvent(
    {
      eventType: EVENT_TYPES.PRODUCT_REMOVED_FROM_CART,
      aggregateType: "CART_ITEM",
      aggregateId: cartItemId,
      payload: {
        userId,
        cartId,
        cartItemId,
        productId: variant.product.id,
        variantId: variant.id,
        sellerId: variant.product.seller.id,
        quantity,
      },
    },
    tx,
  );
};

// ============================================================
// READ
// ============================================================

export const getCartService = async (userId) => {
  return withTransaction(async (tx) => {
    const cart = await getOrCreateActiveCart(userId, tx);
    return buildCartResponse(cart, tx);
  });
};

// ============================================================
// ADD ITEM
// ============================================================

export const addCartItemService = async (userId, { variantId, quantity }) => {
  return withTransaction(async (tx) => {
    const variant = await ensureVariantIsPurchasable(variantId, tx);
    const cart = await getOrCreateActiveCart(userId, tx);

    const existing = await findCartItem({ cartId: cart.id, variantId }, tx);
    const previousQuantity = existing?.quantity || 0;
    const nextQuantity = previousQuantity + quantity;

    const availableMap = await getAvailableQuantities([variantId], tx);
    const available = availableMap.get(variantId) ?? 0;

    if (nextQuantity > available) {
      throw new BadRequestError(
        `Insufficient inventory. Available: ${available}, requested: ${nextQuantity}`,
      );
    }

    let cartItemId;
    if (existing) {
      await updateCartItem(existing.id, { quantity: nextQuantity }, tx);
      cartItemId = existing.id;
    } else {
      const newItem = await createCartItem(
        {
          cartId: cart.id,
          variantId,
          quantity,
          unitPriceSnapshot: variant.price,
        },
        tx,
      );
      cartItemId = newItem.id; // ✅ Capture the new item's ID for the event
    }

    // Record only the quantity added by this action.
    await recordCartAddition(
      {
        userId,
        cartId: cart.id, // ✅ Fixed: now passing cartId
        cartItemId, // ✅ Fixed: now passing cartItemId
        variant,
        quantity,
      },
      tx,
    );

    const fresh = await findActiveCartByUser(userId, tx);
    return buildCartResponse(fresh, tx);
  });
};

// ============================================================
// UPDATE ITEM
// ============================================================

export const updateCartItemService = async (userId, itemId, { quantity }) => {
  return withTransaction(async (tx) => {
    const item = await findCartItemById(itemId, tx);

    if (!item) {
      throw new NotFoundError("Cart item not found");
    }
    if (item.cart.userId !== userId) {
      throw new ForbiddenError("You cannot modify this cart item");
    }
    if (item.cart.status !== "ACTIVE") {
      throw new BadRequestError("Cart is not active");
    }
    if (!item.variant.isActive) {
      throw new BadRequestError("Variant is not active");
    }
    if (item.variant.product.status !== "ACTIVE") {
      throw new BadRequestError("Product is not active");
    }

    const previousQuantity = item.quantity;
    const availableMap = await getAvailableQuantities([item.variantId], tx);
    const available = availableMap.get(item.variantId) ?? 0;

    if (quantity > available) {
      throw new BadRequestError(
        `Insufficient inventory. Available: ${available}, requested: ${quantity}`,
      );
    }

    if (quantity === previousQuantity) {
      const fresh = await findActiveCartByUser(userId, tx);
      return buildCartResponse(fresh, tx);
    }

    await updateCartItem(itemId, { quantity }, tx);

    const quantityDifference = quantity - previousQuantity;

    if (quantityDifference > 0) {
      await recordCartAddition(
        {
          userId,
          cartId: item.cartId ?? item.cart.id, // ✅ Fixed: passing cartId
          cartItemId: item.id, // ✅ Fixed: passing cartItemId
          variant: item.variant,
          quantity: quantityDifference,
        },
        tx,
      );
    } else {
      await recordCartRemoval(
        {
          userId,
          cartId: item.cartId ?? item.cart.id, // ✅ Fixed: passing cartId
          cartItemId: item.id, // ✅ Fixed: passing cartItemId
          variant: item.variant,
          quantity: Math.abs(quantityDifference),
        },
        tx,
      );
    }

    const fresh = await findActiveCartByUser(userId, tx);
    return buildCartResponse(fresh, tx);
  });
};

// ============================================================
// REMOVE ITEM
// ============================================================

export const removeCartItemService = async (userId, itemId) => {
  return withTransaction(async (tx) => {
    const item = await findCartItemById(itemId, tx);

    if (!item) {
      throw new NotFoundError("Cart item not found");
    }
    if (item.cart.userId !== userId) {
      throw new ForbiddenError("You cannot modify this cart item");
    }
    if (item.cart.status !== "ACTIVE") {
      throw new BadRequestError("Cart is not active");
    }

    await deleteCartItem(itemId, tx);

    await recordCartRemoval(
      {
        userId,
        cartId: item.cartId ?? item.cart.id, // ✅ Fixed: passing cartId
        cartItemId: item.id, // ✅ Fixed: passing cartItemId
        variant: item.variant,
        quantity: item.quantity,
      },
      tx,
    );

    const fresh = await findActiveCartByUser(userId, tx);
    return buildCartResponse(fresh, tx);
  });
};

// ============================================================
// CLEAR
// ============================================================

export const clearCartService = async (userId) => {
  return withTransaction(async (tx) => {
    const cart = await getActiveCartOrThrow(userId, tx);

    // Capture the items before deleting them so that their
    // product/variant/seller context can be recorded.
    for (const item of cart.items) {
      await recordCartRemoval(
        {
          userId,
          cartId: cart.id, // ✅ Fixed: passing cartId
          cartItemId: item.id, // ✅ Fixed: passing cartItemId
          variant: item.variant,
          quantity: item.quantity,
        },
        tx,
      );
    }

    await deleteCartItemsByCart(cart.id, tx);

    const fresh = await findActiveCartByUser(userId, tx);
    return buildCartResponse(fresh, tx);
  });
};
