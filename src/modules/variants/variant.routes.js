import { Router } from "express";
import { getPublicVariants } from "./variant.controller.js";
import { variantProductParamSchema } from "./variant.validation.js";
import { validateParams } from "../../middlewares/validateMiddleware.js";

const variantPublicRouter = Router({ mergeParams: true });

variantPublicRouter.get("/", validateParams(variantProductParamSchema), getPublicVariants);

export default variantPublicRouter;
