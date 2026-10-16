import test from "node:test";
import assert from "node:assert/strict";

test("payment and admin transaction services import successfully", async () => {
  const [payments, adminOperations] = await Promise.all([
    import("../src/modules/payments/payment.service.js"),
    import("../src/modules/admin-operations/admin-operations.service.js"),
  ]);

  assert.equal(typeof payments.initiatePaymentService, "function");
  assert.equal(typeof payments.requestRefundService, "function");
  assert.equal(typeof payments.processRefundService, "function");
  assert.equal(typeof adminOperations.resolveDisputeService, "function");
  assert.equal(typeof adminOperations.requestSellerSettlementService, "function");
});
