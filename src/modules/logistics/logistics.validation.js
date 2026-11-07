import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const quoteCreateSchema = z.object({
  sellerId: cuid,
  addressId: cuid,
}).strict();

export const quoteParamsSchema = z.object({ quoteId: cuid }).strict();
export const quoteOptionParamsSchema = z.object({ quoteId: cuid, optionId: cuid }).strict();
