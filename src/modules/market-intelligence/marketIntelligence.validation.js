import { z } from "zod";

const optionalId = z.string().trim().min(1).optional();

export const getMarketIntelligenceQuerySchema = z
  .object({
    intelligenceType: z
      .enum([
        "TREND",
        "OPPORTUNITY",
        "RISK",
        "DEMAND_SPIKE",
        "SUPPLY_GAP",
        "GEOGRAPHIC_SHIFT",
        "CATEGORY_GROWTH",
        "MARKET_STRENGTH",
      ])
      .optional(),

    entityType: z.enum(["PRODUCT", "CATEGORY", "LOCATION"]).optional(),

    entityId: optionalId,

    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),

    windowStart: z
      .string()
      .datetime({
        offset: true,
      })
      .optional(),

    windowEnd: z
      .string()
      .datetime({
        offset: true,
      })
      .optional(),

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

export const getMarketIntelligenceParamsSchema = z.object({
  id: z.string().trim().min(1),
});
