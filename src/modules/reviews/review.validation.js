import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const productIdParamSchema = z.object({ productId: cuid }).strict();
export const reviewIdParamSchema = z.object({ reviewId: cuid }).strict();

export const createReviewBodySchema = z.object({
  variantId: cuid,
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120).optional(),
  comment: z.string().trim().min(10).max(3000),
}).strict();

export const updateReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().trim().min(1).max(120).nullable().optional(),
  comment: z.string().trim().min(10).max(3000).optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one review field must be supplied",
);

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
}).strict();
