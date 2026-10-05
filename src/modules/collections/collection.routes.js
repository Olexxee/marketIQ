import { Router } from "express";
import {
  createCollection,
  deleteCollection,
  getCollection,
  getCollections,
  updateCollection,
} from "./collection.controller.js";
import {
  collectionIdParamSchema,
  collectionQuerySchema,
  createCollectionSchema,
  updateCollectionSchema,
} from "./collection.validation.js";

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

const collectionRouter = Router();

// ============================================================
// PUBLIC
// ============================================================

collectionRouter.get("/", validateQuery(collectionQuerySchema), getCollections);

collectionRouter.get(
  "/:id",
  validateParams(collectionIdParamSchema),
  getCollection,
);

// ============================================================
// ADMIN / STAFF
// ============================================================

collectionRouter.post(
  "/",
  authenticate,
  authorize("ADMIN", "STAFF"),
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.COLLECTION),
  validateBody(createCollectionSchema),
  createCollection,
);

collectionRouter.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "STAFF"),
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.COLLECTION),
  validateParams(collectionIdParamSchema),
  validateBody(updateCollectionSchema),
  updateCollection,
);

// ============================================================
// ADMIN ONLY
// ============================================================

collectionRouter.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateParams(collectionIdParamSchema),
  deleteCollection,
);

export default collectionRouter;
