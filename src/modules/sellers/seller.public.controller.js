import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  getPublicSellerStorefrontService,
  listPublicSellersService,
} from "./seller.public.service.js";

export const getPublicSellerDirectory = asyncWrapper(async (req, res) => {
  const result = await listPublicSellersService(req.query);
  return successResponse({
    res,
    statusCode: 200,
    message: "Seller directory retrieved successfully",
    data: result.items,
    meta: result.meta,
  });
});

export const getPublicSellerStorefront = asyncWrapper(async (req, res) => {
  const seller = await getPublicSellerStorefrontService(req.params.id);
  return successResponse({
    res,
    statusCode: 200,
    message: "Seller storefront retrieved successfully",
    data: seller,
  });
});
