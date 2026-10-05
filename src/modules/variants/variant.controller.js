import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  createVariantService,
  deactivateVariantService,
  getVariantService,
  listPublicVariantsService,
  listSellerVariantsService,
  updateVariantService,
} from "./variant.service.js";

// ============================================================
// SELLER
// ============================================================

export const createVariant = asyncWrapper(async (req, res) => {
  const variant = await createVariantService(
    req.seller.id,
    req.params.productId,
    req.body,
  );

  return successResponse({
    res,
    statusCode: 201,
    message: "Variant created successfully",
    data: variant,
  });
});

export const getSellerVariants = asyncWrapper(async (req, res) => {
  const variants = await listSellerVariantsService(
    req.seller.id,
    req.params.productId,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Variants retrieved successfully",
    data: variants,
  });
});

export const getVariant = asyncWrapper(async (req, res) => {
  const variant = await getVariantService(req.seller.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Variant retrieved successfully",
    data: variant,
  });
});

export const updateVariant = asyncWrapper(async (req, res) => {
  const variant = await updateVariantService(
    req.seller.id,
    req.params.id,
    req.body,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Variant updated successfully",
    data: variant,
  });
});

export const deactivateVariant = asyncWrapper(async (req, res) => {
  const variant = await deactivateVariantService(req.seller.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Variant deactivated successfully",
    data: variant,
  });
});

// ============================================================
// PUBLIC
// ============================================================

export const getPublicVariants = asyncWrapper(async (req, res) => {
  const variants = await listPublicVariantsService(req.params.productId);

  return successResponse({
    res,
    statusCode: 200,
    message: "Variants retrieved successfully",
    data: variants,
  });
});
