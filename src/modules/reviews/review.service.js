import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../classes/errorClasses.js";
import { recordMarketActivity } from "../market-activity/marketActivity.service.js";
import {
  createReview,
  deleteReview,
  findActiveProductForReviews,
  findActiveReviewProduct,
  findApprovedProductReviews,
  findEligiblePurchase,
  findMyReviews,
  findReviewById,
  findUserVariantReview,
  getApprovedProductReviewSummary,
  updateReview,
  withReviewTransaction,
} from "./review.db.js";

export const listProductReviewsService = async (productId, pagination) => {
  const product = await findActiveProductForReviews(productId);
  if (!product) throw new NotFoundError("Active product not found");
  return findApprovedProductReviews({ productId, ...pagination });
};

export const getProductReviewSummaryService = async (productId) => {
  const product = await findActiveProductForReviews(productId);
  if (!product) throw new NotFoundError("Active product not found");

  const aggregate = await getApprovedProductReviewSummary(productId);
  return {
    averageRating: aggregate._avg.rating === null
      ? null
      : Math.round(aggregate._avg.rating * 100) / 100,
    reviewCount: aggregate._count._all,
  };
};

export const createProductReviewService = (userId, productId, payload) =>
  withReviewTransaction(async (tx) => {
    const product = await findActiveReviewProduct(productId, payload.variantId, tx);
    if (!product) {
      throw new NotFoundError("Active product variant not found");
    }
    if (product.seller.userId === userId) {
      throw new ForbiddenError("You cannot review your own product");
    }

    const purchase = await findEligiblePurchase(userId, payload.variantId, tx);
    if (!purchase) {
      throw new ForbiddenError(
        "A delivered or completed, successfully paid purchase is required to review this product",
      );
    }

    const existing = await findUserVariantReview(userId, payload.variantId, tx);
    if (existing && existing.status !== "REJECTED") {
      throw new ConflictError("You have already submitted a review for this product variant");
    }

    let review;
    if (existing) {
      review = await updateReview(existing.id, {
        rating: payload.rating,
        title: payload.title ?? null,
        comment: payload.comment,
        orderId: purchase.orderId,
        status: "PENDING",
        isVerified: true,
      }, tx);
    } else {
      review = await createReview({
        userId,
        variantId: payload.variantId,
        orderId: purchase.orderId,
        rating: payload.rating,
        title: payload.title ?? null,
        comment: payload.comment,
        status: "PENDING",
        isVerified: true,
      }, tx);
    }

    await recordMarketActivity({
      activityType: "REVIEW_SUBMITTED",
      userId,
      productId: product.id,
      variantId: payload.variantId,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      collectionId: product.collectionId,
      metadata: { rating: payload.rating, reviewStatus: "PENDING" },
    }, tx);

    return review;
  });

export const updateMyReviewService = async (userId, reviewId, payload) => {
  const review = await findReviewById(reviewId);
  if (!review) throw new NotFoundError("Review not found");
  if (review.userId !== userId) throw new ForbiddenError("You can only update your own reviews");
  if (review.status === "REJECTED") {
    throw new BadRequestError("Rejected reviews must be resubmitted through the product review endpoint");
  }

  return updateReview(reviewId, {
    ...payload,
    status: "PENDING",
  });
};

export const deleteMyReviewService = async (userId, reviewId) => {
  const review = await findReviewById(reviewId);
  if (!review) throw new NotFoundError("Review not found");
  if (review.userId !== userId) throw new ForbiddenError("You can only delete your own reviews");
  await deleteReview(reviewId);
  return { deleted: true };
};

export const listMyReviewsService = async (userId, pagination) => {
  const result = await findMyReviews({ userId, ...pagination });
  return result;
};
