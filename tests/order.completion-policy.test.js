import test from "node:test";
import assert from "node:assert/strict";
import {
  areSellerOrdersResolved,
  calculateCompletionDueAt,
  getAutoCompletionDays,
} from "../src/modules/orders/order.completion-policy.js";

test("auto-completion days accepts configured integer values from 1 through 90", () => {
  assert.equal(getAutoCompletionDays({ envValue: "1", configValue: 7 }), 1);
  assert.equal(getAutoCompletionDays({ envValue: "14", configValue: 7 }), 14);
  assert.equal(getAutoCompletionDays({ envValue: "90", configValue: 7 }), 90);
});

test("auto-completion days falls back safely for invalid configuration", () => {
  for (const value of ["0", "-1", "91", "1.5", "abc", ""]) {
    assert.equal(getAutoCompletionDays({ envValue: value, configValue: 12 }), 7);
  }
  assert.equal(getAutoCompletionDays({ envValue: undefined, configValue: 12 }), 12);
});

test("completion deadline uses the configured number of full days", () => {
  const start = new Date("2026-01-01T12:00:00.000Z");
  assert.equal(
    calculateCompletionDueAt(start, 7).toISOString(),
    "2026-01-08T12:00:00.000Z",
  );
});

test("an order is resolved only when it has seller orders and each is terminal", () => {
  assert.equal(areSellerOrdersResolved([]), false);
  assert.equal(areSellerOrdersResolved([{ status: "DELIVERED" }]), true);
  assert.equal(
    areSellerOrdersResolved([{ status: "COMPLETED" }, { status: "CANCELLED" }]),
    true,
  );
  assert.equal(
    areSellerOrdersResolved([{ status: "DELIVERED" }, { status: "SHIPPED" }]),
    false,
  );
  assert.equal(areSellerOrdersResolved([{ status: "PROCESSING" }]), false);
});
