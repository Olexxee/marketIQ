# Logistic Hub Integration — LI-01 / LI-02A Audit and Contract

**Status:** LI-01 contract decisions and LI-02A source audit are documented. LI-02 implementation has not started. MarketIQ and Logistic Hub remain separate services and databases.

## 1. System ownership

| Concern | System of record |
|---|---|
| Buyer, seller, catalogue, cart, checkout, order, seller order and customer payment/refund | MarketIQ |
| Seller warehouse mapping and customer checkout shipping charge | MarketIQ |
| Package assessment, service coverage, route feasibility, quote options and quote expiry | Logistic Hub |
| Shipment booking, delivery legs, partner/driver assignment, hubs, custody and delivery exceptions | Logistic Hub |
| MarketIQ customer-facing tracking projection | MarketIQ, derived from authenticated Logistic Hub events |
| Logistics payable and reconciliation | MarketIQ + Logistic Hub records; manual reconciliation for v1 |

MarketIQ must not choose Logistic Hub partners, drivers, hubs, routes, rate cards or operational statuses. Logistic Hub must not charge the buyer or claim MarketIQ's Paystack payment as a Logistic Hub payment.

## 2. Source audit — MarketIQ current state

The audit inspected the current `master` branch checkout, payment, fulfillment, event-worker, Prisma schema, migration and logistics-admin implementation.

### 2.1 Checkout and order creation

- `POST /api/checkout/` calls `checkoutService`.
- Checkout locks the active cart, validates cart items, groups items by seller, creates the parent `Order`, creates one `SellerOrder` per seller, reserves inventory and marks the cart checked out in one transaction.
- Checkout currently writes `Order.shippingTotal = 0`, `Order.total = subtotal`, and each `SellerOrder.shippingTotal = 0`, `SellerOrder.total = subtotal`.
- Seller orders and order IDs are created during checkout. They do not exist during the earlier cart-review stage.
- The existing `LogisticsQuote` model is cart/seller scoped and has an optional unique `sellerOrderId`, which can be linked after checkout. This is compatible with pre-checkout quoting in principle, but the current model stores one amount/one provider quote reference and does not model a selectable list of provider quote options.

**Implication:** LI-02 must request and accept delivery options before checkout, persist the accepted quote against the active cart and seller group, then atomically attach that accepted quote to the newly created SellerOrder during checkout. It must not call Logistic Hub from inside the checkout database transaction.

### 2.2 Payment

- Payment initiation reads `Order.total` and creates the Paystack payment for that amount.
- Paystack's webhook verifies the raw request signature and compares the provider's kobo amount to the expected order amount.
- On successful capture, `applySuccessfulPayment` updates payment and order state, commits inventory sales, confirms seller orders, recalculates order status, records the payment ledger/audit and publishes `PAYMENT_COMPLETED` through the outbox in the same database transaction.
- This transaction is the correct point to enqueue shipment booking work, but the current event registry has no logistics listener for `PAYMENT_COMPLETED`.
- The current amount comparison uses `Math.round(Number(payment.amount) * 100)`; LI-02 must use the shared exact decimal-to-minor-unit conversion and add precision/round-trip tests.

**Invariant:** the delivery charge must be included in `Order.total` before Paystack initialization. A shipment booking must never create a second buyer charge.

### 2.3 Fulfillment ownership and lifecycle

- `Fulfillment` is unique per `SellerOrder` and is currently created by the seller fulfillment service after payment.
- The seller service accepts seller-provided shipping cost, carrier, tracking number and seller-controlled status transitions.
- `LogisticsShipment` is also unique per `SellerOrder` and optionally links to a `Fulfillment`.
- The provider shipment must become the source of truth for delivery status when a seller order uses Logistic Hub. Seller fulfillment controls must not be allowed to overwrite provider-owned milestones or create a competing fulfillment.
- Existing seller fulfillment behavior must remain available for orders not using Logistic Hub.

**Implementation requirement:** add an explicit fulfillment ownership/provider mode and enforce it in the service layer and database invariants. The integration worker must create or link the provider-managed fulfillment idempotently; the seller must not be able to create a second one or set provider tracking/status manually.

### 2.4 Existing logistics persistence — gaps to reconcile

MarketIQ already has `LogisticsProvider`, `LogisticsQuote`, `LogisticsWarehouseMapping`, `LogisticsShipment`, `LogisticsEvent` and `LogisticsWebhookReceipt` models from migration `20261105000000_add_logistics_integration`.

The current schema is an initial scaffold, not the completed LI-02 contract:

- `LogisticsQuote` persists one customer charge and one logistics cost. Logistic Hub returns a quote session with multiple options; MarketIQ must persist each option or retain a rigorously validated immutable option collection with a separately selected option.
- `LogisticsQuote.idempotencyKey`, `LogisticsShipment.idempotencyKey` and `LogisticsShipment.externalReference` are globally unique. They need provider-scoped uniqueness (or an explicit client namespace) so another logistics provider cannot collide.
- `LogisticsQuote.sellerOrderId` is optional and unique; it can be attached after checkout, but the stable fulfillment intent/reference must exist before the provider quote call.
- `LogisticsShipment.sellerOrderId` and `fulfillmentId` are unique, which is appropriate for the current one-shipment-per-seller-order v1 rule.
- `LogisticsEvent.sequence` is nullable and not yet constrained as a monotonic per-shipment cursor.
- `LogisticsWebhookReceipt` has provider/event uniqueness, but its JSON payload alone is not a substitute for preserving the exact raw request bytes needed for HMAC verification.
- Provider credentials/signing-secret lifecycle and environment separation must be designed; secrets must never be stored in plaintext or exposed to the frontend.

Do not drop or repurpose existing tables blindly. LI-02 schema work must use forward-only migrations and preserve existing rows.

### 2.5 Warehouse mapping and location

- Admin-managed `LogisticsWarehouseMapping` already requires verification before activation.
- Activation checks active provider/warehouse and verified warehouse coordinates.
- Address coordinate verification exists separately.
- No service-zone ID may be inferred from state/LGA/city. The quote request must use explicit Logistic Hub service-zone identifiers maintained through an approved mapping/configuration process.
- An inactive or missing mapping must fail closed; no fallback warehouse or fabricated coordinates.

### 2.6 Outbox worker runtime

- MarketIQ has a generic transactional `OutboxEvent` and a worker script at `src/modules/events/worker.js`.
- The worker currently runs as a separate `npm run worker` process; `src/server.js` does not start it.
- The listener registry currently registers market-activity listeners only. There is no `PAYMENT_COMPLETED` logistics listener.
- The existing worker claims events with a conditional status update and recovers stale PROCESSING rows, but does not yet implement the explicit integration-specific lease/claim telemetry and bounded dead-letter operations required for booking orchestration.

**Deployment decision for LI-02:** run the logistics booking worker within the existing MarketIQ Render web-service process, with explicit start/stop lifecycle and database-backed claims. Do not require a separate paid Render worker service. Keep processing idempotent because delivery is at-least-once and a process can crash after Logistic Hub commits a shipment but before MarketIQ records the response.

## 3. Logistic Hub API contract — verified implementation

The generic API is mounted under `/api/v1/integrations`; it is not mounted under a MarketIQ-specific `/marketplace` path.

### Quote lifecycle

- `POST /api/v1/integrations/quotes` — requires `quotes:write` and `Idempotency-Key`.
- `GET /api/v1/integrations/quotes/:quoteSessionId` — requires `quotes:read`.
- `POST /api/v1/integrations/quotes/:quoteSessionId/options/:optionId/accept` — requires `quotes:write` and `Idempotency-Key`.

Quote creation accepts a billing agreement reference, external reference, pickup/destination address snapshots and coordinates, service-zone IDs, recipient details and 1–50 package records. Logistic Hub returns available quote options with opaque IDs, prices in NGN minor-unit strings and expiry. It currently offers only complete `END_TO_END` interstate options; unsupported local/hub-assisted pricing fails closed with `REQUIRES_OPERATIONAL_PRICING`.

### Shipment lifecycle

- `POST /api/v1/integrations/shipments` — requires `shipments:write` and `Idempotency-Key`.
- `GET /api/v1/integrations/shipments/:shipmentId` — requires `shipments:read`.
- `GET /api/v1/integrations/shipments/by-external-reference/:externalFulfillmentReference` — requires `shipments:read`.
- `GET /api/v1/integrations/shipments/:shipmentId/events?afterSequence=0&limit=50` — requires `shipments:read`.

Shipment creation accepts the selected quote session/option, the exact external fulfillment reference bound to the quote and a `paymentAttestation` containing provider, external payment reference, verification timestamp, currency and delivery-charge minor units. The attestation is trusted input from the authenticated integration client; Logistic Hub does not independently verify MarketIQ's Paystack payment. The attested delivery charge and currency must exactly match the selected quote.

The API creates an integration-owned booking atomically, without a synthetic sender, Logistic Hub Paystack charge, internal payment attempt, refund or payment-ledger entry. It preserves each package independently and starts the shipment awaiting partner assignment.

### Signed webhook delivery

MarketIQ registers a webhook endpoint through the integration endpoint-management API and subscribes to supported event types. Logistic Hub sends a JSON envelope:

```json
{
  "id": "event-id",
  "type": "shipment.created",
  "schemaVersion": 1,
  "occurredAt": "2026-11-07T12:00:00.000Z",
  "sequence": 1,
  "data": {
    "shipmentReference": "public-reference",
    "status": "AWAITING_PARTNER_ASSIGNMENT"
  }
}
```

Headers include `X-Logistic-Hub-Event-Id`, `X-Logistic-Hub-Delivery-Id`, `X-Logistic-Hub-Event-Type`, `X-Logistic-Hub-Event-Sequence`, `X-Logistic-Hub-Timestamp` and `X-Logistic-Hub-Signature`. Signature format is `t=<unix-seconds>,v1=<hex-digest>`, HMAC-SHA256 over the exact bytes of `timestamp + "." + rawBody`.

MarketIQ must verify the signature over raw request bytes with constant-time comparison, enforce a bounded timestamp tolerance, deduplicate by event ID, and apply only strictly newer per-shipment sequences. Provider events update the logistics projection only; they must not directly complete MarketIQ orders, trigger payment/refund, or settle sellers.

The current externally mapped event vocabulary is:
- `shipment.created`
- `shipment.partner_assigned`
- `shipment.in_transit`
- `shipment.custody_handover_confirmed`
- `shipment.delivery_leg_completed`

Do not invent events for pickup scheduling, out-for-delivery, delivery failure, cancellation or returns until Logistic Hub exposes and documents those source lifecycle transitions.

## 4. Monetary invariants

- MarketIQ commerce amounts are Prisma `Decimal(12,2)` in naira.
- Logistic Hub integration API amounts are integer minor-unit decimal strings (kobo).
- Convert using exact decimal arithmetic; do not use `Number(value) * 100`, floating-point arithmetic or implicit BigInt/Decimal coercion.
- Customer delivery charge, agreed logistics cost, merchandise subtotal, discounts, taxes and platform margin remain distinct.
- The accepted customer delivery charge contributes to parent `Order.shippingTotal` and `Order.total`.
- Seller payable/settlement must not accidentally include the customer's delivery charge. Logistics payable is a separate platform liability.
- Preserve the quote and billing-agreement version snapshot; never reprice historical accepted quotes using current partner rates.

## 5. LI-02 implementation slices

| Slice | Scope | Exit criteria |
|---|---|---|
| LI-02A | Source audit and contract reconciliation | Current checkout/payment/fulfillment/outbox behavior and actual Logistic Hub routes/events documented. |
| LI-02B | Persistence and exact money model | Provider-scoped idempotency, quote-option persistence/selection, stable fulfillment intent, provider event sequence and raw webhook receipt model; migration preserves existing data. |
| LI-02C | Pre-payment quote and checkout | Quote/option selection before checkout; accepted charge atomically copied into order/seller-order snapshots; expired/changed quotes rejected; no provider HTTP inside checkout transaction. |
| LI-02D | Payment and shipment outbox | Paystack amount includes shipping; successful payment transaction enqueues one booking job per eligible seller fulfillment; duplicate payment events do not duplicate jobs. |
| LI-02E | Booking worker and recovery | Embedded worker with database-backed claim/lease, stable idempotency key, retry/backoff, dead-letter visibility, external-reference recovery and no duplicate shipment after timeout. |
| LI-02F | Webhook receiver and tracking projection | Raw-body HMAC verification, timestamp tolerance, event dedupe, monotonic sequence, safe status projection and webhook acceptance tests. |
| LI-02G | Operational readiness | Warehouse/service-zone mapping acceptance, integration credentials, Render configuration, failure matrix, manual reconciliation and end-to-end staging tests. |

## 6. Non-negotiable invariants

1. Quote before customer payment; shipment booking only after verified payment.
2. One Logistic Hub shipment per MarketIQ seller fulfillment in v1.
3. Stable external fulfillment reference and idempotency key across every retry.
4. No customer charge initiated by Logistic Hub.
5. No booking request or external network call inside a MarketIQ database transaction.
6. Payment success is never rolled back because Logistic Hub is unavailable.
7. Seller-controlled fulfillment updates cannot overwrite Logistic Hub-owned shipment state.
8. Provider event receipt is not payment verification, order completion or seller settlement.
9. No synthetic users, fabricated coordinates, invented service zones or arbitrary fallback rates.
10. Every phase updates this contract and the repository README implementation status.

## 7. Release gates

Do not enable the provider in production until LI-02B–LI-02F tests pass, the MarketIQ integration client/credential and billing agreement are provisioned in Logistic Hub, a verified warehouse/service-zone mapping exists, Render worker and webhook configuration are confirmed, and staging proves quote → checkout → Paystack → booking → tracking end to end. Manual logistics payable reconciliation remains the v1 operating mode.

## LI-02B persistence implementation

The LI-02B schema/migration work is tracked on `feat/li-02b-logistics-persistence`. It is intentionally limited to persistence foundations; checkout, Paystack and worker runtime behavior are unchanged.

### Persistence decisions

- `LogisticsQuoteOption` stores each provider option independently, including the provider's opaque option reference, exact integer-kobo amounts, currency, optional expiry/service-level metadata and immutable option snapshot.
- `LogisticsQuote.selectedOptionId` records the accepted option. The existing quote amount fields are nullable until selection and remain a legacy selected-price snapshot for later checkout integration.
- `LogisticsQuote.externalFulfillmentReference` stores the stable provider-scoped fulfillment reference created before checkout and reused for booking.
- Quote idempotency keys, provider quote references, external fulfillment references, shipment idempotency keys and external shipment references are scoped by provider. Existing rows are retained; the old global unique indexes are replaced with provider-scoped indexes.
- Event sequence is unique per shipment when present, and positive when non-null. Provider event IDs remain unique within provider.
- Webhook receipts store the SHA-256 digest of the exact raw request body plus signature timestamp/version metadata. Raw body bytes are not retained by default to reduce PII retention. HMAC must be verified over raw bytes before a receipt is persisted.
- `Fulfillment.ownerMode` distinguishes `SELLER_MANAGED` from `LOGISTICS_PROVIDER_MANAGED`. Service-level enforcement is deferred to the lifecycle phases.

### Migration safety and scope

Migration `20261107150000_li_02b_logistics_persistence` is forward-only. It preserves existing quotes, shipments, events and receipts, and defaults existing fulfillment records to `SELLER_MANAGED`. It does not alter checkout totals, payment behavior, fulfillment transitions or worker runtime.

The next phase, LI-02C, will implement quote option acceptance and atomic checkout snapshots. No external Logistic Hub calls will be made inside a MarketIQ checkout transaction.
