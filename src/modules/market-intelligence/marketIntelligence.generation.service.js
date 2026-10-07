import { findMarketSignals } from "../market-signals/marketSignal.db.js";
import { generateIntelligenceFromSignal } from "./marketIntelligence.service.js";

export const generateMarketIntelligence = async ({
  windowStart,
  windowEnd,
}) => {
  const signals = await findMarketSignals(
    {
      windowStart,
      windowEnd,
      signalType: "SUPPLY_DEMAND_OPPORTUNITY",
    },
    {
      skip: 0,
      take: 5000,
    },
  );

  let generated = 0;

  for (const signal of signals) {
    const findings = await generateIntelligenceFromSignal(signal);

    generated += findings.length;
  }

  return {
    signalsProcessed: signals.length,
    intelligenceGenerated: generated,
  };
};
