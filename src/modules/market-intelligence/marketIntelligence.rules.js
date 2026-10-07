const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

export const getSeverity = (score) => {
  const value = toNumber(score);

  if (value >= 85) return "CRITICAL";
  if (value >= 70) return "HIGH";
  if (value >= 50) return "MEDIUM";

  return "LOW";
};

export const calculateConfidence = ({
  demandScore = 0,
  supplyScore = 0,
  opportunityScore = 0,
}) => {
  const values = [
    toNumber(demandScore),
    toNumber(supplyScore),
    toNumber(opportunityScore),
  ];

  const confidence =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return Number(Math.min(Math.max(confidence / 100, 0), 1).toFixed(2));
};
