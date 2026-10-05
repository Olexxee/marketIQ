import { z } from "zod";

const activityTypes = [
  "PRODUCT_VIEW",
  "PRODUCT_SEARCH",
  "CATEGORY_VIEW",
  "SELLER_VIEW",
  "PRODUCT_FAVORITED",
  "PRODUCT_UNFAVORITED",
  "PRODUCT_ADDED_TO_CART",
  "PRODUCT_REMOVED_FROM_CART",
  "SOURCING_REQUEST_CREATED",
  "SOURCING_RESPONSE_SUBMITTED",
  "ORDER_CREATED",
  "ORDER_COMPLETED",
  "ORDER_CANCELLED",
  "PAYMENT_COMPLETED",
];

const optionalId = z.string().cuid().optional();

export const recordMarketActivitySchema = z.object({
  activityType: z.enum(activityTypes),

  userId: optionalId.nullable(),

  productId: optionalId.nullable(),
  variantId: optionalId.nullable(),
  sellerId: optionalId.nullable(),
  categoryId: optionalId.nullable(),
  brandId: optionalId.nullable(),
  collectionId: optionalId.nullable(),

  countryId: optionalId.nullable(),
  stateId: optionalId.nullable(),
  lgaId: optionalId.nullable(),
  cityId: optionalId.nullable(),

  quantity: z.number().int().positive().nullable().optional(),

  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export const getMarketActivitiesQuerySchema = z.object({
  activityType: z.enum(activityTypes).optional(),
  userId: z.string().cuid().optional(),
  productId: z.string().cuid().optional(),
  variantId: z.string().cuid().optional(),
  sellerId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  collectionId: z.string().cuid().optional(),
  countryId: z.string().cuid().optional(),
  stateId: z.string().cuid().optional(),
  lgaId: z.string().cuid().optional(),
  cityId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
