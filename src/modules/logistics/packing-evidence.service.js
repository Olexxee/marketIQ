import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError } from "../../classes/errorClasses.js";
import { env } from "../../config/env.js";
import { createLogisticHubClient, LogisticHubApiError } from "./logistic-hub.client.js";
import { findSellerFulfillmentForPackingEvidence, findBuyerShipmentForPackingEvidence } from "./packing-evidence.db.js";
import { PACKING_EVIDENCE_SLOTS } from "./packing-evidence.validation.js";
import { startPackingReview, findBuyerPackingReview, approveBuyerPackingReview } from "./shipment-review.db.js";

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
  if (error instanceof LogisticHubApiError && error.status === 404) {
    throw new NotFoundError("Packing evidence or shipment not found.");
  }
  if (error instanceof LogisticHubApiError && (
    error.retryable || error.code.endsWith("NOT_CONFIGURED") || error.code.endsWith("INVALID_CONFIGURATION")
  )) {
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
  const reviewGate = shipment.packingReview;
  if (!reviewGate || reviewGate.status !== "WAITING_FOR_EVIDENCE") {
    throw new ConflictError("Packing evidence is frozen because the shipment is not awaiting evidence.");
  }
  if (reviewGate.evidenceDeadlineAt <= new Date()) {
    throw new ConflictError("The 24-hour evidence submission deadline has passed; operations review is required.");
  }
  const key = requireIdempotencyKey(idempotencyKey);
  try {
    const client = clientFor(shipment.provider);
    const uploaded = await client.uploadPackingEvidence(
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
    const currentEvidence = await client.listPackingEvidence(shipment.externalReference);
    const acceptedSlots = new Set(currentEvidence.evidence.map(item => item.slot));
    const evidenceComplete = PACKING_EVIDENCE_SLOTS.every(requiredSlot => acceptedSlots.has(requiredSlot));
    const frozen = evidenceComplete
      ? await client.freezePackingEvidence(
        shipment.externalReference,
        `mqi-freeze-${fulfillment.sellerOrder.id}-v1`,
      )
      : null;
    const review = evidenceComplete
      ? await startPackingReview({
        sellerOrderId: fulfillment.sellerOrder.id,
        shipmentId: shipment.id,
        buyerId: fulfillment.sellerOrder.order.buyerId,
      })
      : null;
    return { ...uploaded, evidenceComplete, evidenceFrozenAt: frozen?.frozenAt ?? null, review };
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

export const getBuyerPackingReviewService = async (buyerId, sellerOrderId) => {
  const review = await findBuyerPackingReview(sellerOrderId, buyerId);
  if (!review) throw new NotFoundError("Packing review not found.");
  return review;
};

export const approveBuyerPackingReviewService = async (buyerId, sellerOrderId) => {
  const result = await approveBuyerPackingReview({ buyerId, sellerOrderId, now: new Date() });
  if (result.notFound) throw new NotFoundError("Packing review not found.");
  if (result.expired) throw new ConflictError("The review window has expired; dispatch authorization is being processed.");
  if (result.blocker) throw new ConflictError("This packing review can no longer be approved.");
  return result.review;
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
