import { z } from "zod";
import { cuid, decimalAmount, mediaAssetSchema } from "../../lib/validators.js";

export const variantIdParamSchema = z.object({
  id: cuid,
});

export const variantProductParamSchema = z.object({
  productId: cuid,
});

export const createVariantSchema = z.object({
  sku: z.string().trim().min(1).optional(),
  name: z.string().trim().optional(),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
  price: decimalAmount,
  compareAtPrice: decimalAmount.nullable().optional(),
  weight: decimalAmount.optional(),
  length: decimalAmount.nullable().optional(),
  width: decimalAmount.nullable().optional(),
  height: decimalAmount.nullable().optional(),
  fulfillmentType: z
    .enum(["LOCAL", "IMPORT", "PREORDER", "DIGITAL"])
    .optional(),
  attributes: z.any().optional(),
  metadata: z.any().optional(),
  isActive: z.boolean().optional(),
  variantImages: z.array(mediaAssetSchema).optional(),
});

export const updateVariantSchema = createVariantSchema.partial();
