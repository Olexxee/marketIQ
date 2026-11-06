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
} from "./logistics-admin.validation.js";
import {
  listWarehouseMappings,
  createWarehouseMapping,
  verifyWarehouseMapping,
  activateWarehouseMapping,
  deactivateWarehouseMapping,
  verifyWarehouseCoordinates,
  verifyAddressCoordinates,
} from "./logistics-admin.controller.js";

const router = Router();
router.use(authenticate, authorize("ADMIN"));

router.get("/warehouse-mappings", validateQuery(mappingListQuerySchema), listWarehouseMappings);
router.post("/warehouse-mappings", validateBody(mappingCreateSchema), createWarehouseMapping);
router.post("/warehouse-mappings/:id/verify", validateParams(mappingIdParamSchema), validateBody(mappingVerificationSchema), verifyWarehouseMapping);
router.post("/warehouse-mappings/:id/activate", validateParams(mappingIdParamSchema), activateWarehouseMapping);
router.post("/warehouse-mappings/:id/deactivate", validateParams(mappingIdParamSchema), deactivateWarehouseMapping);

router.patch("/warehouses/:id/coordinates", validateParams(mappingIdParamSchema), validateBody(coordinateVerificationSchema), verifyWarehouseCoordinates);
router.patch("/addresses/:id/coordinates", validateParams(addressIdParamSchema), validateBody(coordinateVerificationSchema), verifyAddressCoordinates);

export default router;
