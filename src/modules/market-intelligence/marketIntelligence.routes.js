import { Router } from "express";
import {
  getMarketIntelligenceController,
  getMarketIntelligenceByIdController,
} from "./marketIntelligence.controller.js";
import {
  getMarketIntelligenceParamsSchema,
  getMarketIntelligenceQuerySchema,
} from "./marketIntelligence.validation.js";
import { validate } from "../../middlewares/validate.js";

const router = Router();

router.get(
  "/",
  validate({
    query: getMarketIntelligenceQuerySchema,
  }),
  getMarketIntelligenceController,
);

router.get(
  "/:id",
  validate({
    params: getMarketIntelligenceParamsSchema,
  }),
  getMarketIntelligenceByIdController,
);

export default router;
