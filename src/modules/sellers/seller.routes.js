import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { validateBody, validateParams } from "../../middlewares/validateMiddleware.js";
import {
  onboardSellerSchema,
  updateSellerSchema,
  createBusinessLocationSchema,
  updateBusinessLocationSchema,
  sellerLocationIdParamSchema,
} from "./seller.validation.js";
import { requireSeller } from "../../middlewares/seller.middleware.js";
import {
  onboard,
  getMe,
  updateMe,
  createLocation,
  listLocations,
  getLocation,
  updateLocation,
  deleteLocation,
} from "./seller.controller.js";


const sellerRouter = Router();

sellerRouter.post(
  "/onboard",
  authenticate,
  validateBody(onboardSellerSchema),
  onboard,
);

sellerRouter.get("/me", authenticate, requireSeller, getMe);

sellerRouter.patch(
  "/me",
  authenticate,
  requireSeller,
  validateBody(updateSellerSchema),
  updateMe,
);

sellerRouter.post(
  "/locations",
  authenticate,
  requireSeller,
  validateBody(createBusinessLocationSchema),
  createLocation,
);

sellerRouter.get("/locations", authenticate, requireSeller, listLocations);

sellerRouter.get(
  "/locations/:id",
  authenticate,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  getLocation,
);

sellerRouter.patch(
  "/locations/:id",
  authenticate,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  validateBody(updateBusinessLocationSchema),
  updateLocation,
);

sellerRouter.delete(
  "/locations/:id",
  authenticate,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  deleteLocation,
);

export default sellerRouter;
