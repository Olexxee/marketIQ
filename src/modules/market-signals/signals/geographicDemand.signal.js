import { createDemandSignal } from "./scoring.js";

const { calculateScore, buildMetrics } = createDemandSignal({
  name: "geographicDemand",
  metricKeys: [
    "cartAdds",
    "inventoryCommitted",
    "uniqueInterestedUsers",
    "uniqueBuyers",
    "uniqueCategories",
  ],
  maxima: {
    cartAdds: 500,
    inventoryCommitted: 250,
    uniqueBuyers: 250,
    uniqueCategories: 20,
  },
  weights: {
    cartAdds: 0.3,
    inventoryCommitted: 0.4,
    uniqueBuyers: 0.2,
    uniqueCategories: 0.1,
  },
});

export const calculateGeographicDemandScore = calculateScore;
export const buildGeographicDemandMetrics = buildMetrics;
