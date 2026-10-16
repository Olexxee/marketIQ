import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  createProductReviewService,
  deleteMyReviewService,
  getProductReviewSummaryService,
  listMyReviewsService,
  listProductReviewsService,
  updateMyReviewService,
} from "./review.service.js";

export const listProductReviews = asyncWrapper(async (req, res) => {
  const result = await listProductReviewsService(
    req.params.productId,
    req.validated.query,
  );
  return successResponse({
    res,
    statusCode: 200,
    message: "Product reviews retrieved successfully",
    data: result.items,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  });
});

export const getProductReviewSummary = asyncWrapper(async (req, res) => {
  const summary = await getProductReviewSummaryService(req.params.productId);
  return successResponse({
    res,
    statusCode: 200,
    message: "Product review summary retrieved successfully",
    data: summary,
  });
});

export const createProductReview = asyncWrapper(async (req, res) => {
  const review = await createProductReviewService(
    req.user.id,
    req.params.productId,
    req.validated.body,
  );
  return successResponse({
    res,
    statusCode: 201,
    message: "Review submitted for moderation",
    data: review,
  });
});

export const updateMyReview = asyncWrapper(async (req, res) => {
  const review = await updateMyReviewService(
    req.user.id,
    req.params.reviewId,
    req.validated.body,
  );
  return successResponse({
    res,
    statusCode: 200,
    message: "Review updated and submitted for moderation",
    data: review,
  });
});

export const deleteMyReview = asyncWrapper(async (req, res) => {
  const result = await deleteMyReviewService(req.user.id, req.params.reviewId);
  return successResponse({
    res,
    statusCode: 200,
    message: "Review deleted successfully",
    data: result,
  });
});

export const listMyReviews = asyncWrapper(async (req, res) => {
  const result = await listMyReviewsService(req.user.id, req.validated.query);
  return successResponse({
    res,
    statusCode: 200,
    message: "Your reviews retrieved successfully",
    data: result.items,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  });
});
