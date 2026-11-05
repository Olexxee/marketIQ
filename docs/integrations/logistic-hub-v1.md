# Logistic Hub Integration Contract — LI-01 / v1.0 (Draft for implementation)

**Status:** LI-01 audit complete; contract decisions documented. This is a versioned implementation contract, not a claim that endpoints or schema exist yet.

## 1. Audited current-state constraints

- MarketIQ default branch is `master`; Logistic Hub default branch is `main`.
- MarketIQ checkout currently creates an `Order` and one `SellerOrder` per seller. Checkout sets `shippingTotal: 0` and order total to merchandise subtotal. Payment is initiated against `Order.total`. Therefore the agreed platform-funded delivery charge is **not yet represented in checkout/payment totals**.
- MarketIQ `Fulfillment` is unique per `SellerOrder`, currently has a seller-managed status lifecycle, and stores a single `shippingCost`. It cannot safely become the Logistic Hub authoritative shipment lifecycle.
- MarketIQ `OutboxEvent` is a generic durable event table. `publishEvent` creates events transactionally, but a logistics event needs its own worker handler, claim/retry rules, idempotency and dead-letter visibility. Do not assume a worker already processes logistics.
- Logistic Hub parcel booking currently follows an internal sender and quote/payment lifecycle. Its current endpoint is not a marketplace integration API.
- Logistic Hub payment activation is disabled. Marketplace booking must not bypass or silently switch on payment/refund safeguards.

## 2. Domain ownership

| Concern | Authority |
|---|---|
| Buyer, seller, catalog, cart, checkout, order, seller order, customer payment/refund | MarketIQ |
| Seller warehouse mapping and checkout shipping charge | MarketIQ (mapping administratively configured; quote supplied by provider) |
| Logistics quote calculation, quote validity and booking snapshot | Logistic Hub |
| Shipment booking, delivery legs, dispatch, driver/partner/hub custody and exceptions | Logistic Hub |
| Customer-facing tracking projection | MarketIQ, derived from accepted provider events |
| Platform logistics payable and reconciliation | MarketIQ + Logistic Hub records; neither delivery nor webhook alone settles funds |

## 3. Required end-to-end flow

### 3.1 Pre-payment quote

1. MarketIQ resolves the cart into seller orders and eligible fulfilment groups.
2. For each seller order, MarketIQ resolves an active warehouse mapping and obtains destination/recipient/parcel details.
3. MarketIQ requests a Logistic Hub quote **before payment**.
4. Logistic Hub validates both endpoint service zones, partner/rate-card eligibility, parcel constraints and quote expiry.
5. MarketIQ displays the provider delivery charge and obtains customer acceptance.
6. Checkout persists the quote reference/version and delivery-charge snapshot; the customer payment amount includes merchandise + delivery charge + any separately supported charges.

**Current blocker:** existing checkout hardcodes shipping to zero. LI-02 must change checkout persistence/validation and Paystack payment amount coherently. Do not add delivery cost only after payment.

### 3.2 Post-payment booking

1. MarketIQ confirms Paystack success using its existing verified payment flow.
2. In the same MarketIQ DB transaction that marks payment/order success, enqueue one logistics booking event per eligible seller order/fulfilment.
3. The integration worker claims the event and submits a booking request referencing the accepted, unexpired provider quote.
4. Logistic Hub atomically enforces external idempotency and creates/reuses the marketplace shipment booking.
5. MarketIQ persists provider booking/tracking references and integration status.
6. A retry must reuse the same idempotency key and payload identity. It must never create a second booking or customer charge.

Paid order creation must remain successful if Logistic Hub is temporarily unavailable. Booking is asynchronous and visible as pending/failed/retryable to operations.

## 4. External identity and idempotency

All identifiers are opaque strings. Do not map MarketIQ IDs to Logistic Hub internal IDs.

- `sourceSystem`: constant `MARKETIQ`
- `externalOrderReference`: MarketIQ Order ID
- `externalSellerOrderReference`: MarketIQ SellerOrder ID
- `externalFulfillmentReference`: MarketIQ Fulfillment ID (or stable fulfilment intent ID created before provider call)
- `externalSellerReference`: MarketIQ SellerProfile ID
- `externalCustomerReference`: MarketIQ buyer ID; nullable for guest checkout only if guest checkout is actually supported
- `externalWarehouseReference`: MarketIQ Warehouse ID
- `externalQuoteReference`: Logistic Hub quote ID
- `externalShipmentReference`: stable MarketIQ fulfillment reference used for provider-side uniqueness

Logistic Hub uniqueness requirement: `(sourceSystem, externalFulfillmentReference)` must identify one booking. The request's idempotency key must be persisted and scoped to the integration client. Same key + same canonical payload returns the original result; same key + different payload returns conflict.

MarketIQ should use a persisted stable idempotency key, not generate a fresh key per retry.

## 5. Proposed v1 API surface

These are proposed integration endpoints; they are **not implemented yet**.

### Quote

`POST /api/v1/integrations/marketplace/quotes`

Request fields:
- `externalOrderReference`, `externalSellerOrderReference`, `externalFulfillmentReference`
- `externalSellerReference`, `externalWarehouseReference`
- `pickup`: address snapshot, verified latitude/longitude, service-zone mapping reference
- `destination`: address/recipient snapshot, verified latitude/longitude, service-zone mapping reference
- `parcel`: category, description, dimensions/weight where required, quantity, declared value where required
- `currency`: `NGN`
- `billingAgreementReference`

Response fields:
- `quoteReference`, `quoteVersion`, `status`, `expiresAt`
- `deliveryChargeMinor` (customer charge)
- `logisticsCostMinor` (provider agreed cost, if the provider contract exposes it)
- `currency`, `billingAgreementReference`
- provider eligibility/validation outcome and non-sensitive reason codes

Quote must be bound to the exact pickup/destination/parcel snapshot and external seller-order/fulfilment reference. Changing material details invalidates the quote and requires a new quote.

### Booking

`POST /api/v1/integrations/marketplace/shipments`

Headers:
- `Authorization: Bearer <integration credential>` (service credential, not customer JWT)
- `Idempotency-Key: <persisted key>`
- `X-Integration-Client: MARKETIQ`

Request:
- all external references above
- `quoteReference` + `quoteVersion`
- immutable pickup, destination, recipient and parcel snapshots
- `deliveryChargeMinor`, `logisticsCostMinor`, `currency`
- `billingAgreementReference`
- `customerPaymentStatus: PAID` and MarketIQ payment reference as audit metadata only; provider must not treat this as a Paystack transaction or charge the customer

Response:
- `shipmentReference` (Logistic Hub internal booking ID)
- `externalFulfillmentReference`
- `trackingReference`
- `status`
- accepted quote/billing snapshot
- `createdAt`

### Lookup

`GET /api/v1/integrations/marketplace/shipments/:shipmentReference`

Also support lookup by external fulfilment reference under authenticated client scope, so MarketIQ can recover from a lost response safely.

## 6. Monetary contract

**API boundary:** NGN integer minor units (kobo) encoded as decimal strings, e.g. `"125000"`. No floats.

MarketIQ's existing Prisma commerce amounts are `Decimal(12,2)` in naira, and Paystack currently converts naira to kobo. This is a real representation difference. LI-02 must implement an exact decimal-to-kobo conversion (no JS floating-point arithmetic) and add round-trip/precision tests. Do not silently reinterpret existing Decimal fields as kobo.

Keep these values distinct:
- customer delivery charge
- agreed logistics cost/payable
- order total paid by customer
- any discount, tax, subsidy or platform margin

The quote and booking must preserve the quote-time amount and billing-agreement version. Do not recalculate a historical booking using current partner rates.

## 7. Provider events / webhook contract

Logistic Hub → MarketIQ webhook endpoint (proposed):
`POST /api/v1/integrations/logistic-hub/webhooks`

Headers:
- `X-LogisticHub-Key-Id`
- `X-LogisticHub-Timestamp` (Unix seconds)
- `X-LogisticHub-Signature` (HMAC-SHA256 over timestamp + "." + raw body; exact canonicalization to be shared by both implementations)
- `X-LogisticHub-Event-Id`

Payload:
- `eventId`, `eventType`, `occurredAt`, `shipmentReference`
- `sourceSystem`, `externalFulfillmentReference`
- monotonic `eventSequence` per shipment (required to reject stale/out-of-order state transitions)
- `status`, optional tracking/custody milestone data, schema version

MarketIQ must:
1. Verify signature against raw request bytes and active key ID using timing-safe comparison.
2. Enforce timestamp tolerance and reject replay outside configured window.
3. Insert a webhook receipt with unique `(provider, eventId)` before applying the projection.
4. Apply events idempotently and only when sequence/version is newer.
5. Persist the raw/normalized event and processing result for audit.
6. Return success for already-processed duplicate events; do not apply twice.
7. Avoid letting provider events mutate MarketIQ customer payment, refund, seller settlement or order completion decisions.

Event families initially needed:
- shipment booked / booking rejected
- pickup scheduled / picked up
- hub received / hub released / custody handover
- in transit / delayed / exception opened / exception resolved
- out for delivery / delivered / delivery failed
- cancelled / returned (only when supported by Logistic Hub state machine)

Exact event names and transition mapping are finalized with LI-03 API implementation. MarketIQ's current `FULFILLMENT_SHIPPED` and `FULFILLMENT_DELIVERED` events are internal marketplace events, not a provider webhook contract.

## 8. Location and eligibility

- Warehouse mapping is explicit, admin-managed, active, and scoped to seller.
- Do not infer a Logistic Hub service zone from state/LGA/city alone.
- Pickup and destination must each resolve to active Logistic Hub service coverage.
- Coordinates must be verified from authoritative address/location capture; do not geocode/invent coordinates as a fallback.
- Quote/booking must reject inactive warehouse mappings, unsupported parcel categories, stale quotes and unsupported zones with stable error codes.
- Warehouse mapping changes must not rewrite existing shipment snapshots.

## 9. Retry, operations and reconciliation

- MarketIQ integration worker uses database-backed claims, lease/claim expiry, bounded exponential retry and dead-letter/failed state.
- Persist attempts, last error code, timestamps, next retry and correlation/idempotency keys.
- Separate integration job processing from email-only concerns; the current generic MarketIQ outbox is not proof of a logistics worker implementation.
- Operational dashboard/recovery must allow safe retry of a failed booking using the original key.
- Manual reconciliation is initial mode. A delivery milestone does not settle a payable.
- Reconcile cancellations, failed delivery, return-to-sender, partial refunds, provider cost adjustments and disputes explicitly.
- Never make a second customer charge because a provider request timed out.

## 10. Security and operational controls

- Dedicated revocable service credentials with rotation, scopes, environment separation and audit logging.
- Secrets only in Render environment variables/secret manager; never in repository or request logs.
- Rate limit integration endpoints and validate schemas strictly.
- Webhook secret/key rotation must support active and previous key during controlled overlap.
- Do not trust provider event payload as an instruction; treat it as signed but still validate event type, schema and transition.
- Do not enable Logistic Hub Paystack payments or refunds as part of this integration without separate explicit approval.

## 11. LI-01 audit outcome and next implementation slices

### LI-01 complete when
- [x] Repository ownership and current checkout/fulfilment/payment constraints audited.
- [x] Quote-before-payment and booking-after-payment sequencing clarified.
- [x] Separate service/database boundary retained.
- [x] External identity and idempotency model established.
- [x] Provider quote and booking API surfaces drafted.
- [x] Money representation mismatch recorded.
- [x] Webhook signature, dedupe and ordering requirements drafted.

### LI-02 — MarketIQ persistence and checkout
- Add provider and quote/shipment/event/receipt persistence after schema review.
- Introduce pre-payment quote request/acceptance into checkout.
- Include accepted delivery charge in order/seller-order totals and Paystack payment amount.
- Preserve existing inventory transaction and payment verification invariants.
- Add logistics booking outbox worker only after paid state is committed.

### LI-03 — Logistic Hub marketplace adapter
- Service authentication, external mapping, quote endpoint, booking endpoint and lookup.
- Reuse partner pricing/service-zone eligibility.
- Add source-system external references and marketplace billing agreement representation.
- Keep customer payment disabled for this provider-funded flow.

### LI-04 — Booking orchestration and LI-05 webhook sync
- Idempotent post-payment booking, signed webhook delivery/receipt, monotonic event processing and tracking projection.

### LI-06 — Manual reconciliation and release readiness
- Operational exception matrix, audit report, replay tests, integration contract tests and deployment/runbook.

## 12. Explicit non-goals for v1

- Shared databases or cross-service Prisma relations.
- MarketIQ managing Logistic Hub drivers, hubs, custody, legs or exception state.
- Logistic Hub charging the buyer directly.
- Automated partner settlement/payout.
- Shipment booking before verified customer payment.
- Treating the seller's existing fulfillment status as authoritative logistics status.
- Shipping unsupported locations or unverified coordinates.
