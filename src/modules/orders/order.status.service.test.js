import test from "node:test";
import assert from "node:assert/strict";
import { deriveOrderStatus } from "./order.status.service.js";
import { getPaymentExpiryMinutes, calculatePaymentExpiresAt } from "./order.payment-policy.js";
import {
  calculateCompletionDueAt,
  getAutoCompletionDays,
  areSellerOrdersResolved,
} from "./order.completion-policy.js";

const sellerOrder = (status) => ({ status });

test("parent order remains delivered when every non-cancelled seller order is delivered", () => {
  assert.equal(
    deriveOrderStatus([
      sellerOrder("DELIVERED"),
      sellerOrder("CANCELLED"),
    ]),
    "DELIVERED",
  );
});

test("parent order completes only when every active seller order is completed", () => {
  assert.equal(
    deriveOrderStatus([
      sellerOrder("COMPLETED"),
      sellerOrder("CANCELLED"),
    ]),
    "COMPLETED",
  );
});

test("all-cancelled parent order remains cancelled", () => {
  assert.equal(
    deriveOrderStatus([sellerOrder("CANCELLED"), sellerOrder("CANCELLED")]),
    "CANCELLED",
  );
});

test("auto-completion days accepts integers from 1 through 90", () => {
  assert.equal(getAutoCompletionDays({ envValue: "14", configValue: 7 }), 14);
  assert.equal(getAutoCompletionDays({ envValue: null, configValue: 30 }), 30);
});

test("auto-completion days falls back for invalid values", () => {
  for (const value of ["0", "91", "1.5", "invalid", ""]) {
    assert.equal(getAutoCompletionDays({ envValue: value, configValue: 7 }), 7);
  }
});

test("completion deadline uses an exact day interval", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");
  assert.equal(
    calculateCompletionDueAt(now, 7).toISOString(),
    "2026-01-08T12:00:00.000Z",
  );
});

test("multi-seller completion accepts cancelled seller orders as resolved", () => {
  assert.equal(areSellerOrdersResolved([{ status: "DELIVERED" }, { status: "CANCELLED" }]), true);
  assert.equal(areSellerOrdersResolved([{ status: "DELIVERED" }, { status: "PROCESSING" }]), false);
  assert.equal(areSellerOrdersResolved([]), false);
});

test("payment expiry minutes is constrained to 5 through 120", () => {
  assert.equal(getPaymentExpiryMinutes("30"), 30);
  assert.equal(getPaymentExpiryMinutes("5"), 5);
  assert.equal(getPaymentExpiryMinutes("120"), 120);
  for (const value of ["0", "121", "1.5", "invalid", ""]) {
    assert.equal(getPaymentExpiryMinutes(value), 30);
  }
});

test("payment expiry defaults to 30 minutes and calculates deadline", () => {
  assert.equal(getPaymentExpiryMinutes(null), 30);
  const now = new Date("2026-01-01T12:00:00.000Z");
  assert.equal(calculatePaymentExpiresAt(now, 30).toISOString(), "2026-01-01T12:30:00.000Z");
});
