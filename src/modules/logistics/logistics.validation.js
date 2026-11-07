import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const quoteCreateSchema = z.object({
  sellerId: cuid,
  addressId: cuid,
  customerName: z.string().trim().min(1).max(160).optional(),
  customerPhone: z.string().trim().min(7).max(32).optional(),
}).strict();

export const quoteParamsSchema = z.object({ quoteId: cuid }).strict();
export const quoteOptionParamsSchema = z.object({ quoteId: cuid, optionId: cuid }).strict();
