import { createDemandSignal } from "./scoring.js";

const { calculateScore, buildMetrics } = createDemandSignal({
  name: "productDemand",
  metricKeys: [
    "cartAdds",
    "inventoryReserved",
    "inventoryCommitted",
    "uniqueInterestedUsers",
    "uniqueBuyers",
  ],
  maxima: {
    cartAdds: 100,
    inventoryReserved: 75,
    inventoryCommitted: 50,
    uniqueBuyers: 50,
  },
  weights: {
    cartAdds: 0.3,
    inventoryReserved: 0.2,
    inventoryCommitted: 0.3,
    uniqueBuyers: 0.2,
  },
});

export const calculateProductDemandScore = calculateScore;
export const buildProductDemandMetrics = buildMetrics;
