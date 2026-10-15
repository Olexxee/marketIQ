import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import {
  getMarketActivitiesService,
  recordPublicMarketActivity,
} from "./marketActivity.service.js";

export const recordPublicMarketActivityController = asyncWrapper(async (req, res) => {
  const activity = await recordPublicMarketActivity(req.validated?.body || req.body);

  return successResponse({
    res,
    statusCode: 201,
    message: "Market activity recorded",
    data: {
      id: activity.id,
      activityType: activity.activityType,
      createdAt: activity.createdAt,
    },
  });
});

export const getMarketActivitiesController = asyncWrapper(async (req, res) => {
  const result = await getMarketActivitiesService(req.validated?.query || req.query);

  return successResponse({
    res,
    statusCode: 200,
    message: "Market activity retrieved successfully",
    data: result.items,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
});
