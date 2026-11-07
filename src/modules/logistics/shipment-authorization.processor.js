import { createLogisticHubClient } from "./logistic-hub.client.js";
import { toMinorUnits } from "./money.js";

const MINOR_AMOUNT_PATTERN = /^(0|[1-9]\d*)$/;

export class ShipmentAuthorizationError extends Error {
  constructor(message, { code = "SHIPMENT_AUTHORIZATION_INVALID", retryable = false } = {}) {
    super(message);
    this.name = "ShipmentAuthorizationError";
    this.code = code;
    this.retryable = retryable;
  }
}

const requireMinorAmount = (value, field) => {
  if (typeof value !== "string" || !MINOR_AMOUNT_PATTERN.test(value)) {
    throw new ShipmentAuthorizationError(`Authorization ${field} must be an integer minor-unit string.`, {
      code: "INVALID_MINOR_AMOUNT",
    });
  }
  return value;
};

const validateContext = (event, sellerOrder) => {
  const payload = event.payload ?? {};
  const quote = sellerOrder?.logisticsQuote;
  if (payload.schemaVersion !== 1 || payload.authorizationReady !== true) {
    throw new ShipmentAuthorizationError(
      `Shipment authorization is blocked: ${(payload.blockingReasons ?? []).join(", ") || "invalid schema or readiness flag"}`,
      { code: "AUTHORIZATION_NOT_READY" },
    );
  }
  if (!sellerOrder || !quote || quote.status !== "ACCEPTED" || !quote.selectedOption) {
    throw new ShipmentAuthorizationError("Seller order no longer has its accepted Logistic Hub quote.", {
      code: "ACCEPTED_QUOTE_NOT_FOUND",
    });
  }

  if (
    event.aggregateType !== "SELLER_ORDER" ||
    event.aggregateId !== payload.sellerOrderId ||
    payload.orderId !== sellerOrder.orderId ||
    payload.idempotencyKey !== `mqi-shipment-${sellerOrder.id}-v1`
  ) {
    throw new ShipmentAuthorizationError("Outbox aggregate or idempotency identity does not match the seller order.", {
      code: "SHIPMENT_EVENT_IDENTITY_MISMATCH",
    });
  }

  const quoteRequest = quote.requestSnapshot?.request ?? {};
  const deliveryAmountMinor = requireMinorAmount(payload.deliveryAmountMinor, "delivery amount");
  const orderPaymentAmountMinor = requireMinorAmount(payload.paymentAmountMinor, "payment amount");
  if (
    payload.paymentStatus !== "VERIFIED" ||
    typeof payload.paymentProvider !== "string" || payload.paymentProvider.trim().length < 2 ||
    !payload.paymentReference ||
    !payload.paymentVerifiedAt ||
    Number.isNaN(Date.parse(payload.paymentVerifiedAt))
  ) {
    throw new ShipmentAuthorizationError("Payment attestation is incomplete or not verified.", {
      code: "INVALID_PAYMENT_ATTESTATION",
    });
  }
  if (
    payload.acceptedQuoteReference !== quote.providerQuoteReference ||
    payload.acceptedOptionReference !== quote.selectedOption.providerOptionReference ||
    payload.externalFulfillmentReference !== quoteRequest.externalReference ||
    payload.billingAgreementReference !== quoteRequest.billingAgreementReference ||
    payload.billingAgreementVersion !== quote.requestSnapshot?.billingAgreementVersion ||
    payload.currency !== quote.currency ||
    payload.currency !== quote.selectedOption.currency ||
    BigInt(deliveryAmountMinor) !== quote.customerDeliveryChargeMinor ||
    BigInt(deliveryAmountMinor) !== BigInt(toMinorUnits(sellerOrder.shippingTotal.toString()))
  ) {
    throw new ShipmentAuthorizationError("Authorization no longer matches the accepted quote and seller-order delivery amount.", {
      code: "AUTHORIZATION_SNAPSHOT_MISMATCH",
    });
  }
  if (!payload.externalFulfillmentReference || !payload.idempotencyKey) {
    throw new ShipmentAuthorizationError("Authorization is missing its external fulfilment or idempotency reference.", {
      code: "MISSING_IDEMPOTENCY_IDENTITY",
    });
  }
  if (!quote.agreedLogisticsCostMinor && quote.agreedLogisticsCostMinor !== 0n) {
    throw new ShipmentAuthorizationError("Accepted quote is missing its agreed logistics cost.", {
      code: "MISSING_LOGISTICS_COST",
    });
  }
  if (
    sellerOrder.logisticsQuote.provider?.code !== "LOGISTIC_HUB" ||
    !sellerOrder.logisticsQuote.provider?.isActive
  ) {
    throw new ShipmentAuthorizationError("The Logistic Hub provider is not active in MarketIQ configuration.", {
      code: "LOGISTICS_PROVIDER_INACTIVE",
      retryable: true,
    });
  }
  return {
    quote,
    quoteRequest,
    deliveryAmountMinor,
    orderPaymentAmountMinor,
  };
};

const normalizeProviderShipment = (response, expectedExternalReference) => {
  const shipment = response?.shipment ?? response;
  if (
    !shipment ||
    typeof shipment.id !== "string" ||
    typeof shipment.reference !== "string" ||
    shipment.externalFulfillmentReference !== expectedExternalReference
  ) {
    throw new ShipmentAuthorizationError("Logistic Hub returned a shipment response without its required references.", {
      code: "INVALID_SHIPMENT_RESPONSE",
    });
  }
  return shipment;
};

export const createShipmentAuthorizationProcessor = ({
  repository,
  config,
  clientFactory = options => createLogisticHubClient(options),
}) => async event => {
  const payload = event.payload ?? {};
  const sellerOrder = await repository.findShipmentAuthorizationContext(payload.sellerOrderId);
  const { quote, quoteRequest, deliveryAmountMinor, orderPaymentAmountMinor } =
    validateContext(event, sellerOrder);

  const provider = quote.provider;
  const shipmentRequest = {
    quoteSessionId: payload.acceptedQuoteReference,
    quoteOptionId: payload.acceptedOptionReference,
    externalFulfillmentReference: payload.externalFulfillmentReference,
    paymentAttestation: {
      paymentProvider: payload.paymentProvider,
      externalPaymentReference: payload.paymentReference,
      verifiedAt: payload.paymentVerifiedAt,
      currency: payload.currency,
      deliveryChargeMinor: deliveryAmountMinor,
      orderPaymentAmountMinor,
    },
  };

  const localShipment = await repository.ensureLocalLogisticsShipment({
    providerId: provider.id,
    sellerOrderId: sellerOrder.id,
    externalReference: payload.externalFulfillmentReference,
    idempotencyKey: payload.idempotencyKey,
    customerDeliveryChargeMinor: deliveryAmountMinor,
    agreedLogisticsCostMinor: quote.agreedLogisticsCostMinor.toString(),
    currency: payload.currency,
    billingAgreementReference: payload.billingAgreementReference,
    requestSnapshot: {
      schemaVersion: 1,
      shipmentRequest,
      acceptedQuoteRequest: quoteRequest,
      acceptedOptionSnapshot: quote.selectedOption.optionSnapshot,
      paymentVerifiedAt: payload.paymentVerifiedAt,
      paymentReference: payload.paymentReference,
      correlationId: payload.correlationId,
    },
  });

  if (localShipment.status === "BOOKED") return { replay: true, shipment: localShipment };

  const client = clientFactory({
    config: {
      ...config,
      baseUrl: config.baseUrl || provider.baseUrl,
    },
  });

  // Always recover before create. This is the key timeout-safety property:
  // Hub may have committed a booking even when MarketIQ lost the response.
  let response = await client.getShipmentByExternalReference(payload.externalFulfillmentReference);
  if (!response) {
    response = await client.createShipment(shipmentRequest, payload.idempotencyKey);
  }

  const providerShipment = normalizeProviderShipment(response, payload.externalFulfillmentReference);
  await repository.markLocalLogisticsShipmentBooked({
    sellerOrderId: sellerOrder.id,
    providerShipment,
    responseSnapshot: response,
  });
  return { replay: Boolean(response?.replay), shipment: providerShipment };
};
