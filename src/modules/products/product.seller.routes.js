import { Router } from "express";
import {
  archiveProduct,
  createProduct,
  getSellerProduct,
  getSellerProducts,
  updateProduct,
} from "./product.controller.js";
import {
  createProductSchema,
  productIdParamSchema,
  productQuerySchema,
  updateProductSchema,
} from "./product.validation.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validateMiddleware.js";
import { authenticate } from "../../middlewares/authenticate.js";
import { requireSeller, requireActiveSeller } from "../../middlewares/seller.middleware.js";
import { uploadCatalogMedia } from "../../middlewares/upload.js";
import { processCatalogMedia } from "../../middlewares/processMedia.js";
import { parseProductMultipart } from "../../middlewares/parseProductMultipart.js";
import { MEDIA_FOLDERS } from "../../lib/media.js";


const productSellerRouter = Router();

productSellerRouter.use(authenticate, requireSeller, requireActiveSeller);

productSellerRouter.post(
  "/",
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.PRODUCT),
  parseProductMultipart,
  validateBody(createProductSchema),
  createProduct,
);

productSellerRouter.get("/", validateQuery(productQuerySchema), getSellerProducts);

productSellerRouter.get("/:id", validateParams(productIdParamSchema), getSellerProduct);

productSellerRouter.patch(
  "/:id",
  uploadCatalogMedia,
  processCatalogMedia(MEDIA_FOLDERS.PRODUCT),
  parseProductMultipart,
  validateParams(productIdParamSchema),
  validateBody(updateProductSchema),
  updateProduct,
);

productSellerRouter.delete("/:id", validateParams(productIdParamSchema), archiveProduct);

export default productSellerRouter;
