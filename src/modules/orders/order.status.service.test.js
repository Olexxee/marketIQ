import test from "node:test";
import assert from "node:assert/strict";
import { deriveOrderStatus } from "./order.status.service.js";
import {
  calculateCompletionDueAt,
  getAutoCompletionDays,
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
  assert.equal(getAutoCompletionDays({ envValue: undefined, configValue: 30 }), 30);
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
