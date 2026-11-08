import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError } from "../../classes/errorClasses.js";
import { env } from "../../config/env.js";
import { createLogisticHubClient, LogisticHubApiError } from "./logistic-hub.client.js";
import { findSellerFulfillmentForPackingEvidence, findBuyerShipmentForPackingEvidence } from "./packing-evidence.db.js";
import { PACKING_EVIDENCE_SLOTS } from "./packing-evidence.validation.js";

const MAX_BYTES = 5 * 1024 * 1024;
const SIGNATURES = {
  "image/jpeg": buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  "image/png": buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),
  "image/webp": buffer => buffer.length >= 12 && buffer.toString("ascii",0,4) === "RIFF" && buffer.toString("ascii",8,12) === "WEBP",
};

const clientFor = provider => createLogisticHubClient({
  config: { ...env.logisticHub, baseUrl: env.logisticHub.baseUrl || provider.baseUrl },
});

const mapHubError = error => {
  if (error instanceof LogisticHubApiError && error.retryable) {
    throw new ServiceUnavailableError("Packing evidence storage is temporarily unavailable. Retry with the same Idempotency-Key.");
  }
  if (error instanceof LogisticHubApiError) {
    throw new ConflictError(`Logistic Hub rejected the packing evidence request: ${error.message}`, error.code);
  }
  throw error;
};

const assertImage = file => {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestError("A packing evidence image is required.");
  }
  if (file.buffer.length > MAX_BYTES) throw new BadRequestError("Packing evidence images must not exceed 5 MB.");
  if (!SIGNATURES[file.mimetype]?.(file.buffer)) {
    throw new BadRequestError("Only valid JPEG, PNG, and WebP images are accepted.");
  }
};

const requireIdempotencyKey = value => {
  const key = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new BadRequestError("A valid Idempotency-Key header (8–128 characters) is required.");
  }
  return key;
};

export const uploadPackingEvidenceService = async (sellerId, fulfillmentId, { slot }, file, idempotencyKey) => {
  if (!PACKING_EVIDENCE_SLOTS.includes(slot)) throw new BadRequestError("Select one of the four defined packing evidence slots.");
  assertImage(file);
  const fulfillment = await findSellerFulfillmentForPackingEvidence(fulfillmentId, sellerId);
  if (!fulfillment) throw new NotFoundError("Fulfillment not found.");
  const shipment = fulfillment.sellerOrder.logisticsShipment;
  if (
    !["PENDING", "PROCESSING"].includes(fulfillment.status) ||
    fulfillment.sellerOrder.status === "CANCELLED" ||
    fulfillment.sellerOrder.order.paymentStatus !== "SUCCESS" ||
    !shipment || shipment.status !== "BOOKED" ||
    shipment.provider?.code !== "LOGISTIC_HUB" || !shipment.provider.isActive
  ) {
    throw new ConflictError("Packing evidence can only be submitted for a paid seller order with a booked Logistic Hub shipment.");
  }
  const key = requireIdempotencyKey(idempotencyKey);
  try {
    return await clientFor(shipment.provider).uploadPackingEvidence(
      shipment.externalReference,
      {
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
        slot,
        actorReference: sellerId,
      },
      key,
    );
  } catch (error) {
    mapHubError(error);
  }
};

export const listBuyerPackingEvidenceService = async (buyerId, sellerOrderId) => {
  const shipment = await findBuyerShipmentForPackingEvidence(sellerOrderId, buyerId);
  if (!shipment) throw new NotFoundError("Shipment not found.");
  if (shipment.status !== "BOOKED") throw new ConflictError("Packing evidence is not available until the shipment is booked.");
  try {
    const result = await clientFor(shipment.provider).listPackingEvidence(shipment.externalReference);
    return {
      shipmentReference: result.shipmentReference,
      evidence: result.evidence.map(item => ({
        id: item.id,
        slot: item.slot,
        version: item.version,
        originalName: item.originalName,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        uploadedAt: item.uploadedAt,
      })),
    };
  } catch (error) {
    mapHubError(error);
  }
};

export const downloadBuyerPackingEvidenceService = async (buyerId, sellerOrderId, evidenceId) => {
  const shipment = await findBuyerShipmentForPackingEvidence(sellerOrderId, buyerId);
  if (!shipment) throw new NotFoundError("Shipment not found.");
  try {
    return await clientFor(shipment.provider).downloadPackingEvidence(shipment.externalReference, evidenceId);
  } catch (error) {
    mapHubError(error);
  }
};
