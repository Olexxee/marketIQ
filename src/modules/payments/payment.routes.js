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
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";



const paymentRouter = Router();

paymentRouter.use(authenticate);

paymentRouter.post("/initiate", validateBody(initiatePaymentSchema), initiatePayment);

paymentRouter.get(
  "/verify/:reference",
  validateParams(verifyPaymentParamSchema),
  verifyPayment,
);

paymentRouter.get("/order/:orderId", listPaymentsForOrder);

export default paymentRouter;
