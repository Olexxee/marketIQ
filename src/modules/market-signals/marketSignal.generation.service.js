import {
  getActiveDemandLocations,
  getCategoriesWithDemandActivity,
  getProductsWithDemandActivity,
} from "./marketActivity.analytics.db.js";
import {
  generateCategoryDemandSignal,
  generateGeographicDemandSignal,
  generateProductDemandSignal,
  generateSupplyDemandOpportunitySignal,
} from "./marketSignal.engine.js";
import { runSignalBatch } from "./marketSignal.batch.js";
import { getLastDaysWindow } from "./marketSignal.window.js";

const DEFAULT_CONCURRENCY = 5;

// ============================================================
// DEMAND
// ============================================================

export const generateProductDemandSignals = async ({
  windowStart,
  windowEnd,
  concurrency = DEFAULT_CONCURRENCY,
}) => {
  const productIds = await getProductsWithDemandActivity({
    windowStart,
    windowEnd,
  });

  return runSignalBatch({
    label: "product demand",
    items: productIds,
    concurrency,
    worker: (productId) =>
      generateProductDemandSignal({ productId, windowStart, windowEnd }),
  });
};

export const generateCategoryDemandSignals = async ({
  windowStart,
  windowEnd,
  concurrency = DEFAULT_CONCURRENCY,
}) => {
  const categoryIds = await getCategoriesWithDemandActivity({
    windowStart,
    windowEnd,
  });

  return runSignalBatch({
    label: "category demand",
    items: categoryIds,
    concurrency,
    worker: (categoryId) =>
      generateCategoryDemandSignal({ categoryId, windowStart, windowEnd }),
  });
};

export const generateGeographicDemandSignals = async ({
  windowStart,
  windowEnd,
  concurrency = DEFAULT_CONCURRENCY,
}) => {
  const locations = await getActiveDemandLocations({ windowStart, windowEnd });

  return runSignalBatch({
    label: "geographic demand",
    items: locations,
    concurrency,
    worker: ({ countryId, stateId, lgaId, cityId }) =>
      generateGeographicDemandSignal({
        countryId,
        stateId,
        lgaId,
        cityId,
        windowStart,
        windowEnd,
      }),
  });
};

// ============================================================
// SUPPLY / DEMAND OPPORTUNITY
// Only products and categories that had demand activity are scored:
// no demand means an opportunity score of 0 anyway.
// ============================================================

const generateOpportunitySignals = async ({
  entityType,
  listEntityIds,
  windowStart,
  windowEnd,
  concurrency,
}) => {
  const entityIds = await listEntityIds({ windowStart, windowEnd });

  return runSignalBatch({
    label: `${entityType.toLowerCase()} supply/demand opportunity`,
    items: entityIds,
    concurrency,
    worker: (entityId) =>
      generateSupplyDemandOpportunitySignal({
        entityType,
        entityId,
        windowStart,
        windowEnd,
      }),
  });
};

export const generateProductSupplyDemandOpportunitySignals = ({
  windowStart,
  windowEnd,
  concurrency = DEFAULT_CONCURRENCY,
}) =>
  generateOpportunitySignals({
    entityType: "PRODUCT",
    listEntityIds: getProductsWithDemandActivity,
    windowStart,
    windowEnd,
    concurrency,
  });

export const generateCategorySupplyDemandOpportunitySignals = ({
  windowStart,
  windowEnd,
  concurrency = DEFAULT_CONCURRENCY,
}) =>
  generateOpportunitySignals({
    entityType: "CATEGORY",
    listEntityIds: getCategoriesWithDemandActivity,
    windowStart,
    windowEnd,
    concurrency,
  });

// ============================================================
// ORCHESTRATION
// Families run one after another so database work never exceeds
// `concurrency` parallel queries.
// ============================================================

export const generateAllSignals = async ({
  days = 7,
  concurrency = DEFAULT_CONCURRENCY,
  alignToDayBoundary = true,
} = {}) => {
  const { windowStart, windowEnd } = getLastDaysWindow(days, {
    alignToDayBoundary,
  });
  const args = { windowStart, windowEnd, concurrency };

  const productDemand = await generateProductDemandSignals(args);
  const categoryDemand = await generateCategoryDemandSignals(args);
  const geographicDemand = await generateGeographicDemandSignals(args);

  const supplyDemandOpportunity = {
    products: await generateProductSupplyDemandOpportunitySignals(args),
    categories: await generateCategorySupplyDemandOpportunitySignals(args),
  };

  return {
    windowStart,
    windowEnd,
    days,
    productDemand,
    categoryDemand,
    geographicDemand,
    supplyDemandOpportunity,
  };
};

// Kept so existing callers (cron jobs, controllers) keep working.
export const generateAllDemandSignals = generateAllSignals;

export const generateProductDemand7DaySignals = () =>
  generateAllSignals({ days: 7 });
