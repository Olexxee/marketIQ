import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  listWarehouseMappingsService,
  createWarehouseMappingService,
  verifyWarehouseMappingService,
  activateWarehouseMappingService,
  deactivateWarehouseMappingService,
  verifyWarehouseCoordinatesService,
  verifyAddressCoordinatesService,
} from "./logistics-admin.service.js";

export const listWarehouseMappings = asyncWrapper(async (req, res) => {
  const mappings = await listWarehouseMappingsService(req.query);
  return successResponse({ res, statusCode: 200, message: "Logistics warehouse mappings retrieved", data: mappings });
});

export const createWarehouseMapping = asyncWrapper(async (req, res) => {
  const mapping = await createWarehouseMappingService(req.user.id, req.body);
  return successResponse({ res, statusCode: 201, message: "Logistics warehouse mapping created inactive", data: mapping });
});

export const verifyWarehouseMapping = asyncWrapper(async (req, res) => {
  const mapping = await verifyWarehouseMappingService(req.user.id, req.params.id, req.body);
  return successResponse({ res, statusCode: 200, message: "Logistics warehouse mapping verification recorded", data: mapping });
});

export const activateWarehouseMapping = asyncWrapper(async (req, res) => {
  const mapping = await activateWarehouseMappingService(req.user.id, req.params.id);
  return successResponse({ res, statusCode: 200, message: "Logistics warehouse mapping activated", data: mapping });
});

export const deactivateWarehouseMapping = asyncWrapper(async (req, res) => {
  const mapping = await deactivateWarehouseMappingService(req.user.id, req.params.id);
  return successResponse({ res, statusCode: 200, message: "Logistics warehouse mapping deactivated", data: mapping });
});

export const verifyWarehouseCoordinates = asyncWrapper(async (req, res) => {
  const warehouse = await verifyWarehouseCoordinatesService(req.user.id, req.params.id, req.body);
  return successResponse({ res, statusCode: 200, message: "Warehouse coordinates verified", data: warehouse });
});

export const verifyAddressCoordinates = asyncWrapper(async (req, res) => {
  const address = await verifyAddressCoordinatesService(req.user.id, req.params.id, req.body);
  return successResponse({ res, statusCode: 200, message: "Delivery address coordinates verified", data: address });
});
