import { Router } from "express";
import {
  adjustInventory,
  getInventory,
  getInventoryList,
  getInventoryMovements,
  setReorderLevel,
  stockIn,
} from "./inventory.controller.js";
import {
  adjustSchema,
  inventoryIdParamSchema,
  inventoryQuerySchema,
  reorderLevelSchema,
  stockInSchema,
} from "./inventory.validation.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSeller } from "../../middlewares/seller.middleware.js";

const inventoryRouter = Router();

inventoryRouter.use(authenticate, requireSeller);

inventoryRouter.post("/stock-in", validateBody(stockInSchema), stockIn);

inventoryRouter.get("/", validateQuery(inventoryQuerySchema), getInventoryList);

inventoryRouter.get("/:id", validateParams(inventoryIdParamSchema), getInventory);

inventoryRouter.post(
  "/:id/adjust",
  validateParams(inventoryIdParamSchema),
  validateBody(adjustSchema),
  adjustInventory,
);

inventoryRouter.patch(
  "/:id/reorder-level",
  validateParams(inventoryIdParamSchema),
  validateBody(reorderLevelSchema),
  setReorderLevel,
);

inventoryRouter.get(
  "/:id/movements",
  validateParams(inventoryIdParamSchema),
  validateQuery(inventoryQuerySchema),
  getInventoryMovements,
);

export default inventoryRouter;
