import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  getMarketSignalById,
  getMarketSignals,
} from "./marketSignal.service.js";

export const getMarketSignalsController = asyncWrapper(async (req, res) => {
  const { signals, pagination } = await getMarketSignals(req.query);

  return successResponse({
    res,
    statusCode: 200,
    message: "Market signals retrieved successfully",
    data: signals,
    meta: pagination,
  });
});

export const getMarketSignalByIdController = asyncWrapper(async (req, res) => {
  const signal = await getMarketSignalById(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Market signal retrieved successfully",
    data: signal,
  });
});
