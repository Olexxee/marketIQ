import test from "node:test";
import assert from "node:assert/strict";

const {
  createReviewBodySchema,
  productIdParamSchema,
  reviewIdParamSchema,
  reviewListQuerySchema,
  updateReviewBodySchema,
  reviewModerationBodySchema,
} = await import("../../../src/modules/reviews/review.validation.js");

const cuidValue = "clh7k2x9a0000qwerty123456";

test("review product and review parameters accept CUID identifiers", () => {
  assert.equal(productIdParamSchema.safeParse({ productId: cuidValue }).success, true);
  assert.equal(reviewIdParamSchema.safeParse({ reviewId: cuidValue }).success, true);
});

test("review parameter schemas reject malformed identifiers and extra fields", () => {
  assert.equal(productIdParamSchema.safeParse({ productId: "invalid" }).success, false);
  assert.equal(reviewIdParamSchema.safeParse({ reviewId: "invalid" }).success, false);
  assert.equal(productIdParamSchema.safeParse({ productId: cuidValue, extra: true }).success, false);
});

test("create review validates rating, variant, and written feedback", () => {
  assert.equal(createReviewBodySchema.safeParse({
    variantId: cuidValue, rating: 5, comment: "Good product and works as described.",
  }).success, true);
  assert.equal(createReviewBodySchema.safeParse({
    variantId: cuidValue, rating: 6, comment: "Good product and works as described.",
  }).success, false);
  assert.equal(createReviewBodySchema.safeParse({
    variantId: cuidValue, rating: 3, comment: "short",
  }).success, false);
  assert.equal(createReviewBodySchema.safeParse({
    variantId: cuidValue, rating: 4, comment: "A good product, extra field is invalid", extra: true,
  }).success, false);
});

test("review updates require at least one valid field", () => {
  assert.equal(updateReviewBodySchema.safeParse({ rating: 4 }).success, true);
  assert.equal(updateReviewBodySchema.safeParse({}).success, false);
  assert.equal(updateReviewBodySchema.safeParse({ rating: 8 }).success, false);
});

test("moderation accepts only approved or rejected status", () => {
  assert.equal(reviewModerationBodySchema.safeParse({ status: "APPROVED" }).success, true);
  assert.equal(reviewModerationBodySchema.safeParse({ status: "REJECTED" }).success, true);
  assert.equal(reviewModerationBodySchema.safeParse({ status: "PENDING" }).success, false);
});

test("review list pagination applies defaults and limits", () => {
  assert.deepEqual(reviewListQuerySchema.parse({}), { page: 1, limit: 10 });
  assert.deepEqual(reviewListQuerySchema.parse({ page: "2", limit: "20" }), { page: 2, limit: 20 });
  assert.equal(reviewListQuerySchema.safeParse({ limit: "100" }).success, false);
});
