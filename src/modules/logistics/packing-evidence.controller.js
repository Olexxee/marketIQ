import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  uploadPackingEvidenceService,
  listBuyerPackingEvidenceService,
  downloadBuyerPackingEvidenceService,
} from "./packing-evidence.service.js";

export const uploadPackingEvidence = asyncWrapper(async (req, res) => {
  const result = await uploadPackingEvidenceService(
    req.seller.id,
    req.params.fulfillmentId,
    req.body,
    req.file,
    req.get("idempotency-key"),
  );
  return successResponse({ res, statusCode: result.replay ? 200 : 201, message: "Packing evidence uploaded", data: result });
});

export const listBuyerPackingEvidence = asyncWrapper(async (req, res) => {
  const result = await listBuyerPackingEvidenceService(req.user.id, req.params.sellerOrderId);
  return successResponse({ res, statusCode: 200, message: "Packing evidence retrieved", data: result });
});

export const downloadBuyerPackingEvidence = asyncWrapper(async (req, res) => {
  const file = await downloadBuyerPackingEvidenceService(req.user.id, req.params.sellerOrderId, req.params.evidenceId);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Length", String(file.buffer.length));
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(file.buffer);
});
