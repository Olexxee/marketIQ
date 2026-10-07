import { createDemandSignal } from "./scoring.js";

const { calculateScore, buildMetrics } = createDemandSignal({
  name: "categoryDemand",
  metricKeys: [
    "cartAdds",
    "inventoryReserved",
    "inventoryCommitted",
    "uniqueInterestedUsers",
    "uniqueBuyers",
  ],
  maxima: {
    cartAdds: 500,
    inventoryReserved: 375,
    inventoryCommitted: 250,
    uniqueBuyers: 250,
  },
  weights: {
    cartAdds: 0.3,
    inventoryReserved: 0.2,
    inventoryCommitted: 0.3,
    uniqueBuyers: 0.2,
  },
});

export const calculateCategoryDemandScore = calculateScore;
export const buildCategoryDemandMetrics = buildMetrics;
