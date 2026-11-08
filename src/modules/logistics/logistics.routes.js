import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireVerifiedEmail } from "../../middlewares/requireVerifiedEmail.js";
import { validateBody, validateParams } from "../../middlewares/validateMiddleware.js";
import {
  quoteCreateSchema, quoteParamsSchema, quoteOptionParamsSchema,
} from "./logistics.validation.js";
import {
  createDeliveryQuote, getDeliveryQuote, acceptDeliveryQuoteOption,
} from "./logistics.controller.js";
import { getShipmentTracking } from "./logistics-tracking.controller.js";
import { shipmentTrackingParamsSchema } from "./logistics.validation.js";
import { listBuyerPackingEvidence, downloadBuyerPackingEvidence, getBuyerPackingReview, approveBuyerPackingReview } from "./packing-evidence.controller.js";
import { buyerPackingEvidenceParamsSchema, buyerPackingEvidenceDownloadParamsSchema } from "./packing-evidence.validation.js";
import { requestBuyerShipmentCancellation, getBuyerShipmentResolution } from "./shipment-resolution.controller.js";
import { shipmentResolutionParamsSchema, shipmentResolutionBodySchema } from "./shipment-resolution.validation.js";

const router = Router();
router.use(authenticate, requireVerifiedEmail);
router.get("/shipments/:sellerOrderId/tracking", validateParams(shipmentTrackingParamsSchema), getShipmentTracking);
router.get("/shipments/:sellerOrderId/packing-evidence", validateParams(buyerPackingEvidenceParamsSchema), listBuyerPackingEvidence);
router.get("/shipments/:sellerOrderId/packing-review", validateParams(buyerPackingEvidenceParamsSchema), getBuyerPackingReview);
router.post(
  "/shipments/:sellerOrderId/cancellation-request",
  validateParams(shipmentResolutionParamsSchema),
  validateBody(shipmentResolutionBodySchema),
  requestBuyerShipmentCancellation,
);
router.get(
  "/shipments/:sellerOrderId/cancellation-request",
  validateParams(shipmentResolutionParamsSchema),
  getBuyerShipmentResolution,
);
router.post("/shipments/:sellerOrderId/packing-review/approve", validateParams(buyerPackingEvidenceParamsSchema), approveBuyerPackingReview);
router.get("/shipments/:sellerOrderId/packing-evidence/:evidenceId/download", validateParams(buyerPackingEvidenceDownloadParamsSchema), downloadBuyerPackingEvidence);
router.post("/quotes", validateBody(quoteCreateSchema), createDeliveryQuote);
router.get("/quotes/:quoteId", validateParams(quoteParamsSchema), getDeliveryQuote);
router.post("/quotes/:quoteId/options/:optionId/accept", validateParams(quoteOptionParamsSchema), acceptDeliveryQuoteOption);

export default router;
