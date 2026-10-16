import test from "node:test";
import assert from "node:assert/strict";
import { disputeEvidenceSchema } from "../src/modules/orders/order.validation.js";

test("text notes can be submitted without an attachment URL", () => {
  const result = disputeEvidenceSchema.safeParse({
    type: "NOTE",
    description: "The parcel arrived with missing items.",
  });
  assert.equal(result.success, true);
});

test("image and document evidence require HTTPS URLs", () => {
  for (const type of ["IMAGE", "DOCUMENT", "DELIVERY_PROOF"]) {
    assert.equal(disputeEvidenceSchema.safeParse({
      type,
      description: "Supporting evidence for the delivery issue.",
    }).success, false);
    assert.equal(disputeEvidenceSchema.safeParse({
      type,
      description: "Supporting evidence for the delivery issue.",
      url: "http://example.com/evidence",
    }).success, false);
    assert.equal(disputeEvidenceSchema.safeParse({
      type,
      description: "Supporting evidence for the delivery issue.",
      url: "https://example.com/evidence",
    }).success, true);
  }
});

test("evidence descriptions must be meaningful and bounded", () => {
  assert.equal(disputeEvidenceSchema.safeParse({ type: "NOTE", description: "no" }).success, false);
  assert.equal(disputeEvidenceSchema.safeParse({
    type: "NOTE",
    description: "x".repeat(1501),
  }).success, false);
});
