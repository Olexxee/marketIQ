import { z } from "zod";
import { cuid, mediaAssetSchema } from "../../lib/validators.js";

export const brandIdParamSchema = z.object({
  id: cuid,
});

export const brandQuerySchema = z.object({
  isActive: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createBrandSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  coverImage: mediaAssetSchema.nullable().optional(),
  galleryImages: z.array(mediaAssetSchema).optional(),
});

export const updateBrandSchema = createBrandSchema.partial();
