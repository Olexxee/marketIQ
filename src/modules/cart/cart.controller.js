import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";

import {
  addCartItemService,
  clearCartService,
  getCartService,
  removeCartItemService,
  updateCartItemService,
} from "./cart.service.js";

export const getCart = asyncWrapper(async (req, res) => {
  const cart = await getCartService(req.user.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Cart retrieved successfully",
    data: cart,
  });
});

export const addCartItem = asyncWrapper(async (req, res) => {
  const cart = await addCartItemService(req.user.id, req.body);

  return successResponse({
    res,
    statusCode: 200,
    message: "Item added to cart",
    data: cart,
  });
});

export const updateCartItem = asyncWrapper(async (req, res) => {
  const cart = await updateCartItemService(
    req.user.id,
    req.params.id,
    req.body,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Cart item updated",
    data: cart,
  });
});

export const removeCartItem = asyncWrapper(async (req, res) => {
  const cart = await removeCartItemService(req.user.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Cart item removed",
    data: cart,
  });
});

export const clearCart = asyncWrapper(async (req, res) => {
  const cart = await clearCartService(req.user.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Cart cleared",
    data: cart,
  });
});
