import {
  getCommercialDemandActivity,
  getCommercialGeographicDemandActivity,
  getCommercialGeographicUniqueCategories,
} from "./commercialActivity.analytics.db.js";

export const getProductDemandActivity = async (params) => {
  return getCommercialDemandActivity(params);
};

export const getCategoryDemandActivity = async (params) => {
  return getCommercialDemandActivity(params);
};

export const getGeographicDemandActivity = async (params) => {
  const [activity, uniqueCategories] = await Promise.all([
    getCommercialGeographicDemandActivity(params),

    getCommercialGeographicUniqueCategories(params),
  ]);

  return {
    ...activity,
    uniqueCategories,
  };
};
