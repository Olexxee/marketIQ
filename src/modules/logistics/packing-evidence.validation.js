import { z } from "zod";

export const fulfillmentPackingEvidenceParamsSchema = z.object({
  fulfillmentId: z.string().trim().min(1).max(128),
}).strict();

export const buyerPackingEvidenceParamsSchema = z.object({
  sellerOrderId: z.string().trim().min(1).max(128),
});

export const buyerPackingEvidenceDownloadParamsSchema = buyerPackingEvidenceParamsSchema.extend({
  evidenceId: z.string().trim().min(1).max(128),
}).strict();

export const PACKING_EVIDENCE_SLOTS = Object.freeze([
  "CONTENTS_OVERVIEW",
  "PRODUCT_DETAILS",
  "QUANTITY_CHECK",
  "SEALED_PARCEL",
]);
