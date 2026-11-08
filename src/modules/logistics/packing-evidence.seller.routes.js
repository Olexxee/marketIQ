import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSeller, requireActiveSeller } from "../../middlewares/seller.middleware.js";
import { validateParams } from "../../middlewares/validateMiddleware.js";
import { uploadSingle } from "../../middlewares/upload.js";
import { uploadPackingEvidence } from "./packing-evidence.controller.js";
import { fulfillmentPackingEvidenceParamsSchema } from "./packing-evidence.validation.js";

const router = Router();
router.use(authenticate, requireSeller, requireActiveSeller);
router.post(
  "/:fulfillmentId/packing-evidence",
  validateParams(fulfillmentPackingEvidenceParamsSchema),
  uploadSingle("image"),
  uploadPackingEvidence,
);

export default router;
