import { BadRequestError } from "../../classes/errorClasses.js";
import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  createDeliveryQuoteService,
  getDeliveryQuoteService,
  acceptDeliveryQuoteOptionService,
} from "./logistics.service.js";

const requireIdempotencyKey = (req) => {
  const key = req.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new BadRequestError("A valid Idempotency-Key header (8–128 characters) is required.");
  }
  return key;
};


export const createDeliveryQuote = asyncWrapper(async (req, res) => {
  const quote = await createDeliveryQuoteService(req.user.id, req.body, requireIdempotencyKey(req));
  return successResponse({ res, statusCode: 201, message: "Delivery quote options retrieved", data: quote });
});

export const getDeliveryQuote = asyncWrapper(async (req, res) => {
  const quote = await getDeliveryQuoteService(req.user.id, req.params.quoteId);
  return successResponse({ res, statusCode: 200, message: "Delivery quote retrieved", data: quote });
});

export const acceptDeliveryQuoteOption = asyncWrapper(async (req, res) => {
  const quote = await acceptDeliveryQuoteOptionService(req.user.id, req.params.quoteId, req.params.optionId);
  return successResponse({ res, statusCode: 200, message: "Delivery quote option accepted", data: quote });
});
