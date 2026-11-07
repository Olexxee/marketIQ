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
  listServiceZoneMappingsService, createServiceZoneMappingService, verifyServiceZoneMappingService,
  activateServiceZoneMappingService, deactivateServiceZoneMappingService,
  listPackageCategoryMappingsService, createPackageCategoryMappingService, verifyPackageCategoryMappingService,
  activatePackageCategoryMappingService, deactivatePackageCategoryMappingService,
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

export const listServiceZoneMappings = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Logistics service-zone mappings retrieved", data: await listServiceZoneMappingsService(req.query) }));
export const createServiceZoneMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 201, message: "Service-zone mapping created inactive", data: await createServiceZoneMappingService(req.user.id, req.body) }));
export const verifyServiceZoneMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Service-zone mapping verified", data: await verifyServiceZoneMappingService(req.user.id, req.params.id, req.body) }));
export const activateServiceZoneMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Service-zone mapping activated", data: await activateServiceZoneMappingService(req.user.id, req.params.id) }));
export const deactivateServiceZoneMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Service-zone mapping deactivated", data: await deactivateServiceZoneMappingService(req.user.id, req.params.id) }));

export const listPackageCategoryMappings = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Logistics package-category mappings retrieved", data: await listPackageCategoryMappingsService(req.query) }));
export const createPackageCategoryMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 201, message: "Package-category mapping created inactive", data: await createPackageCategoryMappingService(req.user.id, req.body) }));
export const verifyPackageCategoryMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Package-category mapping verified", data: await verifyPackageCategoryMappingService(req.user.id, req.params.id, req.body) }));
export const activatePackageCategoryMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Package-category mapping activated", data: await activatePackageCategoryMappingService(req.user.id, req.params.id) }));
export const deactivatePackageCategoryMapping = asyncWrapper(async (req, res) =>
  successResponse({ res, statusCode: 200, message: "Package-category mapping deactivated", data: await deactivatePackageCategoryMappingService(req.user.id, req.params.id) }));
