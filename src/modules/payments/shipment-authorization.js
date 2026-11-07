import { toMinorUnits } from "../logistics/money.js";

const toMinorString = (value, field) => {
  const result = toMinorUnits(value?.toString?.() ?? String(value));
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new TypeError(`Invalid ${field} minor-unit amount.`);
  }
  return String(result);
};

/**
 * Build the durable authorization facts from the accepted checkout quote.
 * Returns null for seller-managed orders that have no accepted Hub quote.
 *
 * Missing contract facts are retained as explicit readiness issues instead
 * of throwing: a verified Paystack payment must not be rolled back because
 * a logistics snapshot is incomplete. LI-02E must refuse to submit such events.
 */
export const buildShipmentAuthorizationEvent = ({
  payment,
  order,
  sellerOrder,
  verifiedAt = new Date(),
}) => {
  const quote = sellerOrder?.logisticsQuote;
  if (!quote || quote.status !== "ACCEPTED" || !quote.selectedOption) return null;

  const quoteRequest = quote.requestSnapshot?.request ?? {};
  const externalFulfillmentReference =
    quote.externalFulfillmentReference ?? quoteRequest.externalReference ?? null;
  const billingAgreementReference = quoteRequest.billingAgreementReference ?? null;
  const billingAgreementVersion =
    quote.requestSnapshot?.billingAgreementVersion ??
    quoteRequest.billingAgreementVersion ??
    null;
  const acceptedQuoteReference = quote.providerQuoteReference ?? null;
  const acceptedOptionReference = quote.selectedOption.providerOptionReference ?? null;
  const deliveryAmountMinor = toMinorString(
    sellerOrder.shippingTotal,
    "seller-order delivery charge",
  );

  const blockingReasons = [];
  if (!externalFulfillmentReference) blockingReasons.push("MISSING_EXTERNAL_FULFILLMENT_REFERENCE");
  if (!billingAgreementReference) blockingReasons.push("MISSING_BILLING_AGREEMENT_REFERENCE");
  if (!billingAgreementVersion) blockingReasons.push("MISSING_BILLING_AGREEMENT_VERSION");
  if (!acceptedQuoteReference) blockingReasons.push("MISSING_ACCEPTED_QUOTE_REFERENCE");
  if (!acceptedOptionReference) blockingReasons.push("MISSING_ACCEPTED_OPTION_REFERENCE");
  if (quote.currency !== payment.currency || quote.selectedOption.currency !== payment.currency) {
    blockingReasons.push("CURRENCY_MISMATCH");
  }
  if (
    quote.customerDeliveryChargeMinor == null ||
    BigInt(quote.customerDeliveryChargeMinor) !== BigInt(deliveryAmountMinor)
  ) {
    blockingReasons.push("DELIVERY_AMOUNT_MISMATCH");
  }

  const idempotencyKey = `mqi-shipment-${sellerOrder.id}-v1`;
  const correlationId = `payment:${payment.id}:seller-order:${sellerOrder.id}`;

  return {
    eventType: "LOGISTICS_SHIPMENT_AUTHORIZATION_REQUESTED",
    aggregateType: "SELLER_ORDER",
    aggregateId: sellerOrder.id,
    dedupeKey: `logistics-shipment-authorization:${sellerOrder.id}`,
    payload: {
      schemaVersion: 1,
      orderId: order.id,
      orderNumber: order.orderNumber,
      sellerOrderId: sellerOrder.id,
      externalFulfillmentReference,
      paymentProvider: payment.provider,
      paymentReference: payment.reference,
      paymentStatus: "VERIFIED",
      paymentVerifiedAt: new Date(verifiedAt).toISOString(),
      paymentAmountMinor: toMinorString(payment.amount, "payment"),
      deliveryAmountMinor,
      currency: payment.currency,
      acceptedQuoteReference,
      acceptedOptionReference,
      billingAgreementReference,
      billingAgreementVersion,
      idempotencyKey,
      correlationId,
      authorizationReady: blockingReasons.length === 0,
      blockingReasons,
      // Operational shipment data only. No buyer account ID, email, JWT,
      // payment-provider raw payload or unrelated order history.
      shipmentSnapshot: {
        ...quoteRequest,
        externalFulfillmentReference,
        selectedOption: quote.selectedOption.optionSnapshot ?? null,
      },
    },
  };
};
