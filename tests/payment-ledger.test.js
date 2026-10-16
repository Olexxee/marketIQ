import test from "node:test";
import assert from "node:assert/strict";
import {
  recordPaymentCaptureLedger,
  recordRefundLedger,
} from "../src/modules/payments/payment.ledger.js";

const captureLedger = async (call) => {
  let captured;
  const tx = {
    ledgerTransaction: {
      create: async ({ data }) => {
        captured = data;
        return data;
      },
    },
  };
  await call(tx);
  return captured;
};

const assertBalanced = (entries) => {
  const debits = entries.filter((entry) => entry.direction === "DEBIT")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  const credits = entries.filter((entry) => entry.direction === "CREDIT")
    .reduce((sum, entry) => sum + Number(entry.amount), 0);
  assert.equal(debits, credits);
};

test("payment capture creates a balanced, idempotently keyed ledger transaction", async () => {
  const payment = {
    id: "payment_1",
    reference: "MQI-test",
    amount: 1250,
    currency: "NGN",
    provider: "PAYSTACK",
  };
  const ledger = await captureLedger((tx) =>
    recordPaymentCaptureLedger({ payment, orderId: "order_1" }, tx),
  );

  assert.equal(ledger.type, "PAYMENT_CAPTURE");
  assert.equal(ledger.idempotencyKey, "payment-capture:payment_1");
  assert.equal(ledger.entries.create.length, 2);
  assertBalanced(ledger.entries.create);
});

test("refund creates a balanced ledger transaction and stable idempotency key", async () => {
  const refund = {
    id: "refund_1",
    orderId: "order_1",
    paymentId: "payment_1",
    amount: 250,
    currency: "NGN",
    reason: "Buyer refund",
    providerReference: "provider-refund-1",
  };
  const ledger = await captureLedger((tx) => recordRefundLedger(refund, tx));

  assert.equal(ledger.type, "REFUND");
  assert.equal(ledger.idempotencyKey, "refund:refund_1");
  assert.equal(ledger.entries.create.length, 2);
  assertBalanced(ledger.entries.create);
});
