/**
 * Convert a naira decimal string (or Prisma Decimal via toString()) to
 * integer kobo without binary floating-point arithmetic.
 *
 * Numbers are deliberately rejected: precision may already have been lost
 * before this function receives them.
 */
export const toMinorUnits = (value) => {
  if (typeof value !== "string" && typeof value !== "bigint") {
    throw new TypeError("Money must be supplied as a decimal string or bigint");
  }

  const raw = String(value).trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(raw);

  if (!match) {
    throw new RangeError("Money must be a non-negative amount with at most 2 decimal places");
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] || "").padEnd(2, "0") || "0");
  const minor = whole * 100n + fraction;

  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Money amount exceeds the safe integer range");
  }

  return Number(minor);
};


/**
 * Convert integer kobo to a canonical NGN decimal string.
 * BigInt is retained through division to avoid floating-point rounding.
 */
export const fromMinorUnits = (value) => {
  let minor;
  try {
    minor = typeof value === "bigint" ? value : BigInt(value);
  } catch {
    throw new TypeError("Minor units must be an integer or integer string");
  }
  if (minor < 0n) throw new RangeError("Minor units cannot be negative");
  const naira = minor / 100n;
  const kobo = String(minor % 100n).padStart(2, "0");
  return `${naira}.${kobo}`;
};
