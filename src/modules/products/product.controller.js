import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import { successResponse } from "../../lib/response.js";
import {
  archiveProductService,
  createProductService,
  getPublicProductService,
  getSellerProductService,
  listPublicProductsService,
  listSellerProductsService,
  updateProductService,
} from "./product.service.js";

// ============================================================
// SELLER
// ============================================================

export const createProduct = asyncWrapper(async (req, res) => {
  const product = await createProductService(req.seller.id, req.body);

  return successResponse({
    res,
    statusCode: 201,
    message: "Product created successfully",
    data: product,
  });
});

export const getSellerProducts = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listSellerProductsService(req.seller.id, {
    ...req.query,
    pagination: { page, limit, skip, take },
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Products retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getSellerProduct = asyncWrapper(async (req, res) => {
  const product = await getSellerProductService(req.seller.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Product retrieved successfully",
    data: product,
  });
});

export const updateProduct = asyncWrapper(async (req, res) => {
  const product = await updateProductService(
    req.seller.id,
    req.params.id,
    req.body,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Product updated successfully",
    data: product,
  });
});

export const archiveProduct = asyncWrapper(async (req, res) => {
  const product = await archiveProductService(req.seller.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Product archived successfully",
    data: product,
  });
});

// ============================================================
// PUBLIC
// ============================================================

export const getPublicProducts = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listPublicProductsService({
    ...req.query,
    pagination: { page, limit, skip, take },
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Products retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getPublicProduct = asyncWrapper(async (req, res) => {
  const product = await getPublicProductService(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Product retrieved successfully",
    data: product,
  });
});
