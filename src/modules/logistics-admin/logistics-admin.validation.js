import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const mappingIdParamSchema = z.object({ id: cuid });
export const addressIdParamSchema = z.object({ id: cuid });

export const mappingListQuerySchema = z.object({
  providerId: cuid.optional(),
  warehouseId: cuid.optional(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

export const mappingCreateSchema = z.object({
  providerId: cuid,
  warehouseId: cuid,
  externalWarehouseReference: z.string().trim().min(1).max(180),
});

export const mappingVerificationSchema = z.object({
  notes: z.string().trim().min(5).max(1000),
});

export const coordinateVerificationSchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  source: z.string().trim().min(3).max(200),
}).strict();
