import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const inventoryIdParamSchema = z.object({
  id: cuid,
});

export const stockInSchema = z.object({
  variantId: cuid,
  locationId: cuid,
  quantity: z.coerce.number().int().positive(),
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export const adjustSchema = z.object({
  delta: z.coerce.number().int(),
  reference: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export const reorderLevelSchema = z.object({
  reorderLevel: z.coerce.number().int().nonnegative(),
});

export const inventoryQuerySchema = z.object({
  variantId: cuid.optional(),
  locationId: cuid.optional(),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
