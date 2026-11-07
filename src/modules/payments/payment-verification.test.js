import test from "node:test";
import assert from "node:assert/strict";
import { getPaystackPaymentMismatch } from "./payment-verification.js";

const payment = {
  reference: "MQI-ORDER-001",
  amount: "1250.35",
  currency: "NGN",
};

test("accepts the exact Paystack integer-kobo amount", () => {
  assert.equal(getPaystackPaymentMismatch(payment, {
    reference: payment.reference,
    amount: 125035,
    currency: "NGN",
    status: "success",
  }), null);
});

test("rejects underpayment and overpayment by one kobo", () => {
  assert.equal(getPaystackPaymentMismatch(payment, {
    reference: payment.reference, amount: 125034, currency: "NGN",
  }), "amount-mismatch");
  assert.equal(getPaystackPaymentMismatch(payment, {
    reference: payment.reference, amount: 125036, currency: "NGN",
  }), "amount-mismatch");
});

test("rejects wrong reference or currency", () => {
  assert.equal(getPaystackPaymentMismatch(payment, {
    reference: "OTHER-REFERENCE", amount: 125035, currency: "NGN",
  }), "reference-mismatch");
  assert.equal(getPaystackPaymentMismatch(payment, {
    reference: payment.reference, amount: 125035, currency: "USD",
  }), "currency-mismatch");
});

test("rejects missing, fractional and unsafe Paystack amounts", () => {
  for (const amount of [undefined, null, 125035.5, Number.MAX_SAFE_INTEGER + 1, "125035"]) {
    assert.equal(getPaystackPaymentMismatch(payment, {
      reference: payment.reference, amount, currency: "NGN",
    }), "invalid-amount");
  }
});

test("does not use binary floating-point to convert the stored naira amount", () => {
  assert.equal(getPaystackPaymentMismatch({
    reference: "MQI-ORDER-002", amount: "0.29", currency: "NGN",
  }, {
    reference: "MQI-ORDER-002", amount: 29, currency: "NGN",
  }), null);
});
