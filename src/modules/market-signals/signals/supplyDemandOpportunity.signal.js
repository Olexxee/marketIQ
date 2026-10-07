import { MAX_SCORE, clamp, round, toNumber } from "./scoring.js";

export const SUPPLY_DEMAND_THRESHOLDS = Object.freeze({
  minDemandUnits: 5,
  minOpportunityScore: 15,
});

export const qualifiesAsOpportunity = (
  metrics,
  thresholds = SUPPLY_DEMAND_THRESHOLDS,
) => {
  const demandUnits = toNumber(metrics?.demandUnits);
  const opportunityScore = toNumber(metrics?.opportunityScore);

  return (
    demandUnits >= thresholds.minDemandUnits &&
    opportunityScore >= thresholds.minOpportunityScore
  );
};

export const buildSupplyDemandOpportunityMetrics = ({
  demand = {},
  availableUnits = 0,
}) => {
  const cartAdds = toNumber(demand.cartAdds);
  const inventoryCommitted = toNumber(demand.inventoryCommitted);
  const uniqueBuyers = toNumber(demand.uniqueBuyers);
  const demandScore = clamp(toNumber(demand.demandScore), 0, MAX_SCORE);
  const available = Math.max(toNumber(availableUnits), 0);

  const demandUnits = Math.max(cartAdds, inventoryCommitted);
  const supplyGap = Math.max(demandUnits - available, 0);

  const coverage = demandUnits > 0 ? Math.min(available / demandUnits, 1) : 1;
  const supplyScarcity = round((1 - coverage) * MAX_SCORE);

  let supplyDemandRatio = 0;
  if (available > 0) supplyDemandRatio = round(demandUnits / available, 4);
  else if (demandUnits > 0) supplyDemandRatio = null;

  const opportunityScore = round(
    clamp((demandScore * supplyScarcity) / MAX_SCORE, 0, MAX_SCORE),
  );

  return {
    cartAdds,
    inventoryCommitted,
    uniqueBuyers,
    demandUnits,
    demandScore,
    availableUnits: available,
    supplyGap,
    supplyDemandRatio,
    supplyScarcity,
    opportunityScore,
  };
};
