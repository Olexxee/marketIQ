import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const orderIdParamSchema = z.object({
  id: cuid,
});

export const buyerOrderQuerySchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const sellerOrderQuerySchema = z.object({
  status: z
    .enum([
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cancelOrderSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const updateSellerOrderStatusSchema = z.object({
  status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
});


export const disputeOrderSchema = z.object({
  notes: z.string().trim().min(1).max(1000),
});
