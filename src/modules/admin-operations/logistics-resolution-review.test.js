import test from "node:test";
import assert from "node:assert/strict";
import { buildLogisticsResolutionReviewFlags } from "./logistics-resolution-review.flags.js";

const makeRecord = (overrides = {}) => ({
  status: "RETURN_REQUESTED",
  physicalReturnConfirmed: false,
  sellerOrder: {
    order: {
      payments: [{ status: "SUCCESS" }],
      refunds: [],
    },
    settlement: { status: "REQUESTED" },
  },
  shipment: { events: [{ eventType: "shipment.return_requested" }] },
  ...overrides,
});

test("flags a return request that is not physical return confirmation", () => {
  assert.deepEqual(
    buildLogisticsResolutionReviewFlags(makeRecord()),
    ["RETURN_NOT_PHYSICALLY_CONFIRMED"],
  );
});

test("flags paid seller settlement and pending refund for manual recovery review", () => {
  const record = makeRecord({
    sellerOrder: {
      order: {
        payments: [{ status: "SUCCESS" }],
        refunds: [{ status: "PROCESSING" }],
      },
      settlement: { status: "PAID" },
    },
  });
  assert.deepEqual(buildLogisticsResolutionReviewFlags(record), [
    "RETURN_NOT_PHYSICALLY_CONFIRMED",
    "SELLER_SETTLEMENT_PAID_RECOVERY_REVIEW_REQUIRED",
    "REFUND_ALREADY_PENDING_OR_PROCESSING",
  ]);
});

test("flags missing payment and Hub event evidence", () => {
  const record = makeRecord({
    sellerOrder: { order: { payments: [], refunds: [] }, settlement: null },
    shipment: { events: [] },
  });
  assert.deepEqual(buildLogisticsResolutionReviewFlags(record), [
    "RETURN_NOT_PHYSICALLY_CONFIRMED",
    "NO_SUCCESSFUL_PAYMENT_RECORD",
    "NO_HUB_EVENT_EVIDENCE",
  ]);
});

test("does not infer physical return from a confirmed stop", () => {
  const record = makeRecord({ status: "STOP_CONFIRMED", physicalReturnConfirmed: false });
  assert.deepEqual(buildLogisticsResolutionReviewFlags(record), [
    "STOP_CONFIRMED_IS_NOT_RETURN_CONFIRMATION",
  ]);
});
