import { z } from "zod";

export const cuid = z.string().cuid();

export const nonEmptyString = z.string().trim().min(1);

export const optionalTrimmed = z.string().trim().optional();

export const positiveInt = z.coerce.number().int().positive();

export const nonNegativeInt = z.coerce.number().int().nonnegative();

export const decimalAmount = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => !Number.isNaN(Number(value)), "Invalid decimal value");

export const nullableCuid = z
  .union([cuid, z.literal(""), z.null()])
  .transform((value) => (value === "" || value === null ? null : value));

export const jsonObject = z.record(z.any());

export const mediaAssetSchema = z.object({
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable().optional(),
  publicId: z.string().nullable().optional(),
  mimeType: z.string().optional(),
  bytes: z.number().int().nonnegative().nullable().optional(),
  format: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  alt: z.string().trim().max(255).optional(),
});

export const mediaAssetListSchema = z.array(mediaAssetSchema);
