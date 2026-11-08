import { BadRequestError, ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import {
  createBuyerShipmentResolutionRequest,
  findBuyerShipmentResolutionRequest,
} from "./shipment-resolution.db.js";

const normalizeReason = value => {
  if (typeof value !== "string") throw new BadRequestError("A cancellation reason is required.");
  const reason = value.trim();
  if (reason.length < 5 || reason.length > 1000) {
    throw new BadRequestError("The cancellation reason must contain 5–1000 characters.");
  }
  return reason;
};

export const requestBuyerShipmentCancellationService = async (buyerId, sellerOrderId, input) => {
  const result = await createBuyerShipmentResolutionRequest({
    buyerId,
    sellerOrderId,
    reason: normalizeReason(input?.reason),
  });
  if (result.notFound) throw new NotFoundError("A paid, booked Logistic Hub shipment for this order was not found.");
  if (result.conflict) throw new ConflictError("This shipment already has a terminal resolution state.");
  return { ...result.request, replay: result.replay };
};

export const getBuyerShipmentResolutionService = async (buyerId, sellerOrderId) => {
  const result = await findBuyerShipmentResolutionRequest(buyerId, sellerOrderId);
  if (!result) throw new NotFoundError("No cancellation or return request exists for this shipment.");
  return result;
};
