import test from "node:test";
import assert from "node:assert/strict";
import { buildShipmentAuthorizationEvent } from "./shipment-authorization.js";

const base = () => ({
  payment: {
    id: "payment_1",
    provider: "PAYSTACK",
    reference: "MQI-ORDER-123",
    providerReference: "paystack-confirmed-ref",
    amount: "110.00",
    currency: "NGN",
  },
  order: { id: "order_1", orderNumber: "MQI-20261107-ABC123" },
  sellerOrder: {
    id: "seller_order_1",
    shippingTotal: "10.00",
    logisticsQuote: {
      status: "ACCEPTED",
      currency: "NGN",
      customerDeliveryChargeMinor: 1000n,
      providerQuoteReference: "hub_quote_1",
      externalFulfillmentReference: "mqi-fulfillment-1",
      requestSnapshot: {
        billingAgreementVersion: "2026-01",
        request: {
          externalReference: "mqi-fulfillment-1",
          billingAgreementReference: "platform-agreement-1",
          pickupAddress: "Warehouse address",
          recipientPhone: "08000000000",
        },
      },
      selectedOption: {
        providerOptionReference: "hub_option_1",
        currency: "NGN",
        optionSnapshot: { id: "hub_option_1", routeMode: "END_TO_END" },
      },
    },
  },
});

test("builds a versioned shipment authorization using exact integer minor units", () => {
  const event = buildShipmentAuthorizationEvent({
    ...base(),
    verifiedAt: new Date("2026-11-07T12:00:00.000Z"),
  });
  assert.equal(event.eventType, "LOGISTICS_SHIPMENT_AUTHORIZATION_REQUESTED");
  assert.equal(event.aggregateId, "seller_order_1");
  assert.equal(event.dedupeKey, "logistics-shipment-authorization:seller_order_1");
  assert.equal(event.payload.paymentStatus, "VERIFIED");
  assert.equal(event.payload.paymentReference, "paystack-confirmed-ref");
  assert.equal(event.payload.paymentAmountMinor, "11000");
  assert.equal(event.payload.deliveryAmountMinor, "1000");
  assert.equal(typeof event.payload.paymentAmountMinor, "string");
  assert.equal(typeof event.payload.deliveryAmountMinor, "string");
  assert.equal(event.payload.acceptedQuoteReference, "hub_quote_1");
  assert.equal(event.payload.acceptedOptionReference, "hub_option_1");
  assert.equal(event.payload.billingAgreementVersion, "2026-01");
  assert.equal(event.payload.authorizationReady, true);
  assert.equal(event.payload.paymentVerifiedAt, "2026-11-07T12:00:00.000Z");
  assert.equal(event.payload.shipmentSnapshot.recipientPhone, "08000000000");
  assert.equal("buyerEmail" in event.payload.shipmentSnapshot, false);
});

test("does not enqueue seller-managed orders without an accepted Hub quote", () => {
  const input = base();
  input.sellerOrder.logisticsQuote = null;
  assert.equal(buildShipmentAuthorizationEvent(input), null);
});

test("retains an accepted quote with missing contract facts as blocked, not as a payment failure", () => {
  const input = base();
  input.sellerOrder.logisticsQuote.requestSnapshot.billingAgreementVersion = null;
  const event = buildShipmentAuthorizationEvent(input);
  assert.equal(event.payload.authorizationReady, false);
  assert.ok(event.payload.blockingReasons.includes("MISSING_BILLING_AGREEMENT_VERSION"));
});

test("blocks amount or currency drift in the immutable quote snapshot", () => {
  const input = base();
  input.sellerOrder.shippingTotal = "11.00";
  assert.ok(buildShipmentAuthorizationEvent(input).payload.blockingReasons.includes("DELIVERY_AMOUNT_MISMATCH"));

  const changedCurrency = base();
  changedCurrency.sellerOrder.logisticsQuote.selectedOption.currency = "USD";
  assert.ok(
    buildShipmentAuthorizationEvent(changedCurrency).payload.blockingReasons.includes("CURRENCY_MISMATCH"),
  );
});
