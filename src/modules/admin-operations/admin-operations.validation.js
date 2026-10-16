import { z } from "zod";
import { cuid } from "../../lib/validators.js";

export const disputeIdParamSchema = z.object({ id: cuid });
export const orderIdParamSchema = z.object({ orderId: cuid });
export const refundIdParamSchema = z.object({ id: cuid });

export const disputeListQuerySchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const resolveDisputeSchema = z.object({
  resolution: z.enum(["REFUND_FULL", "REFUND_PARTIAL", "RELEASE_PAYMENT", "NO_ACTION"]),
  resolutionNotes: z.string().trim().min(3).max(1000),
  refundAmount: z.coerce.number().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.resolution === "REFUND_PARTIAL" && value.refundAmount === undefined) {
    ctx.addIssue({ code: "custom", path: ["refundAmount"], message: "refundAmount is required for REFUND_PARTIAL" });
  }
  if (value.resolution !== "REFUND_PARTIAL" && value.refundAmount !== undefined) {
    ctx.addIssue({ code: "custom", path: ["refundAmount"], message: "refundAmount is only valid for REFUND_PARTIAL" });
  }
});

export const refundRequestSchema = z.object({
  paymentId: cuid.optional(),
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const refundListQuerySchema = z.object({
  status: z.enum(["REQUESTED", "APPROVED", "PROCESSING", "SUCCEEDED", "FAILED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});


export const sellerOrderIdParamSchema = z.object({ sellerOrderId: cuid });
export const settlementIdParamSchema = z.object({ id: cuid });
export const settlementPaidSchema = z.object({
  externalReference: z.string().trim().min(3).max(120),
});
export const settlementListQuerySchema = z.object({
  status: z.enum(["REQUESTED", "APPROVED", "PROCESSING", "PAID", "FAILED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
