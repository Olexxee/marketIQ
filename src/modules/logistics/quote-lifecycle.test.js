import test from "node:test";
import assert from "node:assert/strict";
import { isQuoteOptionActiveAt } from "./quote-lifecycle.js";

const now = new Date("2026-11-07T16:00:00.000Z");

test("accepts a quote and option only while both expiries are in the future", () => {
  assert.equal(isQuoteOptionActiveAt({
    quoteExpiresAt: "2026-11-07T17:00:00.000Z",
    optionExpiresAt: "2026-11-07T16:30:00.000Z",
  }, now), true);
});

test("rejects quote or option expiry at the exact current instant", () => {
  assert.equal(isQuoteOptionActiveAt({
    quoteExpiresAt: now,
  }, now), false);
  assert.equal(isQuoteOptionActiveAt({
    quoteExpiresAt: "2026-11-07T17:00:00.000Z",
    optionExpiresAt: now,
  }, now), false);
});

test("rejects invalid expiry timestamps and supports options without separate expiry", () => {
  assert.equal(isQuoteOptionActiveAt({ quoteExpiresAt: "invalid" }, now), false);
  assert.equal(isQuoteOptionActiveAt({
    quoteExpiresAt: "2026-11-07T17:00:00.000Z",
    optionExpiresAt: null,
  }, now), true);
});
