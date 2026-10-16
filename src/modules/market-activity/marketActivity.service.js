import {
  createMarketActivity,
  findActiveCategoryActivityTarget,
  findActiveSellerActivityTarget,
  findMarketActivities,
  findPublicProductActivityTarget,
} from "./marketActivity.db.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../classes/errorClasses.js";

const DISCOVERY_ACTIVITY_TYPES = new Set([
  "PRODUCT_VIEW",
  "PRODUCT_SEARCH",
  "CATEGORY_VIEW",
  "SELLER_VIEW",
]);

// ============================================================
// INTERNAL RECORDING
// Reusable by trusted marketplace services. Pass tx when the event
// must commit or roll back with the business operation.
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
  if (!activityType) throw new BadRequestError("Activity type is required");

  if (quantity !== null && (!Number.isInteger(quantity) || quantity <= 0)) {
    throw new BadRequestError("Activity quantity must be a positive integer");
  }

  return createMarketActivity({
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
  }, tx);
};

// ============================================================
// PUBLIC DISCOVERY EVENT
// The public endpoint accepts only discovery events and derives related
// entities from active catalog records. It never accepts actor IDs,
// location IDs, quantities, or arbitrary metadata from the client.
// ============================================================

export const recordPublicMarketActivity = async (payload) => {
  const { activityType } = payload;

  if (!DISCOVERY_ACTIVITY_TYPES.has(activityType)) {
    throw new BadRequestError("This activity type cannot be recorded through the public endpoint");
  }

  if (activityType === "PRODUCT_SEARCH") {
    const searchTerm = payload.searchTerm.trim().replace(/\s+/g, " ").slice(0, 120);
    return recordMarketActivity({
      activityType,
      metadata: { searchTerm },
    });
  }

  if (activityType === "PRODUCT_VIEW") {
    const product = await findPublicProductActivityTarget(payload.productId);
    if (!product) throw new NotFoundError("Public product not found");

    return recordMarketActivity({
      activityType,
      productId: product.id,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      collectionId: product.collectionId,
    });
  }

  if (activityType === "CATEGORY_VIEW") {
    const category = await findActiveCategoryActivityTarget(payload.categoryId);
    if (!category) throw new NotFoundError("Active product category not found");

    return recordMarketActivity({
      activityType,
      categoryId: category.id,
    });
  }

  if (activityType === "SELLER_VIEW") {
    const seller = await findActiveSellerActivityTarget(payload.sellerId);
    if (!seller) throw new NotFoundError("Active seller not found");

    return recordMarketActivity({
      activityType,
      sellerId: seller.id,
    });
  }

  throw new BadRequestError("Unsupported market activity type");
};

// ============================================================
// ADMIN / INTELLIGENCE READ
// ============================================================

export const getMarketActivitiesService = async (filters) => {
  if (filters.from && filters.to && filters.from > filters.to) {
    throw new BadRequestError("'from' must be earlier than or equal to 'to'");
  }

  return findMarketActivities(filters);
};
