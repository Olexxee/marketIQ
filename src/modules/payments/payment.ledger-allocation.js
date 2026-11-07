import { ConflictError } from "../../classes/errorClasses.js";
import { fromMinorUnits, toMinorUnits } from "../logistics/money.js";

const minor = value => BigInt(toMinorUnits(value?.toString?.() ?? String(value)));
const decimal = value => fromMinorUnits(value);

export const buildOrderPaymentLedgerAllocation = ({
  paymentAmount,
  orderSubtotal,
  orderShippingTotal,
  orderTax,
  sellerOrders,
  currency = "NGN",
}) => {
  if (!Array.isArray(sellerOrders) || sellerOrders.length === 0) return null;

  const expectedPaymentMinor = minor(paymentAmount);
  const parentSubtotalMinor = minor(orderSubtotal);
  const parentShippingMinor = minor(orderShippingTotal);
  const taxMinor = minor(orderTax ?? "0");

  let sellerSubtotalMinor = 0n;
  let customerDeliveryMinor = 0n;
  let logisticsCostMinor = 0n;

  const entries = [
    {
      account: "PAYMENT_CLEARING",
      direction: "DEBIT",
      amount: decimal(expectedPaymentMinor),
      currency,
    },
  ];

  for (const sellerOrder of sellerOrders) {
    const sellerSubtotal = minor(sellerOrder.subtotal);
    const customerDelivery = minor(sellerOrder.shippingTotal ?? "0");
    const quote = sellerOrder.logisticsQuote;
    let logisticsCost = 0n;

    if (quote) {
      if (quote.customerDeliveryChargeMinor == null || quote.agreedLogisticsCostMinor == null) {
        throw new ConflictError("Accepted logistics quote is missing its immutable customer charge or Hub cost snapshot.");
      }
      if (BigInt(quote.customerDeliveryChargeMinor) !== customerDelivery) {
        throw new ConflictError("Seller order delivery charge does not match its accepted logistics quote snapshot.");
      }
      logisticsCost = BigInt(quote.agreedLogisticsCostMinor);
    } else if (customerDelivery > 0n) {
      throw new ConflictError("A seller order with a customer delivery charge must have its accepted logistics quote attached before payment capture.");
    }

    sellerSubtotalMinor += sellerSubtotal;
    customerDeliveryMinor += customerDelivery;
    logisticsCostMinor += logisticsCost;

    if (sellerSubtotal > 0n) {
      entries.push({
        account: "SELLER_PAYABLE",
        direction: "CREDIT",
        amount: decimal(sellerSubtotal),
        currency,
        sellerOrderId: sellerOrder.id,
      });
    }
    if (logisticsCost > 0n) {
      entries.push({
        account: "LOGISTICS_PAYABLE",
        direction: "CREDIT",
        amount: decimal(logisticsCost),
        currency,
        sellerOrderId: sellerOrder.id,
      });
    }
  }

  if (
    sellerSubtotalMinor !== parentSubtotalMinor ||
    customerDeliveryMinor !== parentShippingMinor
  ) {
    throw new ConflictError("Seller-order merchandise or delivery allocations do not reconcile to the parent order.");
  }

  const calculatedPaymentMinor = sellerSubtotalMinor + customerDeliveryMinor + taxMinor;
  if (calculatedPaymentMinor !== expectedPaymentMinor) {
    throw new ConflictError("Payment amount does not reconcile to merchandise, customer delivery charges and tax.");
  }

  if (taxMinor > 0n) {
    entries.push({
      account: "TAX_PAYABLE",
      direction: "CREDIT",
      amount: decimal(taxMinor),
      currency,
    });
  }

  const deliveryMarginMinor = customerDeliveryMinor - logisticsCostMinor;
  if (deliveryMarginMinor > 0n) {
    entries.push({
      account: "PLATFORM_REVENUE",
      direction: "CREDIT",
      amount: decimal(deliveryMarginMinor),
      currency,
    });
  } else if (deliveryMarginMinor < 0n) {
    entries.push({
      account: "LOGISTICS_SUBSIDY",
      direction: "DEBIT",
      amount: decimal(-deliveryMarginMinor),
      currency,
    });
  }

  return {
    entries,
    allocation: {
      sellerPayableMinor: sellerSubtotalMinor.toString(),
      customerDeliveryChargeMinor: customerDeliveryMinor.toString(),
      logisticsPayableMinor: logisticsCostMinor.toString(),
      deliveryMarginMinor: deliveryMarginMinor.toString(),
      taxPayableMinor: taxMinor.toString(),
      currency,
    },
  };
};
