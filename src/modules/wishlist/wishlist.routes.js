import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { validateParams } from "../../middlewares/validateMiddleware.js";
import { addWishlistItem, getWishlist, removeWishlistItem } from "./wishlist.controller.js";
import { productIdParamSchema } from "./wishlist.validation.js";

const wishlistRouter = Router();
wishlistRouter.use(authenticate);
wishlistRouter.get("/", getWishlist);
wishlistRouter.post("/:productId", validateParams(productIdParamSchema), addWishlistItem);
wishlistRouter.delete("/:productId", validateParams(productIdParamSchema), removeWishlistItem);

export default wishlistRouter;
