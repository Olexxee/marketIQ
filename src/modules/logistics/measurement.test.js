import test from "node:test";
import assert from "node:assert/strict";
import { scaleMeasurementCeil } from "./measurement.js";

test("converts kg to grams without floating-point arithmetic", () => {
  assert.equal(scaleMeasurementCeil("1.234", 1000, "weight"), 1234);
  assert.equal(scaleMeasurementCeil("0.001", 1000, "weight"), 1);
});

test("rounds dimensions upward when source precision is finer than millimetres", () => {
  assert.equal(scaleMeasurementCeil("10.2", 10, "length"), 102);
  assert.equal(scaleMeasurementCeil("10.25", 10, "length"), 103);
});

test("preserves missing dimensions and rejects invalid measurements", () => {
  assert.equal(scaleMeasurementCeil(null, 10), undefined);
  assert.throws(() => scaleMeasurementCeil("-1", 1000), /non-negative decimal/);
  assert.throws(() => scaleMeasurementCeil("1.2kg", 1000), /non-negative decimal/);
});
