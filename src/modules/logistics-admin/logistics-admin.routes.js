import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.js";
import { authorize } from "../../middlewares/authorize.js";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validateMiddleware.js";
import {
  addressIdParamSchema,
  coordinateVerificationSchema,
  mappingIdParamSchema,
  mappingListQuerySchema,
  mappingCreateSchema,
  mappingVerificationSchema,
  serviceZoneMappingCreateSchema, packageCategoryMappingCreateSchema,
  logisticsMappingListQuerySchema, logisticsMappingIdParamSchema,
  warehouseMappingUpdateSchema, serviceZoneMappingUpdateSchema, packageCategoryMappingUpdateSchema,
} from "./logistics-admin.validation.js";
import {
  listWarehouseMappings,
  createWarehouseMapping,
  verifyWarehouseMapping,
  activateWarehouseMapping,
  deactivateWarehouseMapping,
  verifyWarehouseCoordinates,
  verifyAddressCoordinates,
  listServiceZoneMappings, createServiceZoneMapping, verifyServiceZoneMapping,
  activateServiceZoneMapping, deactivateServiceZoneMapping,
  listPackageCategoryMappings, createPackageCategoryMapping, verifyPackageCategoryMapping,
  activatePackageCategoryMapping, deactivatePackageCategoryMapping,
  updateWarehouseMapping, updateServiceZoneMapping, updatePackageCategoryMapping,
} from "./logistics-admin.controller.js";

const router = Router();
router.use(authenticate, authorize("ADMIN"));

router.get("/warehouse-mappings", validateQuery(mappingListQuerySchema), listWarehouseMappings);
router.post("/warehouse-mappings", validateBody(mappingCreateSchema), createWarehouseMapping);
router.patch("/warehouse-mappings/:id", validateParams(mappingIdParamSchema), validateBody(warehouseMappingUpdateSchema), updateWarehouseMapping);
router.post("/warehouse-mappings/:id/verify", validateParams(mappingIdParamSchema), validateBody(mappingVerificationSchema), verifyWarehouseMapping);
router.post("/warehouse-mappings/:id/activate", validateParams(mappingIdParamSchema), activateWarehouseMapping);
router.post("/warehouse-mappings/:id/deactivate", validateParams(mappingIdParamSchema), deactivateWarehouseMapping);

router.patch("/warehouses/:id/coordinates", validateParams(mappingIdParamSchema), validateBody(coordinateVerificationSchema), verifyWarehouseCoordinates);
router.get("/service-zone-mappings", validateQuery(logisticsMappingListQuerySchema), listServiceZoneMappings);
router.post("/service-zone-mappings", validateBody(serviceZoneMappingCreateSchema), createServiceZoneMapping);
router.patch("/service-zone-mappings/:id", validateParams(logisticsMappingIdParamSchema), validateBody(serviceZoneMappingUpdateSchema), updateServiceZoneMapping);
router.post("/service-zone-mappings/:id/verify", validateParams(logisticsMappingIdParamSchema), validateBody(mappingVerificationSchema), verifyServiceZoneMapping);
router.post("/service-zone-mappings/:id/activate", validateParams(logisticsMappingIdParamSchema), activateServiceZoneMapping);
router.post("/service-zone-mappings/:id/deactivate", validateParams(logisticsMappingIdParamSchema), deactivateServiceZoneMapping);

router.get("/package-category-mappings", validateQuery(logisticsMappingListQuerySchema), listPackageCategoryMappings);
router.post("/package-category-mappings", validateBody(packageCategoryMappingCreateSchema), createPackageCategoryMapping);
router.patch("/package-category-mappings/:id", validateParams(logisticsMappingIdParamSchema), validateBody(packageCategoryMappingUpdateSchema), updatePackageCategoryMapping);
router.post("/package-category-mappings/:id/verify", validateParams(logisticsMappingIdParamSchema), validateBody(mappingVerificationSchema), verifyPackageCategoryMapping);
router.post("/package-category-mappings/:id/activate", validateParams(logisticsMappingIdParamSchema), activatePackageCategoryMapping);
router.post("/package-category-mappings/:id/deactivate", validateParams(logisticsMappingIdParamSchema), deactivatePackageCategoryMapping);

router.patch("/addresses/:id/coordinates", validateParams(addressIdParamSchema), validateBody(coordinateVerificationSchema), verifyAddressCoordinates);

export default router;
