import { Router } from "express";
import {
  createFulfillment,
  getFulfillment,
  listFulfillments,
  updateFulfillment,
} from "./fulfillment.controller.js";
import {
  createFulfillmentSchema,
  fulfillmentIdParamSchema,
  sellerOrderIdParamSchema,
  updateFulfillmentSchema,
} from "./fulfillment.validation.js";
import {
  validateBody,
  validateParams,
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSeller } from "../../middlewares/seller.middleware.js";

// ============================================================
// NESTED: /api/seller/orders/:id/fulfillments
// ============================================================

export const fulfillmentNestedRouter = Router({ mergeParams: true });

fulfillmentNestedRouter.use(authenticate, requireSeller);

fulfillmentNestedRouter.get(
  "/",
  validateParams(sellerOrderIdParamSchema),
  listFulfillments,
);

fulfillmentNestedRouter.post(
  "/",
  validateParams(sellerOrderIdParamSchema),
  validateBody(createFulfillmentSchema),
  createFulfillment,
);

// ============================================================
// FLAT: /api/seller/fulfillments
// ============================================================

export const fulfillmentFlatRouter = Router();

fulfillmentFlatRouter.use(authenticate, requireSeller);

fulfillmentFlatRouter.get(
  "/:id",
  validateParams(fulfillmentIdParamSchema),
  getFulfillment,
);

fulfillmentFlatRouter.patch(
  "/:id",
  validateParams(fulfillmentIdParamSchema),
  validateBody(updateFulfillmentSchema),
  updateFulfillment,
);
