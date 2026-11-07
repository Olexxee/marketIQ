import test from "node:test";
import assert from "node:assert/strict";
import { calculateCheckoutTotals } from "./checkout-totals.js";
import { fromMinorUnits } from "../logistics/money.js";
import { getPaystackPaymentMismatch } from "../payments/payment-verification.js";

test("Paystack verification expects merchandise plus customer delivery charge, not Hub cost", () => {
  const totals = calculateCheckoutTotals([{
    seller: { id: "seller-a" },
    items: [{ unitPriceSnapshot: "250.00", quantity: 1 }],
  }], new Map([
    ["seller-a", {
      id: "accepted-quote",
      customerDeliveryChargeMinor: 1250n,
      agreedLogisticsCostMinor: 980n,
    }],
  ]));

  const expectedPaymentAmount = fromMinorUnits(totals.orderTotalMinor);
  const payment = {
    reference: "MQI-CHECKOUT-001",
    amount: expectedPaymentAmount,
    currency: "NGN",
  };

  assert.equal(expectedPaymentAmount, "262.50");
  assert.equal(getPaystackPaymentMismatch(payment, {
    reference: payment.reference,
    amount: 26250,
    currency: "NGN",
  }), null);
  assert.equal(getPaystackPaymentMismatch(payment, {
    reference: payment.reference,
    amount: 25000,
    currency: "NGN",
  }), "amount-mismatch");
});
