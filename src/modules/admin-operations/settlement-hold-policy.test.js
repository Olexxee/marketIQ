import test from "node:test";
import assert from "node:assert/strict";
import { getSellerSettlementHoldReason } from "./settlement-hold-policy.js";

test("does not hold an undisputed seller order with no active logistics resolution", () => {
  assert.equal(getSellerSettlementHoldReason({}), null);
});

test("holds settlement for active order disputes", () => {
  assert.match(
    getSellerSettlementHoldReason({ disputeStatus: "OPEN" }),
    /active order dispute/,
  );
  assert.match(
    getSellerSettlementHoldReason({ disputeStatus: "UNDER_REVIEW" }),
    /active order dispute/,
  );
  assert.match(
    getSellerSettlementHoldReason({ orderDisputedAt: new Date() }),
    /active order dispute/,
  );
});

test("holds settlement for pending, accepted stop, and return commands", () => {
  for (const status of ["COMMAND_PENDING", "COMMAND_PROCESSING", "STOP_CONFIRMED", "RETURN_REQUESTED"]) {
    assert.match(
      getSellerSettlementHoldReason({ resolutionStatus: status }),
      /manual financial review/,
      status,
    );
  }
});

test("holds settlement during cancellation and return shipment review", () => {
  for (const status of [
    "CANCELLATION_REQUESTED",
    "CANCELLATION_CONFIRMED",
    "RETURN_REQUESTED",
    "CANCELLATION_COMMAND_FAILED",
  ]) {
    assert.match(
      getSellerSettlementHoldReason({ shipmentReviewStatus: status }),
      /manual financial review/,
      status,
    );
  }
});

test("does not treat failed or rejected logistics requests as active holds", () => {
  assert.equal(getSellerSettlementHoldReason({ resolutionStatus: "FAILED" }), null);
  assert.equal(getSellerSettlementHoldReason({ resolutionStatus: "REJECTED" }), null);
  assert.equal(getSellerSettlementHoldReason({ shipmentReviewStatus: "CLOSED" }), null);
  assert.equal(getSellerSettlementHoldReason({ disputeStatus: "RESOLVED" }), null);
});

test("prioritizes dispute hold over logistics review hold", () => {
  assert.match(
    getSellerSettlementHoldReason({
      disputeStatus: "OPEN",
      resolutionStatus: "RETURN_REQUESTED",
    }),
    /active order dispute/,
  );
});
