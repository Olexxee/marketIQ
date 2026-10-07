// Shared scoring helpers for every market signal.

export const MAX_SCORE = 100;

export const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const round = (value, digits = 2) => Number(value.toFixed(digits));

/** Scales `value` against a cap onto a 0..100 range. */
export const normalize = (value, max) => {
  if (!max || max <= 0) return 0;
  return Math.min((value / max) * MAX_SCORE, MAX_SCORE);
};

/**
 * Weighted 0..100 score. Every key in `weights` is normalized against the
 * matching key in `maxima`, then multiplied by its weight.
 */
export const weightedScore = (metrics, { maxima, weights }) => {
  let score = 0;

  for (const [key, weight] of Object.entries(weights)) {
    score += normalize(toNumber(metrics[key]), maxima[key]) * weight;
  }

  return round(clamp(score, 0, MAX_SCORE));
};

const assertWeightsSumToOne = (name, weights) => {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);

  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`${name} weights must sum to 1 (got ${total})`);
  }
};

const assertWeightsHaveMaxima = (name, weights, maxima) => {
  const missing = Object.keys(weights).filter(
    (key) => maxima[key] === undefined,
  );

  if (missing.length) {
    throw new Error(
      `${name} weights reference keys with no maxima: ${missing.join(", ")}`,
    );
  }
};

/**
 * Builds the score + metrics functions for a demand signal from config.
 * - metricKeys: the fields stored on the signal
 * - maxima / weights: only the scored fields need entries
 */
export const createDemandSignal = ({ name, metricKeys, maxima, weights }) => {
  assertWeightsSumToOne(name, weights);
  assertWeightsHaveMaxima(name, weights, maxima);

  const defaults = {
    maxima: Object.freeze(maxima),
    weights: Object.freeze(weights),
  };

  const calculateScore = (metrics, options = {}) =>
    weightedScore(metrics, { ...defaults, ...options });

  const buildMetrics = (input = {}, options = {}) => {
    const metrics = Object.fromEntries(
      metricKeys.map((key) => [key, toNumber(input[key])]),
    );

    return { ...metrics, demandScore: calculateScore(metrics, options) };
  };

  return { calculateScore, buildMetrics };
};

