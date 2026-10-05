import { Router } from "express";
import {
  getMarketActivitiesController,
  recordMarketActivityController,
} from "./marketActivity.controller.js";
import { asyncWrapper } from "../../middlewares/asyncWrapper.js";
import { authenticate } from "../auth/auth.middleware.js";


const router = Router();

// Internal/authenticated activity recording endpoint.
// Most production activity should eventually be generated
// internally by marketplace services.
router.post("/", authenticate, asyncWrapper(recordMarketActivityController));

// Admin/intelligence activity inspection.
router.get("/", authenticate, asyncWrapper(getMarketActivitiesController));

export default router;
