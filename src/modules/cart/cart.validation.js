import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const cartItemIdParamSchema = z.object({
  id: cuid,
});

export const addCartItemSchema = z.object({
  variantId: cuid,
  quantity: z.coerce.number().int().min(1).max(999),
});

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999),
});
