import { z } from "zod";
import { cuid, mediaAssetSchema } from "../../lib/validators.js";

export const productIdParamSchema = z.object({
  id: cuid,
});

export const productQuerySchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  search: z.string().trim().min(1).optional(),
  categoryId: cuid.optional(),
  brandId: cuid.optional(),
  collectionId: cuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const publicProductQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  categoryId: cuid.optional(),
  brandId: cuid.optional(),
  collectionId: cuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  brandId: cuid.nullable().optional(),
  categoryId: cuid,
  collectionId: cuid.nullable().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  metadata: z.any().optional(),
  coverImage: mediaAssetSchema.nullable().optional(),
  galleryImages: z.array(mediaAssetSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial();
