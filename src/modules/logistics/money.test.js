import test from "node:test";
import assert from "node:assert/strict";
import { toMinorUnits } from "./money.js";

test("converts naira decimal strings to exact kobo", () => {
  assert.equal(toMinorUnits("1250"), 125000);
  assert.equal(toMinorUnits("1250.5"), 125050);
  assert.equal(toMinorUnits("1250.05"), 125005);
  assert.equal(toMinorUnits("0.01"), 1);
});

test("rejects floating-point numbers and malformed precision", () => {
  assert.throws(() => toMinorUnits(12.34), TypeError);
  assert.throws(() => toMinorUnits("12.345"), RangeError);
  assert.throws(() => toMinorUnits("-1.00"), RangeError);
  assert.throws(() => toMinorUnits("1e3"), RangeError);
});

test("rejects values outside the safe integer range", () => {
  assert.throws(() => toMinorUnits("90071992547409.92"), RangeError);
});
