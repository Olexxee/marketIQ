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
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";



const orderRouter = Router();

orderRouter.use(authenticate);

orderRouter.get("/", validateQuery(buyerOrderQuerySchema), listBuyerOrders);

orderRouter.get("/:id", validateParams(orderIdParamSchema), getBuyerOrder);

orderRouter.post(
  "/:id/cancel",
  validateParams(orderIdParamSchema),
  validateBody(cancelOrderSchema),
  cancelBuyerOrder,
);

orderRouter.post(
  "/:id/confirm",
  validateParams(orderIdParamSchema),
  confirmBuyerOrder,
);

export default orderRouter;
