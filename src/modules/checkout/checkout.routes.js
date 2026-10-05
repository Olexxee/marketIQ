import { Router } from "express";
import { checkout } from "./checkout.controller.js";
import { checkoutSchema } from "./checkout.validation.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authenticate, validateBody(checkoutSchema), checkout);

export default router;
