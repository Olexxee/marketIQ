import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const checkoutSchema = z
  .object({
    addressId: cuid.optional(),

    deliveryAddress: z.string().trim().min(1).optional(),
    deliveryCountryId: cuid.optional(),
    deliveryStateId: cuid.optional(),
    deliveryLgaId: cuid.optional(),
    deliveryCityId: cuid.nullable().optional(),

    customerName: z.string().trim().min(1),
    customerPhone: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.addressId) return;

    const required = [
      "deliveryAddress",
      "deliveryCountryId",
      "deliveryStateId",
      "deliveryLgaId",
    ];

    for (const field of required) {
      if (!data[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `Required when addressId is not provided`,
        });
      }
    }
  });
