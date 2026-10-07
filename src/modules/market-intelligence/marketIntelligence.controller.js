import {
  getMarketIntelligence,
  getMarketIntelligenceById,
} from "./marketIntelligence.service.js";

export const getMarketIntelligenceController = async (req, res) => {
  const result = await getMarketIntelligence(req.validatedQuery);

  return res.status(200).json({
    success: true,
    data: result.intelligence,
    pagination: result.pagination,
  });
};

export const getMarketIntelligenceByIdController = async (req, res) => {
  const intelligence = await getMarketIntelligenceById(req.validatedParams.id);

  return res.status(200).json({
    success: true,
    data: intelligence,
  });
};
