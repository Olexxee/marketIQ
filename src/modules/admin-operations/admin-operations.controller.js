import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  getDisputeService,
  listDisputesService,
  resolveDisputeService,
  reviewDisputeService,
} from "./admin-operations.service.js";
import {
  listRefundsService,
  processRefundService,
  requestRefundService,
} from "../payments/payment.service.js";

export const listDisputes = asyncWrapper(async (req, res) => {
  const result = await listDisputesService(req.query);
  return successResponse({ res, statusCode: 200, message: "Disputes retrieved", data: result.items, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) } });
});

export const getDispute = asyncWrapper(async (req, res) => {
  const dispute = await getDisputeService(req.params.id);
  return successResponse({ res, statusCode: 200, message: "Dispute retrieved", data: dispute });
});

export const reviewDispute = asyncWrapper(async (req, res) => {
  const dispute = await reviewDisputeService(req.user.id, req.params.id);
  return successResponse({ res, statusCode: 200, message: "Dispute assigned for review", data: dispute });
});

export const resolveDispute = asyncWrapper(async (req, res) => {
  const result = await resolveDisputeService(req.user.id, req.params.id, req.body);
  return successResponse({ res, statusCode: 200, message: "Dispute resolution recorded", data: result });
});

export const listRefunds = asyncWrapper(async (req, res) => {
  const result = await listRefundsService(req.query);
  return successResponse({ res, statusCode: 200, message: "Refunds retrieved", data: result.items, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: Math.ceil(result.total / result.limit) } });
});

export const requestRefund = asyncWrapper(async (req, res) => {
  const refund = await requestRefundService(req.user.id, { ...req.body, orderId: req.params.orderId });
  return successResponse({ res, statusCode: 201, message: "Refund request created", data: refund });
});

export const processRefund = asyncWrapper(async (req, res) => {
  const refund = await processRefundService(req.user.id, req.params.id);
  return successResponse({ res, statusCode: 200, message: "Refund processing requested", data: refund });
});
