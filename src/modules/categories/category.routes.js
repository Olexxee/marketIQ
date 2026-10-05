import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  getCategoryTree,
  updateCategory,
} from "./category.controller.js";
import {
  categoryIdParamSchema,
  categoryQuerySchema,
  createCategorySchema,
  updateCategorySchema,
} from "./category.validation.js";
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

const catalogRouter = Router();

// ============================================================
// PUBLIC READS
// ============================================================

catalogRouter.get("/tree", validateQuery(categoryQuerySchema), getCategoryTree);

catalogRouter.get("/", validateQuery(categoryQuerySchema), getCategories);

catalogRouter.get("/:id", validateParams(categoryIdParamSchema), getCategory);

// ============================================================
// ADMIN / STAFF WRITES
// Categories are global platform taxonomy. Sellers cannot
// create, edit, or delete them.
// ============================================================

catalogRouter.post(
  "/",
  authenticate,
  authorize("ADMIN", "STAFF"),
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.CATEGORY),
  validateBody(createCategorySchema),
  createCategory,
);

catalogRouter.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "STAFF"),
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.CATEGORY),
  validateParams(categoryIdParamSchema),
  validateBody(updateCategorySchema),
  updateCategory,
);

catalogRouter.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validateParams(categoryIdParamSchema),
  deleteCategory,
);

export default catalogRouter;
