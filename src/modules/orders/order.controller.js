import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import { successResponse } from "../../lib/response.js";

import {
  cancelBuyerOrderService,
  confirmBuyerOrderService,
  disputeBuyerOrderService,
  getBuyerOrderService,
  getSellerOrderService,
  listBuyerOrdersService,
  listSellerOrdersService,
  updateSellerOrderStatusService,
} from "./order.service.js";

// ============================================================
// BUYER
// ============================================================

export const listBuyerOrders = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listBuyerOrdersService(req.user.id, {
    ...req.query,
    pagination: { page, limit, skip, take },
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Orders retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getBuyerOrder = asyncWrapper(async (req, res) => {
  const order = await getBuyerOrderService(req.user.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Order retrieved successfully",
    data: order,
  });
});

export const cancelBuyerOrder = asyncWrapper(async (req, res) => {
  const order = await cancelBuyerOrderService(
    req.user.id,
    req.params.id,
    req.body?.notes,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Order cancelled successfully",
    data: order,
  });
});

export const confirmBuyerOrder = asyncWrapper(async (req, res) => {
  const order = await confirmBuyerOrderService(req.user.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Order confirmed successfully",
    data: order,
  });
});

// ============================================================
// SELLER
// ============================================================

export const listSellerOrders = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);

  const { items, total } = await listSellerOrdersService(req.seller.id, {
    ...req.query,
    pagination: { page, limit, skip, take },
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Seller orders retrieved successfully",
    data: items,
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

export const getSellerOrder = asyncWrapper(async (req, res) => {
  const sellerOrder = await getSellerOrderService(req.seller.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Seller order retrieved successfully",
    data: sellerOrder,
  });
});

export const updateSellerOrderStatus = asyncWrapper(async (req, res) => {
  const sellerOrder = await updateSellerOrderStatusService(
    req.seller.id,
    req.params.id,
    req.body.status,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Seller order status updated",
    data: sellerOrder,
  });
});


export const disputeBuyerOrder = asyncWrapper(async (req, res) => {
  const order = await disputeBuyerOrderService(
    req.user.id,
    req.params.id,
    req.body.notes,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Order dispute submitted successfully",
    data: order,
  });
});
