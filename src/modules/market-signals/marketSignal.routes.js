import { Router } from "express";
import {
  getMarketSignalByIdController,
  getMarketSignalsController,
} from "./marketSignal.controller.js";
import {
  getMarketSignalParamsSchema,
  getMarketSignalsQuerySchema,
} from "./marketSignal.validation.js";
import {
  validateParams,
  validateQuery,
} from "../../middlewares/validateMiddleware";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";



const router = Router();

router.use(authenticate, authorize("ADMIN", "STAFF"));

router.get(
  "/",
  validateQuery(getMarketSignalsQuerySchema),
  getMarketSignalsController,
);

router.get(
  "/:id",
  validateParams(getMarketSignalParamsSchema),
  getMarketSignalByIdController,
);

export default router;
