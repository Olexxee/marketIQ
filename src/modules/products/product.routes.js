import { Router } from "express";
import { getPublicProduct, getPublicProducts } from "./product.controller.js";
import {
  productIdParamSchema,
  publicProductQuerySchema,
} from "./product.validation.js";
import { validateParams, validateQuery } from "../../middlewares/validateMiddleware.js";

const productRouter = Router();

productRouter.get("/", validateQuery(publicProductQuerySchema), getPublicProducts);

productRouter.get("/:id", validateParams(productIdParamSchema), getPublicProduct);

export default productRouter;
