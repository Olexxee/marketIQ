import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";

import {
  initiatePaymentService,
  listPaymentsForOrderService,
  verifyPaymentService,
} from "./payment.service.js";

export const initiatePayment = asyncWrapper(async (req, res) => {
  const { orderId, callbackUrl } = req.body;

  const result = await initiatePaymentService(req.user.id, orderId, {
    callbackUrl,
  });

  return successResponse({
    res,
    statusCode: 201,
    message: "Payment initialized successfully",
    data: result,
  });
});

export const verifyPayment = asyncWrapper(async (req, res) => {
  const payment = await verifyPaymentService(req.user.id, req.params.reference);

  return successResponse({
    res,
    statusCode: 200,
    message: "Payment verified successfully",
    data: payment,
  });
});

export const listPaymentsForOrder = asyncWrapper(async (req, res) => {
  const payments = await listPaymentsForOrderService(
    req.user.id,
    req.params.orderId,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Payments retrieved successfully",
    data: payments,
  });
});
