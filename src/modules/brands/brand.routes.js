import { Router } from "express";

import {
  createBrand,
  deleteBrand,
  getBrand,
  getBrands,
  updateBrand,
} from "./brand.controller.js";
import {
  brandIdParamSchema,
  brandQuerySchema,
  createBrandSchema,
  updateBrandSchema,
} from "./brand.validation.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { uploadCatalogMedia } from "../../middlewares/upload.js";
import { processCatalogMedia } from "../../middlewares/processMedia.js";
import { MEDIA_FOLDERS } from "../../lib/media.js";



const brandRouter = Router();

// ============================================================
// PUBLIC READS
// ============================================================

brandRouter.get("/", validateQuery(brandQuerySchema), getBrands);

brandRouter.get("/:id", validateParams(brandIdParamSchema), getBrand);

// ============================================================
// ADMIN / STAFF WRITES
// Brands are a global registry. Sellers cannot write them.
// ============================================================

brandRouter.post(
  "/",
  authenticate,
  authorize("ADMIN", "STAFF"),
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.BRAND),
  validateBody(createBrandSchema),
  createBrand,
);

brandRouter.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "STAFF"),
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.BRAND),
  validateParams(brandIdParamSchema),
  validateBody(updateBrandSchema),
  updateBrand,
);

brandRouter.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateParams(brandIdParamSchema),
  deleteBrand,
);

export default brandRouter;
