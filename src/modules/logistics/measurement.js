import { ConflictError } from "../../classes/errorClasses.js";

/**
 * Convert a non-negative decimal measurement to an integer API unit.
 * Rounds upward so declared parcel dimensions/weight are never understated.
 */
export const scaleMeasurementCeil = (value, multiplier, label = "measurement") => {
  if (value === null || value === undefined) return undefined;
  const raw = value.toString().trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(raw);
  if (!match) throw new ConflictError(`Product ${label} must be a non-negative decimal measurement.`);
  const fraction = match[2] ?? "";
  const denominator = 10n ** BigInt(fraction.length);
  const numerator = BigInt(match[1]) * BigInt(multiplier) * denominator +
    BigInt(fraction || "0") * BigInt(multiplier);
  const scaled = (numerator + denominator - 1n) / denominator;
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ConflictError(`Product ${label} exceeds the supported parcel measurement range.`);
  }
  return Number(scaled);
};
