import { getLastDaysWindow } from "../modules/market-signals/marketSignal.window.js";
import { generateMarketIntelligence } from "../modules/market-intelligence/marketIntelligence.generation.service.js";

try {
  const { windowStart, windowEnd } = getLastDaysWindow(7);

  const result = await generateMarketIntelligence({
    windowStart,
    windowEnd,
  });

  console.log("[MARKET INTELLIGENCE] Generation completed");

  console.log({
    windowStart,
    windowEnd,
    signalsProcessed: result.signalsProcessed,
    intelligenceGenerated: result.intelligenceGenerated,
  });

  process.exit(0);
} catch (error) {
  console.error("[MARKET INTELLIGENCE] Generation failed:", error);

  process.exit(1);
}
