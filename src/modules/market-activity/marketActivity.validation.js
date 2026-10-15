import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const MARKET_ACTIVITY_TYPES = [
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
  "ORDER_CANCELLED",
  "ORDER_COMPLETED",
  "PAYMENT_COMPLETED",
  "PAYMENT_FAILED",
  "FULFILLMENT_CREATED",
  "FULFILLMENT_SHIPPED",
  "FULFILLMENT_DELIVERED",
  "INVENTORY_STOCKED_IN",
  "INVENTORY_ADJUSTED",
  "INVENTORY_RESERVED",
  "INVENTORY_RELEASED",
  "INVENTORY_COMMITTED",
];

export const recordPublicMarketActivitySchema = z.object({
  activityType: z.enum([
    "PRODUCT_VIEW",
    "PRODUCT_SEARCH",
    "CATEGORY_VIEW",
    "SELLER_VIEW",
  ]),
  productId: cuid.optional(),
  categoryId: cuid.optional(),
  sellerId: cuid.optional(),
  searchTerm: z.string().trim().min(1).max(120).transform(value => value.replace(/\\s+/g, " ")).optional(),
}).strict().superRefine((value, context) => {
  const requiredField = {
    PRODUCT_VIEW: "productId",
    PRODUCT_SEARCH: "searchTerm",
    CATEGORY_VIEW: "categoryId",
    SELLER_VIEW: "sellerId",
  }[value.activityType];

  if (!value[requiredField]) {
    context.addIssue({
      code: "custom",
      path: [requiredField],
      message: requiredField + " is required for " + value.activityType,
    });
  }
});

export const recordMarketActivitySchema = z.object({
  activityType: z.enum(MARKET_ACTIVITY_TYPES),
  userId: cuid.nullable().optional(),
  productId: cuid.nullable().optional(),
  variantId: cuid.nullable().optional(),
  sellerId: cuid.nullable().optional(),
  categoryId: cuid.nullable().optional(),
  brandId: cuid.nullable().optional(),
  collectionId: cuid.nullable().optional(),
  countryId: cuid.nullable().optional(),
  stateId: cuid.nullable().optional(),
  lgaId: cuid.nullable().optional(),
  cityId: cuid.nullable().optional(),
  quantity: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const getMarketActivitiesQuerySchema = z.object({
  activityType: z.enum(MARKET_ACTIVITY_TYPES).optional(),
  userId: cuid.optional(),
  productId: cuid.optional(),
  variantId: cuid.optional(),
  sellerId: cuid.optional(),
  categoryId: cuid.optional(),
  brandId: cuid.optional(),
  collectionId: cuid.optional(),
  countryId: cuid.optional(),
  stateId: cuid.optional(),
  lgaId: cuid.optional(),
  cityId: cuid.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
