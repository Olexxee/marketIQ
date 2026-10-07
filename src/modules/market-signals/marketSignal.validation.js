import { z } from "zod";
import { cuid } from "../../lib/validators.js";

const optionalCuid = cuid.optional();

const dateQuery = z
  .string()
  .trim()
  .refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "Invalid ISO date",
  })
  .optional();

export const getMarketSignalsQuerySchema = z
  .object({
    signalType: z
      .enum([
        "PRODUCT_DEMAND",
        "CATEGORY_DEMAND",
        "GEOGRAPHIC_DEMAND",
        "SUPPLY_DEMAND_OPPORTUNITY",
      ])
      .optional(),
    entityType: z.enum(["PRODUCT", "CATEGORY", "LOCATION"]).optional(),
    entityId: optionalCuid,
    scopeKey: z.string().trim().min(1).optional(),
    countryId: optionalCuid,
    stateId: optionalCuid,
    lgaId: optionalCuid,
    cityId: optionalCuid,
    windowStart: dateQuery,
    windowEnd: dateQuery,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine((data, ctx) => {
    if (data.windowStart && data.windowEnd) {
      const start = new Date(data.windowStart);
      const end = new Date(data.windowEnd);

      if (start >= end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windowEnd"],
          message: "windowEnd must be after windowStart",
        });
      }
    }
    if (data.entityId && !data.entityType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityType"],
        message: "entityType is required when entityId is provided",
      });
    }
  });

export const getMarketSignalParamsSchema = z.object({
  id: cuid,
});
