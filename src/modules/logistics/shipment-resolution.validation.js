import { z } from "zod";

export const shipmentResolutionParamsSchema = z.object({
  sellerOrderId: z.string().trim().min(1).max(128),
}).strict();

export const shipmentResolutionBodySchema = z.object({
  reason: z.string().trim().min(5).max(1000),
}).strict();
