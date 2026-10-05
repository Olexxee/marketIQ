import { Router } from "express";
import {
  cancelBuyerOrder,
  confirmBuyerOrder,
  getBuyerOrder,
  listBuyerOrders,
} from "./order.controller.js";

import {
  buyerOrderQuerySchema,
  cancelOrderSchema,
  orderIdParamSchema,
} from "./order.validation.js";

import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";

import { authenticate } from "../../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", validateQuery(buyerOrderQuerySchema), listBuyerOrders);

router.get("/:id", validateParams(orderIdParamSchema), getBuyerOrder);

router.post(
  "/:id/cancel",
  validateParams(orderIdParamSchema),
  validateBody(cancelOrderSchema),
  cancelBuyerOrder,
);

router.post(
  "/:id/confirm",
  validateParams(orderIdParamSchema),
  confirmBuyerOrder,
);

export default router;
