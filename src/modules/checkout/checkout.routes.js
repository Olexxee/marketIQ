import { Router } from "express";
import { checkout } from "./checkout.controller.js";
import { checkoutSchema } from "./checkout.validation.js";
import { validateBody } from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireVerifiedEmail } from "../../middlewares/requireVerifiedEmail.js";

const checkoutRouter = Router();

checkoutRouter.post("/", authenticate, requireVerifiedEmail, validateBody(checkoutSchema), checkout);

export default checkoutRouter;
