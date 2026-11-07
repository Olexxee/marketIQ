/**
 * A quote and its selected option are usable only while both expiry windows
 * are strictly in the future. Invalid timestamps fail closed.
 */
export const isQuoteOptionActiveAt = ({ quoteExpiresAt, optionExpiresAt }, now = new Date()) => {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const quoteMs = new Date(quoteExpiresAt).getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(quoteMs) || quoteMs <= nowMs) return false;

  if (optionExpiresAt !== undefined && optionExpiresAt !== null) {
    const optionMs = new Date(optionExpiresAt).getTime();
    if (!Number.isFinite(optionMs) || optionMs <= nowMs) return false;
  }
  return true;
};
