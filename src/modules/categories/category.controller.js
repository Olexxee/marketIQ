import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import { successResponse } from "../../lib/response.js";

import {
  createCategoryService,
  deleteCategoryService,
  getCategoryService,
  listCategories,
  listCategoryTree,
  updateCategoryService,
} from "./category.service.js";

// ============================================================
// CREATE
// ============================================================

export const createCategory = asyncWrapper(async (req, res) => {
  const category = await createCategoryService(req.body);

  return successResponse({
    res,
    statusCode: 201,
    message: "Category created successfully",
    data: category,
  });
});

// ============================================================
// READ
// ============================================================

export const getCategories = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listCategories({
    ...req.query,
    pagination: { page, limit, skip, take },
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Categories retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getCategoryTree = asyncWrapper(async (req, res) => {
  const categories = await listCategoryTree(req.query);

  return successResponse({
    res,
    statusCode: 200,
    message: "Category tree retrieved successfully",
    data: categories,
  });
});

export const getCategory = asyncWrapper(async (req, res) => {
  const category = await getCategoryService(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Category retrieved successfully",
    data: category,
  });
});

// ============================================================
// UPDATE
// ============================================================

export const updateCategory = asyncWrapper(async (req, res) => {
  const category = await updateCategoryService(req.params.id, req.body);

  return successResponse({
    res,
    statusCode: 200,
    message: "Category updated successfully",
    data: category,
  });
});

// ============================================================
// DELETE
// ============================================================

export const deleteCategory = asyncWrapper(async (req, res) => {
  await deleteCategoryService(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Category deleted successfully",
    data: null,
  });
});
