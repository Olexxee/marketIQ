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

const WEIGHT_MULTIPLIERS = Object.freeze({ KG: 1000, G: 1 });
const DIMENSION_MULTIPLIERS = Object.freeze({ CM: 10, MM: 1 });

/**
 * Normalize seller-declared package measurements to the Logistic Hub API units.
 * Legacy records without explicit units/source are deliberately rejected.
 */
export const normalizeVariantMeasurements = variant => {
  if (!variant || !["SELLER_DECLARED", "PLATFORM_MEASURED", "HUB_MEASURED"].includes(variant.measurementSource)) {
    throw new ConflictError("Product package measurements must have a verified measurement source before requesting a delivery quote.");
  }

  const weightMultiplier = WEIGHT_MULTIPLIERS[variant.weightUnit];
  const dimensionMultiplier = DIMENSION_MULTIPLIERS[variant.dimensionUnit];
  if (!weightMultiplier || !dimensionMultiplier) {
    throw new ConflictError("Product package measurements must declare supported weight and dimension units.");
  }

  const weightGrams = scaleMeasurementCeil(variant.weight, weightMultiplier, "weight");
  const lengthMm = scaleMeasurementCeil(variant.length, dimensionMultiplier, "length");
  const widthMm = scaleMeasurementCeil(variant.width, dimensionMultiplier, "width");
  const heightMm = scaleMeasurementCeil(variant.height, dimensionMultiplier, "height");

  if ([weightGrams, lengthMm, widthMm, heightMm].some(value => !Number.isSafeInteger(value) || value <= 0)) {
    throw new ConflictError("Physical products require positive package weight, length, width and height before requesting a delivery quote.");
  }

  return { weightGrams, lengthMm, widthMm, heightMm };
};
