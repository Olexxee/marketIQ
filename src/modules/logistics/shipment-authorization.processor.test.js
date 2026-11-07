import test from "node:test";
import assert from "node:assert/strict";
import {
  createShipmentAuthorizationProcessor,
  ShipmentAuthorizationError,
} from "./shipment-authorization.processor.js";

const makeEvent = overrides => ({
  id: "event_1",
  attempts: 0,
  payload: {
    schemaVersion: 1,
    orderId: "order_1",
    orderNumber: "MQI-1001",
    sellerOrderId: "seller_order_1",
    externalFulfillmentReference: "mqi-fulfillment-1",
    paymentProvider: "PAYSTACK",
    paymentReference: "paystack-ref-1",
    paymentStatus: "VERIFIED",
    paymentVerifiedAt: "2026-11-07T12:00:00.000Z",
    paymentAmountMinor: "11000",
    deliveryAmountMinor: "1000",
    currency: "NGN",
    acceptedQuoteReference: "hub-quote-1",
    acceptedOptionReference: "hub-option-1",
    billingAgreementReference: "market-agreement",
    billingAgreementVersion: "2026-01",
    idempotencyKey: "mqi-shipment-seller_order_1-v1",
    correlationId: "payment:payment_1:seller-order:seller_order_1",
    authorizationReady: true,
    blockingReasons: [],
  },
  ...overrides,
});

const makeContext = () => ({
  id: "seller_order_1",
  shippingTotal: "10.00",
  logisticsQuote: {
    id: "local_quote_1",
    status: "ACCEPTED",
    providerQuoteReference: "hub-quote-1",
    currency: "NGN",
    customerDeliveryChargeMinor: 1000n,
    agreedLogisticsCostMinor: 900n,
    requestSnapshot: {
      billingAgreementVersion: "2026-01",
      request: {
        externalReference: "mqi-fulfillment-1",
        billingAgreementReference: "market-agreement",
        recipientPhone: "08000000000",
      },
    },
    selectedOption: {
      providerOptionReference: "hub-option-1",
      currency: "NGN",
      optionSnapshot: { id: "hub-option-1", routeMode: "END_TO_END" },
    },
    provider: {
      id: "provider_1",
      isActive: true,
      baseUrl: "https://hub.example.test",
    },
  },
});

const makeRepository = overrides => ({
  findShipmentAuthorizationContext: async () => makeContext(),
  ensureLocalLogisticsShipment: async () => ({ status: "BOOKING" }),
  markLocalLogisticsShipmentBooked: async () => ({ count: 1 }),
  ...overrides,
});

const config = {
  baseUrl: "https://hub.example.test",
  keyId: "key-id",
  secret: "secret",
  timeoutMs: 1000,
};

test("recovers an existing Hub shipment before attempting creation", async () => {
  const calls = [];
  const repository = makeRepository();
  const processor = createShipmentAuthorizationProcessor({
    repository,
    config,
    clientFactory: () => ({
      getShipmentByExternalReference: async ref => {
        calls.push(["lookup", ref]);
        return { shipment: { id: "hub-id", reference: "HUB-REF-1", externalFulfillmentReference: "mqi-fulfillment-1" } };
      },
      createShipment: async () => {
        calls.push(["create"]);
        throw new Error("must not create when recovery succeeds");
      },
    }),
  });

  const result = await processor(makeEvent());
  assert.equal(result.shipment.id, "hub-id");
  assert.deepEqual(calls, [["lookup", "mqi-fulfillment-1"]]);
});

test("creates a shipment with the exact accepted quote and payment attestation", async () => {
  const captured = {};
  const repository = makeRepository({
    markLocalLogisticsShipmentBooked: async input => {
      captured.persisted = input;
      return { count: 1 };
    },
  });
  const processor = createShipmentAuthorizationProcessor({
    repository,
    config,
    clientFactory: () => ({
      getShipmentByExternalReference: async () => null,
      createShipment: async (body, key) => {
        captured.body = body;
        captured.key = key;
        return { shipment: { id: "hub-id", reference: "HUB-REF-1", externalFulfillmentReference: "mqi-fulfillment-1" }, replay: false };
      },
    }),
  });

  const result = await processor(makeEvent());
  assert.equal(captured.key, "mqi-shipment-seller_order_1-v1");
  assert.deepEqual(captured.body, {
    quoteSessionId: "hub-quote-1",
    quoteOptionId: "hub-option-1",
    externalFulfillmentReference: "mqi-fulfillment-1",
    paymentAttestation: {
      paymentProvider: "PAYSTACK",
      externalPaymentReference: "paystack-ref-1",
      verifiedAt: "2026-11-07T12:00:00.000Z",
      currency: "NGN",
      deliveryChargeMinor: "1000",
      orderPaymentAmountMinor: "11000",
    },
  });
  assert.equal(captured.persisted.providerShipment.reference, "HUB-REF-1");
  assert.equal(result.shipment.id, "hub-id");
});

test("refuses blocked authorizations before creating a local shipment or calling Hub", async () => {
  let ensured = false;
  const processor = createShipmentAuthorizationProcessor({
    repository: makeRepository({
      ensureLocalLogisticsShipment: async () => { ensured = true; },
    }),
    config,
    clientFactory: () => { throw new Error("Hub must not be called"); },
  });

  await assert.rejects(
    processor(makeEvent({ payload: { ...makeEvent().payload, authorizationReady: false, blockingReasons: ["MISSING_BILLING_AGREEMENT_VERSION"] } })),
    error => error instanceof ShipmentAuthorizationError && error.code === "AUTHORIZATION_NOT_READY",
  );
  assert.equal(ensured, false);
});

test("rejects a quote snapshot drift before contacting Hub", async () => {
  const context = makeContext();
  context.logisticsQuote.selectedOption.providerOptionReference = "different-option";
  let ensured = false;
  const processor = createShipmentAuthorizationProcessor({
    repository: makeRepository({
      findShipmentAuthorizationContext: async () => context,
      ensureLocalLogisticsShipment: async () => { ensured = true; },
    }),
    config,
    clientFactory: () => { throw new Error("Hub must not be called"); },
  });

  await assert.rejects(
    processor(makeEvent()),
    error => error.code === "AUTHORIZATION_SNAPSHOT_MISMATCH",
  );
  assert.equal(ensured, false);
});

test("does not create after a failed recovery lookup", async () => {
  let createCalled = false;
  const processor = createShipmentAuthorizationProcessor({
    repository: makeRepository(),
    config,
    clientFactory: () => ({
      getShipmentByExternalReference: async () => {
        const error = new Error("Hub lookup timed out");
        error.retryable = true;
        error.code = "LOGISTIC_HUB_TIMEOUT";
        throw error;
      },
      createShipment: async () => { createCalled = true; },
    }),
  });

  await assert.rejects(processor(makeEvent()), error => error.retryable === true);
  assert.equal(createCalled, false);
});

test("rejects an inactive provider without submitting a booking", async () => {
  const context = makeContext();
  context.logisticsQuote.provider.isActive = false;
  const processor = createShipmentAuthorizationProcessor({
    repository: makeRepository({ findShipmentAuthorizationContext: async () => context }),
    config,
    clientFactory: () => { throw new Error("Hub must not be called"); },
  });
  await assert.rejects(processor(makeEvent()), error => error.code === "LOGISTICS_PROVIDER_INACTIVE");
});
