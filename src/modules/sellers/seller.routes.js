import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateBody, validateParams } from "../../middleware/validate.js";
import {
  onboardSellerSchema,
  updateSellerSchema,
  createBusinessLocationSchema,
  updateBusinessLocationSchema,
  sellerLocationIdParamSchema,
} from "./seller.validation.js";
import { requireSeller } from "./seller.middleware.js";


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

const router = Router();

router.post(
  "/onboard",
  authenticate,
  validateBody(onboardSellerSchema),
  onboard,
);

router.get("/me", authenticate, requireSeller, getMe);

router.patch(
  "/me",
  authenticate,
  requireSeller,
  validateBody(updateSellerSchema),
  updateMe,
);

router.post(
  "/locations",
  authenticate,
  requireSeller,
  validateBody(createBusinessLocationSchema),
  createLocation,
);

router.get("/locations", authenticate, requireSeller, listLocations);

router.get(
  "/locations/:id",
  authenticate,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  getLocation,
);

router.patch(
  "/locations/:id",
  authenticate,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  validateBody(updateBusinessLocationSchema),
  updateLocation,
);

router.delete(
  "/locations/:id",
  authenticate,
  requireSeller,
  validateParams(sellerLocationIdParamSchema),
  deleteLocation,
);

export default router;
