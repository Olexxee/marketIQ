import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSellerSettlementWithinSubtotal,
  resolveSellerSettlementAmount,
} from "./settlement-amount.js";

test("defaults seller settlement to merchandise subtotal, not seller order total", () => {
  assert.equal(resolveSellerSettlementAmount({
    subtotal: "10000.00",
  }), "10000.00");
});

test("allows a documented reduced merchandise settlement", () => {
  assert.equal(resolveSellerSettlementAmount({
    amount: "9750.25",
    subtotal: "10000.00",
    adjustmentReason: "Approved merchandise adjustment",
  }), "9750.25");
});

test("rejects settlement amounts that include or exceed delivery charge", () => {
  assert.throws(() => resolveSellerSettlementAmount({
    amount: "10500.00",
    subtotal: "10000.00",
    adjustmentReason: "Attempted amount",
  }), /cannot exceed the merchandise subtotal/);
  assert.throws(() => assertSellerSettlementWithinSubtotal("10000.01", "10000.00"),
    /customer delivery charges are not seller proceeds/);
});

test("requires an explicit reduced amount and reason after a successful refund", () => {
  assert.throws(() => resolveSellerSettlementAmount({
    subtotal: "10000.00",
    hasSucceededRefund: true,
  }), /processed refund requires an explicitly reduced/);
  assert.throws(() => resolveSellerSettlementAmount({
    amount: "9900.00",
    subtotal: "10000.00",
    hasSucceededRefund: true,
  }), /adjustmentReason is required/);
  assert.equal(resolveSellerSettlementAmount({
    amount: "9900.00",
    subtotal: "10000.00",
    hasSucceededRefund: true,
    adjustmentReason: "Refund allocation",
  }), "9900.00");
});

test("uses exact two-decimal minor-unit arithmetic", () => {
  assert.equal(resolveSellerSettlementAmount({
    amount: "0.29",
    subtotal: "0.30",
    adjustmentReason: "One kobo retained for dispute",
  }), "0.29");
  assert.throws(() => resolveSellerSettlementAmount({
    amount: "0.291",
    subtotal: "0.30",
    adjustmentReason: "Invalid precision",
  }), /at most 2 decimal places/);
});
