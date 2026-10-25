import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  createFulfillmentService,
  getFulfillmentService,
  listFulfillmentsService,
  updateFulfillmentService,
} from "./fulfillment.service.js";

export const createFulfillment = asyncWrapper(async (req, res) => {
  const fulfillment = await createFulfillmentService(
    req.seller.id,
    req.params.id,
    req.body,
  );

  return successResponse({
    res,
    statusCode: 201,
    message: "Fulfillment created successfully",
    data: fulfillment,
  });
});

export const listFulfillments = asyncWrapper(async (req, res) => {
  const fulfillments = await listFulfillmentsService(
    req.seller.id,
    req.params.id,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Fulfillments retrieved successfully",
    data: fulfillments,
  });
});

export const getFulfillment = asyncWrapper(async (req, res) => {
  const fulfillment = await getFulfillmentService(req.seller.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Fulfillment retrieved successfully",
    data: fulfillment,
  });
});

export const updateFulfillment = asyncWrapper(async (req, res) => {
  const fulfillment = await updateFulfillmentService(
    req.seller.id,
    req.params.id,
    req.body,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Fulfillment updated successfully",
    data: fulfillment,
  });
});
