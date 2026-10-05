import {
  createMarketActivity,
  findMarketActivities,
} from "./marketActivity.db.js";

import { BadRequestError } from "../../classes/errorClasses.js";

// ============================================================
// RECORD ACTIVITY
// ============================================================

export const recordMarketActivity = async (
  {
    activityType,
    userId = null,

    productId = null,
    variantId = null,
    sellerId = null,
    categoryId = null,
    brandId = null,
    collectionId = null,

    countryId = null,
    stateId = null,
    lgaId = null,
    cityId = null,

    quantity = null,
    metadata = null,
  },
  tx,
) => {
  if (!activityType) {
    throw new BadRequestError("Activity type is required");
  }

  if (quantity !== null) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestError("Activity quantity must be a positive integer");
    }
  }

  return createMarketActivity(
    {
      activityType,

      userId,

      productId,
      variantId,
      sellerId,
      categoryId,
      brandId,
      collectionId,

      countryId,
      stateId,
      lgaId,
      cityId,

      quantity,
      metadata,
    },
    tx,
  );
};

// ============================================================
// LIST ACTIVITY
// ============================================================

export const getMarketActivitiesService = async (filters) => {
  return findMarketActivities(filters);
};
