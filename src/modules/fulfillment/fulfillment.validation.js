import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const fulfillmentIdParamSchema = z.object({
  id: cuid,
});

export const sellerOrderIdParamSchema = z.object({
  id: cuid,
});

const dateString = z
  .string()
  .trim()
  .min(1)
  .refine((val) => !Number.isNaN(Date.parse(val)), "Invalid date");

export const createFulfillmentSchema = z.object({
  type: z.enum(["LOCAL", "IMPORT", "PREORDER", "DIGITAL"]),
  warehouseId: cuid.nullable().optional(),
  shippingMethod: z
    .enum(["LOCAL", "IMPORT", "SEA", "AIR", "DIGITAL"])
    .nullable()
    .optional(),
  estimatedDelivery: dateString.nullable().optional(),
  shippingCost: z.coerce.number().nonnegative().optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  carrier: z.string().trim().max(120).optional(),
  trackingUrl: z.string().trim().url().optional(),
});

export const updateFulfillmentSchema = z.object({
  status: z
    .enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"])
    .optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  carrier: z.string().trim().max(120).optional(),
  trackingUrl: z.string().trim().url().optional(),
  shippingMethod: z
    .enum(["LOCAL", "IMPORT", "SEA", "AIR", "DIGITAL"])
    .optional(),
  estimatedDelivery: dateString.optional(),
  shippingCost: z.coerce.number().nonnegative().optional(),
});
