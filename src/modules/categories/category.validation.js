import { z } from "zod";
import { cuid, mediaAssetSchema } from "../../lib/validators.js";

// ============================================================
// SHARED FIELD HELPERS
// ============================================================

const categoryTypeEnum = z.enum(["PRODUCT", "SERVICE", "CONTENT"]);

// Accepts real booleans (JSON) and "true"/"false" strings (query string and
// multipart/form-data, where every value arrives as text).
const booleanish = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => (typeof v === "boolean" ? v : v === "true"));

// multipart/form-data cannot send a real null, so treat "" and "null" as null.
const nullableParentId = z.preprocess(
  (v) => (v === "" || v === "null" ? null : v),
  cuid.nullable().optional(),
);

// ============================================================
// PARAMS / QUERY
// ============================================================

export const categoryIdParamSchema = z.object({
  id: cuid,
});

export const categoryQuerySchema = z.object({
  type: categoryTypeEnum.optional(),
  isActive: booleanish.optional(),
  parentId: cuid.optional(),
  rootOnly: booleanish.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  type: categoryTypeEnum.default("PRODUCT"),
  parentId: nullableParentId,
  isActive: booleanish.optional(),
  sortOrder: z.coerce.number().int().optional(),
  coverImage: mediaAssetSchema.nullable().optional(),
  galleryImages: z.array(mediaAssetSchema).optional(),
});

export const updateCategorySchema = createCategorySchema
  .omit({ type: true })
  .partial();
