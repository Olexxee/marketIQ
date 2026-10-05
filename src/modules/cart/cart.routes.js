import { Router } from "express";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "./cart.controller.js";
import {
  addCartItemSchema,
  cartItemIdParamSchema,
  updateCartItemSchema,
} from "./cart.validation.js";
import {
  validateBody,
  validateParams,
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";



const cartRouter = Router();

cartRouter.use(authenticate);

cartRouter.get("/", getCart);

cartRouter.post("/items", validateBody(addCartItemSchema), addCartItem);

cartRouter.patch(
  "/items/:id",
  validateParams(cartItemIdParamSchema),
  validateBody(updateCartItemSchema),
  updateCartItem,
);

cartRouter.delete(
  "/items/:id",
  validateParams(cartItemIdParamSchema),
  removeCartItem,
);

cartRouter.delete("/", clearCart);

export default cartRouter;
