import { generateMarketDemand7DaySignals } from "../modules/market-signals/marketSignal.generation.service.js";

try {
  const result = await generateMarketDemand7DaySignals();

  console.log("[MARKET SIGNALS] 7-day demand generation completed");

  console.log({
    windowStart: result.windowStart,
    windowEnd: result.windowEnd,
    productsProcessed: result.productDemand.processed,
    categoriesProcessed: result.categoryDemand.processed,
    locationsProcessed: result.geographicDemand.processed,
  });

  process.exit(0);
} catch (error) {
  console.error("[MARKET SIGNALS] Demand generation failed:", error);

  process.exit(1);
}
