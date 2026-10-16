export const recordPaymentCaptureLedger = async ({ payment, orderId, refundLiability = false }, tx) => {
  return tx.ledgerTransaction.create({
    data: {
      type: "PAYMENT_CAPTURE",
      idempotencyKey: `payment-capture:${payment.id}`,
      reference: `PAYCAP-${payment.reference}`,
      orderId: orderId ?? null,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      metadata: {
        provider: payment.provider,
        paymentReference: payment.reference,
        refundLiability,
      },
      entries: {
        create: [
          {
            account: "PAYMENT_CLEARING",
            direction: "DEBIT",
            amount: payment.amount,
            currency: payment.currency,
          },
          {
            account: refundLiability ? "BUYER_REFUND" : "SELLER_PAYABLE",
            direction: "CREDIT",
            amount: payment.amount,
            currency: payment.currency,
          },
        ],
      },
    },
  });
};

export const recordRefundLedger = async (refund, tx) => {
  const isBuyerRefundLiability = /duplicate successful payment|late successful payment/i.test(refund.reason);
  return tx.ledgerTransaction.create({
    data: {
      type: "REFUND",
      idempotencyKey: `refund:${refund.id}`,
      reference: `REFUND-${refund.id}`,
      orderId: refund.orderId,
      paymentId: refund.paymentId,
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      metadata: { providerReference: refund.providerReference },
      entries: {
        create: [
          {
            account: isBuyerRefundLiability ? "BUYER_REFUND" : "SELLER_PAYABLE",
            direction: "DEBIT",
            amount: refund.amount,
            currency: refund.currency,
          },
          {
            account: "PAYMENT_CLEARING",
            direction: "CREDIT",
            amount: refund.amount,
            currency: refund.currency,
          },
        ],
      },
    },
  });
};
