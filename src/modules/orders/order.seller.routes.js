import { Router } from "express";
import {
  getSellerOrder,
  listSellerOrders,
  updateSellerOrderStatus,
} from "./order.controller.js";
import {
  orderIdParamSchema,
  sellerOrderQuerySchema,
  updateSellerOrderStatusSchema,
} from "./order.validation.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSeller } from "../../middlewares/seller.middleware.js";

const router = Router();

router.use(authenticate, requireSeller);

router.get("/", validateQuery(sellerOrderQuerySchema), listSellerOrders);

router.get("/:id", validateParams(orderIdParamSchema), getSellerOrder);

router.patch(
  "/:id/status",
  validateParams(orderIdParamSchema),
  validateBody(updateSellerOrderStatusSchema),
  updateSellerOrderStatus,
);

export default router;
