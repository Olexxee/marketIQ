import { Router } from "express";
import { checkout } from "./checkout.controller.js";
import { checkoutSchema } from "./checkout.validation.js";
import { validateBody } from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";

const checkoutRouter = Router();

checkoutRouter.post("/", authenticate, validateBody(checkoutSchema), checkout);

export default checkoutRouter;
