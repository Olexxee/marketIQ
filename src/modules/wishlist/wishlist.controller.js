import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import { addWishlistItemService, getWishlistService, removeWishlistItemService } from "./wishlist.service.js";

export const getWishlist = asyncWrapper(async (req, res) => {
  const items = await getWishlistService(req.user.id);
  return successResponse({ res, statusCode: 200, message: "Wishlist retrieved successfully", data: items });
});

export const addWishlistItem = asyncWrapper(async (req, res) => {
  const result = await addWishlistItemService(req.user.id, req.params.productId);
  return successResponse({
    res,
    statusCode: result.alreadySaved ? 200 : 201,
    message: result.alreadySaved ? "Product is already saved" : "Product saved to wishlist",
    data: result.item,
  });
});

export const removeWishlistItem = asyncWrapper(async (req, res) => {
  const result = await removeWishlistItemService(req.user.id, req.params.productId);
  return successResponse({
    res,
    statusCode: 200,
    message: result.removed ? "Product removed from wishlist" : "Product was not in wishlist",
    data: result,
  });
});
