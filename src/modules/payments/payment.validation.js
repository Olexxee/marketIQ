import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const initiatePaymentSchema = z.object({
  orderId: cuid,
  callbackUrl: z.string().url().optional(),
});

export const verifyPaymentParamSchema = z.object({
  reference: z.string().trim().min(1),
});
