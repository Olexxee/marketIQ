import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import { successResponse } from "../../lib/response.js";
import {
  createBrandService,
  deleteBrandService,
  getBrandService,
  listBrands,
  updateBrandService,
} from "./brand.service.js";

// ============================================================
// CREATE
// ============================================================

export const createBrand = asyncWrapper(async (req, res) => {
  const brand = await createBrandService(req.body);

  return successResponse({
    res,
    statusCode: 201,
    message: "Brand created successfully",
    data: brand,
  });
});

// ============================================================
// READ
// ============================================================

export const getBrands = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listBrands({
    ...req.query,
    pagination: { page, limit, skip, take },
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Brands retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getBrand = asyncWrapper(async (req, res) => {
  const brand = await getBrandService(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Brand retrieved successfully",
    data: brand,
  });
});

// ============================================================
// UPDATE
// ============================================================

export const updateBrand = asyncWrapper(async (req, res) => {
  const brand = await updateBrandService(req.params.id, req.body);

  return successResponse({
    res,
    statusCode: 200,
    message: "Brand updated successfully",
    data: brand,
  });
});

// ============================================================
// DELETE
// ============================================================

export const deleteBrand = asyncWrapper(async (req, res) => {
  await deleteBrandService(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Brand deleted successfully",
    data: null,
  });
});
