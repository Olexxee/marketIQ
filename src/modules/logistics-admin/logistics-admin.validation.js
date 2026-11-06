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

const coordinateNumber = (minimum, maximum) => z.union([
  z.number(),
  z.string().trim().min(1).regex(/^-?\\d+(?:\\.\\d+)?$/, "Coordinate must be a decimal number"),
]).transform(Number).pipe(z.number().finite().min(minimum).max(maximum));

export const coordinateVerificationSchema = z.object({
  latitude: coordinateNumber(-90, 90),
  longitude: coordinateNumber(-180, 180),
  source: z.string().trim().min(3).max(200),
}).strict();
