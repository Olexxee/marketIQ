import { NotFoundError } from "../../classes/errorClasses.js";
import {
  countMarketSignals,
  findMarketSignalById,
  findMarketSignals,
  upsertMarketSignal,
} from "./marketSignal.db.js";
import { buildScopeKey } from "./marketSignal.scope.js";

const buildPaginationMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit) || 0,
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});

// ============================================================
// WRITE
// ============================================================

const saveSignal = async ({
  signalType,
  entityType,
  entityId,
  scoreKey,
  countryId = null,
  stateId = null,
  lgaId = null,
  cityId = null,
  windowStart,
  windowEnd,
  metrics,
}) => {
  if (!entityType) throw new Error("Signal entity type is required");
  if (!entityId) throw new Error(`${entityType.toLowerCase()} ID is required`);
  if (!windowStart || !windowEnd) throw new Error("Signal window is required");

  if (!metrics || typeof metrics !== "object") {
    throw new Error("Signal metrics must be an object");
  }

  if (metrics[scoreKey] === undefined) {
    throw new Error(`Signal metrics missing required score "${scoreKey}"`);
  }

  return upsertMarketSignal({
    signalType,
    entityType,
    entityId,
    scopeKey: buildScopeKey({ countryId, stateId, lgaId, cityId }),
    windowStart,
    windowEnd,
    data: {
      countryId,
      stateId,
      lgaId,
      cityId,
      metrics,
      score: Number(metrics[scoreKey] ?? 0),
    },
  });
};

export const saveProductDemandSignal = ({ productId, ...rest }) =>
  saveSignal({
    signalType: "PRODUCT_DEMAND",
    entityType: "PRODUCT",
    entityId: productId,
    scoreKey: "demandScore",
    ...rest,
  });

export const saveCategoryDemandSignal = ({ categoryId, ...rest }) =>
  saveSignal({
    signalType: "CATEGORY_DEMAND",
    entityType: "CATEGORY",
    entityId: categoryId,
    scoreKey: "demandScore",
    ...rest,
  });

export const saveGeographicDemandSignal = ({ entityId, ...rest }) =>
  saveSignal({
    signalType: "GEOGRAPHIC_DEMAND",
    entityType: "LOCATION",
    entityId,
    scoreKey: "demandScore",
    ...rest,
  });

export const saveSupplyDemandOpportunitySignal = ({
  entityType,
  entityId,
  ...rest
}) =>
  saveSignal({
    signalType: "SUPPLY_DEMAND_OPPORTUNITY",
    entityType,
    entityId,
    scoreKey: "opportunityScore",
    ...rest,
  });

// ============================================================
// READ
// ============================================================

export const getMarketSignals = async (query) => {
  const { page = 1, limit = 50, ...filters } = query;
  const skip = (page - 1) * limit;

  const [signals, total] = await Promise.all([
    findMarketSignals(filters, { skip, take: limit }),
    countMarketSignals(filters),
  ]);

  return {
    signals,
    pagination: buildPaginationMeta({ page, limit, total }),
  };
};

export const getMarketSignalById = async (id) => {
  const signal = await findMarketSignalById(id);
  if (!signal) throw new NotFoundError("Market signal not found");
  return signal;
};
