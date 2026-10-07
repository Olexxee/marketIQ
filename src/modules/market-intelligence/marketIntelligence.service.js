import { NotFoundError } from "../../classes/errorClasses.js";
import {
  findMarketSignal,
  findMarketSignalById,
} from "../market-signals/marketSignal.db.js";

import {
  upsertMarketIntelligence,
  findMarketIntelligenceById,
  findMarketIntelligence,
} from "./marketIntelligence.db.js";

import { interpretSupplyDemandSignal } from "./marketIntelligence.engine.js";

export const generateIntelligenceFromSignal = async (signal) => {
  const findings = interpretSupplyDemandSignal({
    entityType: signal.entityType,
    entityId: signal.entityId,
    signal,
  });

  const results = [];

  for (const finding of findings) {
    const intelligence = await upsertMarketIntelligence({
      intelligenceType: finding.intelligenceType,

      entityType: finding.entityType,

      entityId: finding.entityId,

      windowStart: signal.windowStart,

      windowEnd: signal.windowEnd,

      data: {
        severity: finding.severity,
        confidence: finding.confidence,
        title: finding.title,
        summary: finding.summary,
        metrics: finding.metrics,
        evidence: finding.evidence,
      },
    });

    results.push(intelligence);
  }

  return results;
};

export const generateIntelligenceForSignalId = async (signalId) => {
  const signal = await findMarketSignalById(signalId);

  if (!signal) {
    throw new NotFoundError("Market signal not found");
  }

  return generateIntelligenceFromSignal(signal);
};

export const getMarketIntelligence = async (query) => {
  const { page = 1, limit = 50, ...filters } = query;

  const skip = (page - 1) * limit;

  const intelligence = await findMarketIntelligence(filters, {
    skip,
    take: limit,
  });

  return {
    intelligence,

    pagination: {
      page,
      limit,
      count: intelligence.length,
    },
  };
};

export const getMarketIntelligenceById = async (id) => {
  const intelligence = await findMarketIntelligenceById(id);

  if (!intelligence) {
    throw new NotFoundError("Market intelligence not found");
  }

  return intelligence;
};
