import test from "node:test";
import assert from "node:assert/strict";
import { toMinorUnits, fromMinorUnits } from "./money.js";

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

test("formats integer kobo as exact NGN decimal strings", () => {
  assert.equal(fromMinorUnits(1n), "0.01");
  assert.equal(fromMinorUnits(100n), "1.00");
  assert.equal(fromMinorUnits(123456789012345n), "1234567890123.45");
  assert.throws(() => fromMinorUnits(-1n), RangeError);
  assert.throws(() => fromMinorUnits("1.2.3"), TypeError);
});
