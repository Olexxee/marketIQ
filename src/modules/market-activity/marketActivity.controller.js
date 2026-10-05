import {
  getMarketActivitiesService,
  recordMarketActivity,
} from "./marketActivity.service.js";

export const recordMarketActivityController = async (req, res) => {
  const activity = await recordMarketActivity({
    ...req.body,
    userId: req.user?.id || null,
  });

  return res.status(201).json({
    success: true,
    message: "Market activity recorded",
    data: activity,
  });
};

export const getMarketActivitiesController = async (req, res) => {
  const result = await getMarketActivitiesService(req.query);

  return res.status(200).json({
    success: true,
    data: result.items,
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
};
