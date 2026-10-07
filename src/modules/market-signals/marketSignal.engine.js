import {
  getAvailableSupply,
  getDemandActivity,
  getGeographicDemandActivity,
} from "./marketActivity.analytics.db.js";
import { buildProductDemandMetrics } from "./signals/productDemand.signal.js";
import { buildCategoryDemandMetrics } from "./signals/categoryDemand.signal.js";
import { buildGeographicDemandMetrics } from "./signals/geographicDemand.signal.js";
import { buildSupplyDemandOpportunityMetrics } from "./signals/supplyDemandOpportunity.signal.js";
import { qualifiesAsOpportunity } from "./signals/supplyDemandOpportunity.signal.js";
import {
  saveCategoryDemandSignal,
  saveGeographicDemandSignal,
  saveProductDemandSignal,
  saveSupplyDemandOpportunitySignal,
} from "./marketSignal.service.js";

// ============================================================
// DEMAND
// Optional location ids narrow both the activity that is counted and the
// scope the signal is stored under.
// ============================================================

export const generateProductDemandSignal = async ({
  productId,
  windowStart,
  windowEnd,
  ...geo
}) => {
  const activity = await getDemandActivity({
    productId,
    windowStart,
    windowEnd,
    ...geo,
  });

  return saveProductDemandSignal({
    productId,
    windowStart,
    windowEnd,
    ...geo,
    metrics: buildProductDemandMetrics(activity),
  });
};

export const generateCategoryDemandSignal = async ({
  categoryId,
  windowStart,
  windowEnd,
  ...geo
}) => {
  const activity = await getDemandActivity({
    categoryId,
    windowStart,
    windowEnd,
    ...geo,
  });

  return saveCategoryDemandSignal({
    categoryId,
    windowStart,
    windowEnd,
    ...geo,
    metrics: buildCategoryDemandMetrics(activity),
  });
};

export const generateGeographicDemandSignal = async ({
  countryId = null,
  stateId = null,
  lgaId = null,
  cityId = null,
  windowStart,
  windowEnd,
}) => {
  const entityId = cityId ?? lgaId ?? stateId ?? countryId;

  if (!entityId) {
    throw new Error("At least one geographic identifier is required");
  }

  const activity = await getGeographicDemandActivity({
    countryId,
    stateId,
    lgaId,
    cityId,
    windowStart,
    windowEnd,
  });

  return saveGeographicDemandSignal({
    entityId,
    countryId,
    stateId,
    lgaId,
    cityId,
    windowStart,
    windowEnd,
    metrics: buildGeographicDemandMetrics(activity),
  });
};

// ============================================================
// SUPPLY / DEMAND OPPORTUNITY
// Demand comes from the same activity + scoring as the demand signals.
// Supply is the current available stock.
// ============================================================

const OPPORTUNITY_ENTITIES = {
  PRODUCT: {
    scopeField: "productId",
    buildDemandMetrics: buildProductDemandMetrics,
  },
  CATEGORY: {
    scopeField: "categoryId",
    buildDemandMetrics: buildCategoryDemandMetrics,
  },
};

export const generateSupplyDemandOpportunitySignal = async ({
  entityType,
  entityId,
  windowStart,
  windowEnd,
}) => {
  const config = OPPORTUNITY_ENTITIES[entityType];

  if (!config) {
    throw new Error(`Unsupported opportunity entity type: ${entityType}`);
  }

  if (!entityId) {
    throw new Error("Supply/demand opportunity entity ID is required");
  }

  const scope = { [config.scopeField]: entityId };

  const [activity, availableUnits] = await Promise.all([
    getDemandActivity({ ...scope, windowStart, windowEnd }),
    getAvailableSupply(scope),
  ]);

  const metrics = buildSupplyDemandOpportunityMetrics({
    demand: config.buildDemandMetrics(activity),
    availableUnits,
  });

  if (!qualifiesAsOpportunity(metrics)) {
    // Below threshold: do not persist. Reported by batch as "skipped".
    return null;
  }

  return saveSupplyDemandOpportunitySignal({
    entityType,
    entityId,
    windowStart,
    windowEnd,
    metrics,
  });
};