import { z } from "zod";

import { cuid, mediaAssetSchema } from "../../lib/validators.js";

// ============================================================
// PARAMS / QUERY
// ============================================================

export const collectionIdParamSchema = z.object({
  id: cuid,
});

const booleanish = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => (typeof v === "boolean" ? v : v === "true"));

  
export const collectionQuerySchema = z.object({
  isActive: booleanish.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// CREATE / UPDATE
// ============================================================

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  isActive: booleanish.optional(),
  coverImage: mediaAssetSchema.nullable().optional(),
  galleryImages: z.array(mediaAssetSchema).optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial();
