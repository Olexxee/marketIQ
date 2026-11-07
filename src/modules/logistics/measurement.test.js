import test from "node:test";
import assert from "node:assert/strict";
import { scaleMeasurementCeil, normalizeVariantMeasurements } from "./measurement.js";

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

test("normalizes explicitly declared KG/CM package measurements", () => {
  assert.deepEqual(
    normalizeVariantMeasurements({
      weight: "1.234",
      weightUnit: "KG",
      length: "10.25",
      width: "8",
      height: "4.5",
      dimensionUnit: "CM",
      measurementSource: "SELLER_DECLARED",
    }),
    { weightGrams: 1234, lengthMm: 103, widthMm: 80, heightMm: 45 },
  );
});

test("normalizes explicitly declared G/MM package measurements", () => {
  assert.deepEqual(
    normalizeVariantMeasurements({
      weight: "125",
      weightUnit: "G",
      length: "120",
      width: "80",
      height: "45",
      dimensionUnit: "MM",
      measurementSource: "PLATFORM_MEASURED",
    }),
    { weightGrams: 125, lengthMm: 120, widthMm: 80, heightMm: 45 },
  );
});

test("rejects legacy measurements without units or source and rejects zero dimensions", () => {
  assert.throws(
    () => normalizeVariantMeasurements({
      weight: "1",
      length: "10",
      width: "10",
      height: "10",
    }),
    /declare supported weight and dimension units|verified measurement source/,
  );
  assert.throws(
    () => normalizeVariantMeasurements({
      weight: "1",
      weightUnit: "KG",
      length: "10",
      width: "0",
      height: "10",
      dimensionUnit: "CM",
      measurementSource: "SELLER_DECLARED",
    }),
    /positive package weight/,
  );
});
