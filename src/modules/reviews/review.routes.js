import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validateMiddleware.js";
import {
  createProductReview,
  deleteMyReview,
  getProductReviewSummary,
  listMyReviews,
  listProductReviews,
  moderateReview,
  updateMyReview,
} from "./review.controller.js";
import {
  createReviewBodySchema,
  productIdParamSchema,
  reviewIdParamSchema,
  reviewListQuerySchema,
  reviewModerationBodySchema,
  updateReviewBodySchema,
} from "./review.validation.js";

const reviewRouter = Router();

// Keep the /mine route before /:reviewId so it cannot be interpreted as an ID.
reviewRouter.get("/reviews/mine", authenticate, validateQuery(reviewListQuerySchema), listMyReviews);
reviewRouter.patch("/reviews/:reviewId/moderation", authenticate, authorize("ADMIN", "STAFF"), validateParams(reviewIdParamSchema), validateBody(reviewModerationBodySchema), moderateReview);
reviewRouter.patch("/reviews/:reviewId", authenticate, validateParams(reviewIdParamSchema), validateBody(updateReviewBodySchema), updateMyReview);
reviewRouter.delete("/reviews/:reviewId", authenticate, validateParams(reviewIdParamSchema), deleteMyReview);

reviewRouter.get("/products/:productId/reviews/summary", validateParams(productIdParamSchema), getProductReviewSummary);
reviewRouter.get("/products/:productId/reviews", validateParams(productIdParamSchema), validateQuery(reviewListQuerySchema), listProductReviews);
reviewRouter.post("/products/:productId/reviews", authenticate, validateParams(productIdParamSchema), validateBody(createReviewBodySchema), createProductReview);

export default reviewRouter;
