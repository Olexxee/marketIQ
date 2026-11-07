import { toMinorUnits } from "../logistics/money.js";

/**
 * Return a stable mismatch code when Paystack does not confirm the exact
 * payment record. Paystack amounts are integer kobo, never naira floats.
 */
export const getPaystackPaymentMismatch = (payment, transaction) => {
  if (!payment || !transaction) return "invalid-response";
  if (transaction.reference !== payment.reference) return "reference-mismatch";
  if (transaction.currency !== payment.currency) return "currency-mismatch";
  if (!Number.isSafeInteger(transaction.amount) || transaction.amount < 0) {
    return "invalid-amount";
  }

  let expectedAmount;
  try {
    expectedAmount = toMinorUnits(payment.amount.toString());
  } catch {
    return "invalid-expected-amount";
  }

  return transaction.amount === expectedAmount ? null : "amount-mismatch";
};

export const describePaystackPaymentMismatch = mismatch => ({
  "invalid-response": "Paystack returned an incomplete transaction verification response",
  "reference-mismatch": "Paystack transaction reference did not match the MarketIQ payment reference",
  "currency-mismatch": "Paystack transaction currency did not match the expected payment currency",
  "invalid-amount": "Paystack returned an invalid integer-kobo transaction amount",
  "invalid-expected-amount": "MarketIQ payment amount could not be converted to exact kobo",
  "amount-mismatch": "Paystack transaction amount did not match the expected order payment amount",
}[mismatch] ?? "Paystack transaction verification failed");
