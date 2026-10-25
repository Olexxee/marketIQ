import { Router } from "express";
import {
  recordMarketActivitySchema,
  getMarketActivitiesQuerySchema,
} from "./marketActivity.controller.js";
import { createRateLimiter } from "../../middlewares/rateLimit.js";
import { authenticate } from "../../middlewares/authenticate.js";
import {
  validate,
  validateQuery, validateBody, validateParams
} from "../../middlewares/validateMiddleware.js";


const router = Router();

const activityWriteLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  keyPrefix: "market-activity-write",
  message: "Too many activity events. Try again shortly.",
});

// Public discovery events only. The service derives entity relationships
// from active catalog records and intentionally does not store actor IDs.
router.post(
  "/",
  activityWriteLimiter,
  validateBody(recordMarketActivitySchema),
  recordPublicMarketActivityController,
);

// Raw event inspection is restricted to trusted internal roles.
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "STAFF"),
  validateQuery(getMarketActivitiesQuerySchema),
  getMarketActivitiesController,
);

export default router;
