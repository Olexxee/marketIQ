import { NotFoundError } from "../../classes/errorClasses.js";
import { recordMarketActivity } from "../market-activity/marketActivity.service.js";
import { createWishlistItem, deleteWishlistItem, findPublicProduct, findWishlistItem, listWishlistByUser, withWishlistTransaction } from "./wishlist.db.js";

export const getWishlistService = async (userId) => listWishlistByUser(userId);

export const addWishlistItemService = async (userId, productId) =>
  withWishlistTransaction(async (tx) => {
    const product = await findPublicProduct(productId, tx);
    if (!product) throw new NotFoundError("Active product not found");

    const existing = await findWishlistItem({ userId, productId }, tx);
    if (existing) return { item: existing, alreadySaved: true };

    const item = await createWishlistItem({ userId, productId, variantId: null }, tx);
    await recordMarketActivity({
      activityType: "PRODUCT_FAVORITED",
      userId,
      productId: product.id,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      collectionId: product.collectionId,
    }, tx);
    return { item, alreadySaved: false };
  });

export const removeWishlistItemService = async (userId, productId) =>
  withWishlistTransaction(async (tx) => {
    const item = await findWishlistItem({ userId, productId }, tx);
    if (!item) return { removed: false };

    await deleteWishlistItem(item.id, tx);
    const product = await findPublicProduct(productId, tx);
    await recordMarketActivity({
      activityType: "PRODUCT_UNFAVORITED",
      userId,
      productId,
      sellerId: product?.sellerId ?? null,
      categoryId: product?.categoryId ?? null,
      brandId: product?.brandId ?? null,
      collectionId: product?.collectionId ?? null,
    }, tx);
    return { removed: true };
  });
