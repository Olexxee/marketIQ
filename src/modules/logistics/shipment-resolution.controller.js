import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  getBuyerShipmentResolutionService,
  requestBuyerShipmentCancellationService,
} from "./shipment-resolution.service.js";

export const requestBuyerShipmentCancellation = asyncWrapper(async (req, res) => {
  const result = await requestBuyerShipmentCancellationService(
    req.user.id,
    req.params.sellerOrderId,
    req.body,
  );
  return successResponse({
    res,
    statusCode: result.replay ? 200 : 202,
    message: result.replay ? "Existing cancellation or return request retrieved" : "Cancellation or return request accepted for processing",
    data: result,
  });
});

export const getBuyerShipmentResolution = asyncWrapper(async (req, res) => {
  const result = await getBuyerShipmentResolutionService(req.user.id, req.params.sellerOrderId);
  return successResponse({ res, statusCode: 200, message: "Shipment resolution request retrieved", data: result });
});
