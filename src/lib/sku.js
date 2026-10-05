const RANDOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const randomSegment = (length = 4) => {
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result +=
      RANDOM_ALPHABET[Math.floor(Math.random() * RANDOM_ALPHABET.length)];
  }
  return result;
};

const cleanSegment = (value, max = 6) => {
  if (value === undefined || value === null || value === "") return "";
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, max);
};

/**
 * Build a SKU from ordered segments plus a random tail.
 *
 * generateSku({ segments: ["NK", "TSHIRT", "BLK", "M"] })
 *   -> "NK-TSHIRT-BLK-M-A3F2"
 */
export const generateSku = ({ segments = [], randomLength = 4 } = {}) => {
  const parts = segments.map((s) => cleanSegment(s)).filter(Boolean);

  if (parts.length === 0) {
    parts.push("SKU");
  }

  parts.push(randomSegment(randomLength));

  return parts.join("-");
};

/**
 * Retry SKU generation until existsFn returns null.
 * existsFn(sku) must return the existing row or null.
 */
export const generateUniqueSku = async ({
  segments,
  randomLength = 4,
  existsFn,
  maxAttempts = 10,
}) => {
  for (let i = 0; i < maxAttempts; i += 1) {
    const sku = generateSku({ segments, randomLength });
    const existing = await existsFn(sku);

    if (!existing) return sku;
  }

  throw new Error("Could not generate a unique SKU");
};
