import { Router } from "express";
import {
  createVariant,
  deactivateVariant,
  getSellerVariants,
  getVariant,
  updateVariant,
} from "./variant.controller.js";
import {
  createVariantSchema,
  updateVariantSchema,
  variantIdParamSchema,
  variantProductParamSchema,
} from "./variant.validation.js";
import { validateBody, validateParams } from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSeller, requireActiveSeller } from "../../middlewares/seller.middleware.js";
import { uploadVariantImages } from "../../middlewares/upload.js";
import { processMediaList } from "../../middlewares/processMedia.js";
import { parseVariantMultipart } from "../../middlewares/parseProductMultipart.js";
import { MEDIA_FOLDERS } from "../../lib/media.js";

// ============================================================
// NESTED UNDER /api/seller/products/:productId/variants
// ============================================================

export const variantNestedRouter = Router({ mergeParams: true });

variantNestedRouter.use(authenticate, requireSeller, requireActiveSeller);

variantNestedRouter.post(
  "/",
  validateParams(variantProductParamSchema),
  uploadVariantImages,
  processMediaList("variantImages", MEDIA_FOLDERS.VARIANT, "variantImages"),
  parseVariantMultipart,
  validateBody(createVariantSchema),
  createVariant,
);

variantNestedRouter.get(
  "/",
  validateParams(variantProductParamSchema),
  getSellerVariants,
);

// ============================================================
// FLAT UNDER /api/seller/variants
// ============================================================

export const variantFlatRouter = Router();

variantFlatRouter.use(authenticate, requireSeller, requireActiveSeller);

variantFlatRouter.get("/:id", validateParams(variantIdParamSchema), getVariant);

variantFlatRouter.patch(
  "/:id",
  uploadVariantImages,
  processMediaList("variantImages", MEDIA_FOLDERS.VARIANT, "variantImages"),
  parseVariantMultipart,
  validateParams(variantIdParamSchema),
  validateBody(updateVariantSchema),
  updateVariant,
);

variantFlatRouter.delete(
  "/:id",
  validateParams(variantIdParamSchema),
  deactivateVariant,
);
