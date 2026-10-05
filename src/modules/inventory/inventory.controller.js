import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import { successResponse } from "../../lib/response.js";
import {
  adjustService,
  getInventoryService,
  listInventoryService,
  listMovementsService,
  setReorderLevelService,
  stockInService,
} from "./inventory.service.js";

// ============================================================
// WRITE
// ============================================================

export const stockIn = asyncWrapper(async (req, res) => {
  const inventory = await stockInService(req.seller.id, req.body);

  return successResponse({
    res,
    statusCode: 200,
    message: "Stock added successfully",
    data: inventory,
  });
});

export const adjustInventory = asyncWrapper(async (req, res) => {
  const inventory = await adjustService(req.seller.id, req.params.id, req.body);

  return successResponse({
    res,
    statusCode: 200,
    message: "Inventory adjusted successfully",
    data: inventory,
  });
});

export const setReorderLevel = asyncWrapper(async (req, res) => {
  const inventory = await setReorderLevelService(
    req.seller.id,
    req.params.id,
    req.body.reorderLevel,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Reorder level updated successfully",
    data: inventory,
  });
});

// ============================================================
// READ
// ============================================================

export const getInventoryList = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listInventoryService(req.seller.id, {
    ...req.query,
    pagination: { page, limit, skip, take },
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Inventory retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getInventory = asyncWrapper(async (req, res) => {
  const inventory = await getInventoryService(req.seller.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Inventory retrieved successfully",
    data: inventory,
  });
});

export const getInventoryMovements = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listMovementsService(
    req.seller.id,
    req.params.id,
    { pagination: { page, limit, skip, take } },
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Inventory movements retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});
