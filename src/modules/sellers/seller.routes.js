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
import { requireVerifiedEmail } from "../../middlewares/requireVerifiedEmail.js";
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
  requireVerifiedEmail,
  validateBody(onboardSellerSchema),
  onboard,
);

sellerRouter.get("/me", authenticate, requireSeller, getMe);

sellerRouter.patch(
  "/me",
  authenticate,
  requireVerifiedEmail,
  requireSeller,
  validateBody(updateSellerSchema),
  updateMe,
);

sellerRouter.post(
  "/locations",
  authenticate,
  requireVerifiedEmail,
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
  requireVerifiedEmail,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  validateBody(updateBusinessLocationSchema),
  updateLocation,
);

sellerRouter.delete(
  "/locations/:id",
  authenticate,
  requireVerifiedEmail,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  deleteLocation,
);

export default sellerRouter;
