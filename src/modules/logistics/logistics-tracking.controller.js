import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import { getShipmentTrackingService } from "./logistics-tracking.service.js";

export const getShipmentTracking = asyncWrapper(async (req, res) => {
  const tracking = await getShipmentTrackingService(req.user.id, req.params.sellerOrderId);
  return successResponse({
    res,
    statusCode: 200,
    message: "Shipment tracking retrieved",
    data: tracking,
  });
});
