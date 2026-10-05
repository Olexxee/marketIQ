import { Router } from "express";
import {
  initiatePayment,
  listPaymentsForOrder,
  verifyPayment,
} from "./payment.controller.js";
import {
  initiatePaymentSchema,
  verifyPaymentParamSchema,
} from "./payment.validation.js";
import {
  validateBody,
  validateParams,
} from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/authenticate.js";



const router = Router();

router.use(authenticate);

router.post("/initiate", validateBody(initiatePaymentSchema), initiatePayment);

router.get(
  "/verify/:reference",
  validateParams(verifyPaymentParamSchema),
  verifyPayment,
);

router.get("/order/:orderId", listPaymentsForOrder);

export default router;
