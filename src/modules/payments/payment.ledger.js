import { ConflictError } from "../../classes/errorClasses.js";
import { buildOrderPaymentLedgerAllocation } from "./payment.ledger-allocation.js";

export const recordPaymentCaptureLedger = async ({ payment, orderId, refundLiability = false }, tx) => {
  let entries;
  let metadata = {
    provider: payment.provider,
    paymentReference: payment.reference,
    refundLiability,
  };

  if (refundLiability) {
    entries = [
      {
        account: "PAYMENT_CLEARING",
        direction: "DEBIT",
        amount: payment.amount,
        currency: payment.currency,
      },
      {
        account: "BUYER_REFUND",
        direction: "CREDIT",
        amount: payment.amount,
        currency: payment.currency,
      },
    ];
  } else if (orderId) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        subtotal: true,
        shippingTotal: true,
        tax: true,
        sellerOrders: {
          select: {
            id: true,
            subtotal: true,
            shippingTotal: true,
            logisticsQuote: {
              select: {
                customerDeliveryChargeMinor: true,
                agreedLogisticsCostMinor: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new ConflictError("The order was not found while allocating the successful payment ledger.");
    }

    const allocation = buildOrderPaymentLedgerAllocation({
      paymentAmount: payment.amount,
      orderSubtotal: order.subtotal,
      orderShippingTotal: order.shippingTotal,
      orderTax: order.tax,
      sellerOrders: order.sellerOrders,
      currency: payment.currency,
    });

    if (allocation) {
      entries = allocation.entries;
      metadata.allocation = allocation.allocation;
    } else {
      // Preserve the pre-existing non-marketplace order path when it has no
      // SellerOrder records to allocate.
      entries = [
        {
          account: "PAYMENT_CLEARING",
          direction: "DEBIT",
          amount: payment.amount,
          currency: payment.currency,
        },
        {
          account: "SELLER_PAYABLE",
          direction: "CREDIT",
          amount: payment.amount,
          currency: payment.currency,
        },
      ];
    }
  } else {
    entries = [
      {
        account: "PAYMENT_CLEARING",
        direction: "DEBIT",
        amount: payment.amount,
        currency: payment.currency,
      },
      {
        account: "BUYER_REFUND",
        direction: "CREDIT",
        amount: payment.amount,
        currency: payment.currency,
      },
    ];
  }

  return tx.ledgerTransaction.create({
    data: {
      type: "PAYMENT_CAPTURE",
      idempotencyKey: `payment-capture:${payment.id}`,
      reference: `PAYCAP-${payment.reference}`,
      orderId: orderId ?? null,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      metadata,
      entries: { create: entries },
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
            account: isBuyerRefundLiability ? "BUYER_REFUND" : "REFUND_UNALLOCATED",
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
