# Logistic Hub Integration Contract v2 — MarketIQ

**Status:** LI-02G-A, LI-02G-B, LI-02G-C1A and LI-02G-C2 are merged across the two backends. LI-02G-C3 is implementing MarketIQ buyer cancellation requests, durable Hub stop/return commands and a separate resolution state machine. The shared embedded logistics workers remain opt-in and disabled by default; merged code and CI are not proof of production deployment or configured-Hub staging acceptance.

**Supersedes:** Conflicting MarketIQ-specific v1 assumptions about mirrored Logistic Hub customer/seller accounts, customer email transmission or Hub-side Paystack verification.

**Storefront implementation specification:** [Orders, fulfilment, packing evidence and buyer review](https://github.com/Olexxee/marketIQ-storefront/blob/docs/li-02g-frontend-packing-evidence/docs/logistics-packing-evidence-workflow.md).

## 1. Purpose and system boundary

MarketIQ and Logistic Hub are separate products, services, databases and systems of record. They communicate through a versioned, authenticated integration contract. They do not share databases, internal user identities or domain state.

| Domain | Authority |
|---|---|
| Buyer/seller accounts, authentication and account contact details | MarketIQ |
| Catalogue, products, variants, inventory and seller policies | MarketIQ |
| Cart, checkout, order and seller-order lifecycle | MarketIQ |
| Customer payment verification, refund decision and seller settlement | MarketIQ |
| Seller packing workflow and buyer-facing review/cancellation decision | MarketIQ |
| Accepted logistics quote and shipment execution | Logistic Hub |
| Hub operations, route planning, partner/rider assignment, custody and delivery | Logistic Hub |
| Logistics operational cost records and shipment events | Logistic Hub |
| Platform-to-Hub billing reconciliation | Shared financial records; MarketIQ remains payer under the platform-funded agreement |

Neither system may directly read or write the other's database. Each system owns its internal state machine. The integration carries external references and authenticated facts, not foreign database identities.

## 2. Payment authority and asynchronous fulfilment

MarketIQ is the sole authority for whether the customer's MarketIQ payment is verified.

1. MarketIQ collects the full payable amount through its configured payment provider. The amount includes merchandise, accepted delivery charges and applicable adjustments.
2. MarketIQ independently verifies the payment using its payment-provider verification/webhook controls and exact amount/currency comparison.
3. In one MarketIQ database transaction, MarketIQ records payment success, confirms the eligible order state, records financial allocations and inserts a durable shipment-authorization outbox event for each eligible seller fulfilment.
4. MarketIQ returns payment success without waiting for Logistic Hub.
5. An embedded/background MarketIQ worker sends the authorization to Logistic Hub using a stable external fulfilment reference and idempotency key.
6. Logistic Hub authenticates the integration client, validates the authorization against the accepted quote, billing agreement and shipment snapshot, creates or recovers the shipment, and activates its fulfilment workflow.
7. Logistic Hub assigns/activates a rider when its operational rules permit. Rider availability or dispatch delays do not change MarketIQ payment success.

**No synchronous Logistic Hub call is allowed inside the MarketIQ payment-verification transaction or buyer payment-success response.** A Hub outage must not roll back a verified MarketIQ payment. The outbox is at-least-once; both systems must make retries idempotent.

Logistic Hub does not call Paystack, collect from the buyer, create a second customer charge, or independently re-verify the customer's transaction. The authenticated MarketIQ service authorization is the payment authority presented to the Hub.

### Payment authorization facts

The authorization contract must carry, at minimum:

- Authenticated client context. Client identity is derived from credentials, not trusted from an arbitrary body field.
- Unique external fulfilment reference and MarketIQ order/seller-order references.
- Verified payment-provider reference only; never card credentials or secrets.
- Payment state VERIFIED and verification timestamp.
- Currency and exact integer minor-unit amount authorized for delivery.
- Accepted Logistic Hub quote-session and option references.
- Billing-agreement reference/version.
- Stable idempotency key and correlation ID.

The Hub rejects an amount, currency, quote, option, billing agreement or external-fulfilment-reference mismatch. Repeated identical authorization returns the existing shipment. Reuse of the same idempotency key with a different canonical payload is a conflict.

MarketIQ remains responsible for subsequent refund, reversal and chargeback decisions. It must send a durable cancellation/reversal notification to the Hub. The Hub decides and reports what operational intervention is possible based on assignment and custody state. A financial reversal must never be inferred from a shipment status.

## 3. Data minimization and external identity

Logistic Hub does **not** need a MarketIQ customer account, seller account or platform login.

Do not create a Logistic Hub user for every MarketIQ buyer or seller solely to support an integration shipment. Do not transmit:

- Customer email address.
- MarketIQ account ID or authentication subject.
- Passwords, access/refresh tokens or customer JWTs.
- Seller login credentials or private account profile.
- Payment card, bank credentials, CVV, OTP or raw payment-provider payload.
- Unrelated cart history, purchase history or analytics.

Send only operational facts required to quote, collect, transport and deliver the goods:

- Opaque MarketIQ order and seller-fulfilment references.
- Accepted quote and payment-authorization references.
- Pickup address, verified coordinates and operational pickup contact where required.
- Recipient name, delivery phone number, delivery address and verified coordinates.
- Seller/warehouse display or operational contact details only where required for pickup coordination.
- Goods manifest and package measurements.
- Up to four packing photographs and evidence metadata.
- Handling instructions, declared value and restricted/fragile/perishable indicators where relevant to safe and lawful carriage.

The recipient is not assumed to be the MarketIQ buyer. The recipient's operational contact data is not a platform account identity. Logistic Hub retains only data needed for the shipment, safety, legal obligations, dispute handling and defined retention period.

## 4. Goods manifest and packing evidence

The integration carries a structured goods manifest for each seller fulfilment. A manifest item supports an external item/line reference, product name and SKU where available, variant description/selected attributes, quantity, mapped category, concise handling-relevant description, declared value/currency where required, package association and declared measurements with explicit units/source.

Do not treat catalogue imagery as proof of what was packed. **MarketIQ v2 sends packing photographs only; product catalogue images are not required by Logistic Hub.**

### Four-photo limit

A maximum of **four packing photographs per seller fulfilment/shipment** is allowed:

1. Full contents: all items intended for the parcel visible together.
2. Product/variant detail: distinguishing details, model, colour, serial/identifying marks where appropriate and safe.
3. Quantity check: items/accessories laid out to substantiate manifest quantity.
4. Final packed/sealed parcel: resulting package before handover/dispatch.

These are packing-evidence images, not proof of delivery. Each image record includes external shipment/fulfilment reference, evidence type/slot, capture timestamp, submitting actor reference, media checksum, content type, byte size, upload/verification state and version. Preserve original evidence and audit changes. Replacements create a new version; they must not silently overwrite the original.

### Media transfer and access — LI-02G-A

The implementation uses a server-to-server binary upload; image bytes are not embedded in shipment JSON and no permanent public URL is shared.

- Seller upload: `POST /api/seller/fulfillments/:fulfillmentId/packing-evidence` on MarketIQ, authenticated as the owning active seller. The multipart request contains one `image` file and a `slot` field; the request must include an `Idempotency-Key`.
- MarketIQ verifies seller ownership, paid order state, pre-dispatch fulfilment state and an already-booked Logistic Hub shipment before forwarding the bytes.
- Hub upload: `POST /api/v1/integrations/shipments/by-external-reference/:externalFulfillmentReference/packing-evidence`, authenticated with the integration credential and `shipments:write`. The request uses `application/octet-stream` with explicit evidence slot, actor reference, filename and content-type headers.
- Hub accepts JPEG, PNG and WebP only, verifies file signatures, enforces a 5 MiB limit, computes SHA-256 and stores the image as an authenticated/private Cloudinary asset. The database retains the object path and immutable evidence metadata; no public asset URL is returned.
- The four active slots are `CONTENTS_OVERVIEW`, `PRODUCT_DETAILS`, `QUANTITY_CHECK` and `SEALED_PARCEL`. Replacing a slot creates a new monotonically increasing version; prior versions remain stored. Buyer listing exposes the latest version of each slot, not the entire replacement history.
- Buyer reads are authorized by MarketIQ against the buyer's own SellerOrder and proxied through `GET /api/checkout/logistics/shipments/:sellerOrderId/packing-evidence` and `GET /api/checkout/logistics/shipments/:sellerOrderId/packing-evidence/:evidenceId/download`. Hub independently verifies that the evidence ID belongs to the external fulfilment reference in the download path.
- The Hub evidence record is canonical. It includes server upload time, MarketIQ seller actor reference, slot/version, byte size, MIME type and checksum. Hub also records an internal BookingEvent for the evidence receipt. The integration does not expose Hub storage credentials or signed Cloudinary URLs to the browser.

Packing evidence upload is not proof of pickup, custody or delivery. LI-02G-A does not authorize automatic dispatch, buyer auto-approval, cancellation or refund. Those behaviors remain in LI-02G-B.

## 5. Buyer review and cancellation coordination

**Frontend implementation specification:** [MarketIQ Storefront — Orders, Fulfilment and Packing Evidence](https://github.com/Olexxee/marketIQ-storefront/blob/main/docs/logistics-packing-evidence-workflow.md). This describes proposed frontend routes and the exact backend endpoints. The storefront currently has no order-management screens; the UI work remains separate from the merged backend implementation.

MarketIQ owns the buyer-facing order timeline, evidence visibility, review-window policy and buyer cancellation decision. Logistic Hub owns execution of accepted operational instructions.

Approved LI-02G-B policy baseline and implementation sequence:

1. Seller must submit all four required evidence slots within **24 hours of the Hub shipment booking timestamp**. The Hub records booking time; MarketIQ derives the evidence deadline from that immutable timestamp.
2. After all four slots are accepted, MarketIQ asks Logistic Hub to freeze the evidence set. The Hub serializes the freeze against concurrent uploads and rejects all later uploads/replacements for that shipment. Evidence versions are therefore immutable during buyer review.
3. MarketIQ starts a **four-hour buyer review window** only after the Hub confirms the freeze. MarketIQ notifies the buyer and exposes the latest four private images through buyer-authenticated endpoints.
4. The buyer may approve early. MarketIQ records the decision and queues a durable dispatch-release command.
5. If the buyer takes no action before the four-hour deadline, MarketIQ records automatic dispatch authorization and queues the same durable command with reason `REVIEW_TIMEOUT`. This timeout is a logistics-release rule, not a waiver of statutory consumer rights, warranty rights or post-delivery remedies.
6. Logistic Hub enforces the dispatch gate at partner assignment. Assignment remains blocked until the authenticated MarketIQ client releases the hold. The Hub remains authoritative for assignment and custody state.
7. If the seller has not completed all four slots within 24 hours, MarketIQ marks the review `EVIDENCE_OVERDUE`, keeps dispatch blocked and raises an operational exception. There is no automatic cancellation or refund for missing evidence.
8. Buyer cancellation before pickup is a cancellation request, not a completed cancellation. After pickup, the buyer's request is treated as a return/stop request, not an immediate cancellation. Logistic Hub must confirm the actual custody outcome. Refund decisions and Paystack processing remain admin-controlled in MarketIQ.
9. The seller cannot veto a buyer cancellation request. A seller rebuttal is handled through MarketIQ support and must not bypass the Hub custody state.

The review and dispatch-release worker runs inside the existing MarketIQ server process; no separate Render worker service is introduced. It is controlled by the existing opt-in shipment-worker setting and remains disabled by default until staging acceptance. The current LI-02G-B implementation covers evidence freeze, buyer review, approval/timeout dispatch release and the Hub assignment gate. Cancellation/return commands and operational exception handling remain subsequent implementation work.

A cancellation request is never proof that a shipment has been stopped, returned or refunded. The Hub reports actual custody and supported stop/hold/return outcomes; MarketIQ records the financial decision separately.

### LI-02G-C3 — buyer cancellation and return request API

MarketIQ exposes buyer-authenticated endpoints under the existing `/api/checkout/logistics` route:

- `POST /shipments/:sellerOrderId/cancellation-request` with a JSON body containing a required `reason` (5–1000 characters).
- `GET /shipments/:sellerOrderId/cancellation-request` to retrieve the request state.

The authenticated buyer must own the paid seller order, and its Logistic Hub shipment must already be booked. The API creates one durable resolution request per seller order; repeat submissions return the existing request rather than creating duplicate commands. The request and its outbox event are committed in one MarketIQ transaction.

The embedded LI-02G-C3 worker first asks Logistic Hub to stop the shipment using a stable idempotency key. If and only if Hub responds with the explicit custody/stop-window conflict codes `INTEGRATION_SHIPMENT_IN_CUSTODY_USE_RETURN` or `INTEGRATION_SHIPMENT_STOP_WINDOW_CLOSED`, MarketIQ submits the Hub return-request command with its own stable idempotency key. Other conflicts are not silently converted into returns.

Resolution states:

| State | Meaning |
|---|---|
| `COMMAND_PENDING` | Buyer request and durable command are stored; Hub has not confirmed an outcome |
| `COMMAND_PROCESSING` | Embedded worker has claimed the command |
| `STOP_CONFIRMED` | Hub confirmed the pre-custody stop; MarketIQ shipment projection is marked cancelled |
| `RETURN_REQUESTED` | Hub durably accepted a return request; this is not physical return confirmation |
| `REJECTED` | Hub rejected the request for a non-retryable operational or state conflict |
| `FAILED` | Command exhausted its retry budget or could not be completed |

A confirmed Hub stop does **not** automatically cancel the MarketIQ seller order, issue a refund, reverse Paystack, or adjust seller settlement. Those are separate MarketIQ financial and order decisions. A return acknowledgement always keeps `physicalReturnConfirmed=false`; it does not prove the parcel was stopped, recovered, routed back or received by the seller/hub. C4 must reconcile signed Hub outcome webhooks; a later physical-return execution phase must add actual reverse-route and custody milestones.

The worker runs in the existing MarketIQ server process, shares the existing opt-in shipment-worker setting, and remains disabled by default. No separate Render worker service or production configuration change is part of this phase.

## 6. Event ownership and external references

An event belongs to the system where the underlying action occurred. The receiving system stores an external event reference and a local projection/receipt; it does not claim ownership of the source system's internal event or mutate the source system's database.

Every cross-system event carries:

- Authenticated source client/system.
- Unique source external event ID.
- Event type and schema version.
- Occurrence timestamp and received timestamp.
- External order and external fulfilment references.
- Correlation/causation reference where available.
- Minimal event data needed by the receiver.

Examples:

| Event | Authoritative owner | Other system's responsibility |
|---|---|---|
| Payment verified, refunded, reversed or disputed | MarketIQ | Logistic Hub stores external payment/financial event reference and applies permitted operational policy |
| Seller packing started / packing evidence submitted | MarketIQ seller workflow; evidence receipt recorded by Hub | Hub records evidence and emits acknowledgement/event |
| Buyer review or cancellation decision | MarketIQ | Hub executes the instruction where operationally possible |
| Shipment accepted / rider assigned / pickup / hub custody / transit / delivery | Logistic Hub | MarketIQ updates its customer-facing projection |
| Logistics cost adjustment/reconciliation | Hub source record plus MarketIQ payable ledger | Both reconcile by external shipment and billing-agreement references |

The receiving system deduplicates by source + external event ID, preserves event ordering/sequence where supplied, rejects invalid signatures and never applies stale events over newer state. Provider events must not directly complete MarketIQ payment, issue refunds, settle sellers or change MarketIQ account/order ownership.

## 7. Financial boundary

- MarketIQ collects customer payment and owns payment verification.
- The integration is platform-funded: MarketIQ owes Logistic Hub the accepted logistics cost under a versioned billing agreement.
- Customer delivery charge, Hub logistics cost, merchandise amount, discounts, taxes, platform margin/subsidy, seller payable and refunds remain separate ledger concepts.
- The Hub validates payment authorization against the accepted quote and amount; it does not independently verify Paystack.
- Shipment delivery does not mean the logistics invoice is settled.
- Manual reconciliation remains the initial settlement model. Do not implement automatic transfers/payouts as part of shipment booking.
- Seller settlement is calculated against merchandise subtotal only; customer delivery charges are never seller proceeds.
- Payment capture records Hub logistics cost as a separate payable and customer-delivery margin/subsidy separately. Legacy delivery charges without a quote and ordinary refunds without a verified allocation remain in suspense accounts until reconciliation.
- A successful refund requires an explicit, documented seller-settlement adjustment before approval/payout; do not infer the refund allocation from the gross refund amount.

All cross-system monetary values use exact integer minor-unit strings and explicit currency. Floating-point money calculations are prohibited.

## 8. Seller accountability

MarketIQ owns seller onboarding, seller terms, enforcement and buyer remedies. Its seller agreement should require accurate descriptions, variants, quantities and condition; genuine packing evidence; no substitution, counterfeit or prohibited goods; cooperation with disputes and lawful investigations; and defined remedies for proven misrepresentation.

The seller agreement must be reviewed by qualified Nigerian counsel. It may preserve MarketIQ's right to suspend sellers, withhold disputed amounts where lawful and contractually permitted, terminate accounts, preserve evidence and report suspected offences to competent authorities. Do not promise that a contract automatically makes a seller arrestable or determines criminal guilt; arrest and prosecution are matters for competent authorities under applicable law.

Logistic Hub preserves shipment, custody and packing evidence and provides auditable operational facts. It does not adjudicate seller fraud or enforce MarketIQ seller terms.

## 9. Existing constraints and implementation gates

- One Logistic Hub shipment per MarketIQ SellerOrder remains the v1 rule.
- The current LI-02C quote adapter rejects cart-line quantity greater than one because the package consolidation/separation model is not defined. This restriction remains until a tested packing model is implemented; the richer manifest contract does not silently remove it.
- Physical ProductVariant measurements now use explicit seller-declared units: weight in kg or g, dimensions in cm or mm. MarketIQ converts these to integer grams/millimetres using upward rounding.
- Legacy variants are not backfilled with guessed units. A physical variant without positive weight, all three positive dimensions, supported units and a measurement source is ineligible for a new delivery quote until reviewed and updated.
- Digital variants are not eligible for parcel quotes and do not require physical measurements.
- Quote and shipment acceptance retain immutable request, option, price, package and billing-agreement snapshots.
- The Hub must not create synthetic sender/customer users to satisfy internal booking assumptions. The integration-owned shipment path remains sender-user independent.
- Existing generic integration APIs and webhook contracts remain the baseline; any payload/schema change must be versioned and implemented in both systems before use.

## 10. LI-02 delivery sequence

1. LI-02C post-merge acceptance hardening: explicit package measurement units/source and legacy-data fail-closed behavior; exact integer-kobo/reference/currency validation in both Paystack verification paths; seller settlement capped at merchandise subtotal; payment-capture allocation across seller payable, Hub payable, delivery margin/subsidy and tax; suspense accounts for legacy delivery charges and unallocated refunds. Unit and PostgreSQL concurrency tests pass; configured-Hub staging and full checkout/payment acceptance remain release gates.

**Production rollout gate:** MarketIQ Render auto-deploys from `master`, and its current start command does not apply Prisma migrations. Before merging the backend PR, configure the Render Start Command as `npx --yes prisma@6.19.0 migrate deploy && node src/server.js`, or disable auto-deploy and apply `npm run prisma:migrate:deploy` against the production database before redeploying. Deploy the backend first, verify the migration and health, then deploy the storefront; pause seller variant edits during the gap because the new backend requires measurements the old UI does not send. CI migration success applies only to its isolated test database.
2. LI-02D: **merged** — the shared Paystack success transaction writes one database-deduplicated authorization event for each SellerOrder with an accepted Hub quote. The generic event worker excludes this event type for the dedicated LI-02E worker. No Hub network request is made in the payment path.
3. LI-02E: **merged** — embedded MarketIQ server worker claims only shipment-authorization events; validates payment/quote/billing snapshots; performs client-scoped external-reference recovery before shipment creation; uses the stable outbox idempotency key; stores the Hub response locally; retries transient network/408/429/5xx failures with bounded backoff and dead-letters permanent/exhausted failures. Worker is disabled by default using `LOGISTIC_HUB_SHIPMENT_WORKER_ENABLED=false` until production configuration and staging acceptance are approved. Shipment creation remains Hub-owned; booking starts at `AWAITING_PARTNER_ASSIGNMENT`.
4. LI-02F: **merged** — verifies the exact raw request bytes using the Hub's `t=...,v1=...` HMAC-SHA256 contract, timestamp tolerance and matching event headers; deduplicates by provider/event ID; stores a sanitized event ledger and verified receipt; serializes per-shipment sequence projection; exposes buyer-authenticated tracking for the owning order. Hub status is stored separately from MarketIQ booking/payment/order states.
5. LI-02G: four-photo private media transfer, buyer review/cancellation policy, operational exception/return flows, reconciliation and configured-Hub staging acceptance.

LI-02D events preserve the accepted quote request/option snapshot and the billing-agreement reference/version captured when the quote was requested. Configure `LOGISTIC_HUB_BILLING_AGREEMENT_VERSION` before authorizing live shipments. Events missing required contract facts are retained with explicit blocking reasons and must not be submitted by LI-02E.

LI-02E retry policy uses the existing outbox attempt counter: 5 seconds, 15 seconds, 1 minute, 5 minutes, 15 minutes, then 1 hour between retries, with a maximum of 12 attempts before the event is marked `FAILED`. A retry always looks up the external fulfilment reference first; if the Hub committed a shipment but MarketIQ lost the response, the existing booking is recovered rather than duplicated. A 404 lookup alone permits create; other lookup failures prevent create and are retried or dead-lettered according to provider retryability. Operators can requeue a dead-lettered event only after correcting the cause and confirming that no duplicate shipment exists.

## LI-02F — Signed Hub webhooks and buyer tracking projection

MarketIQ receives Logistic Hub deliveries at:

`POST /api/integrations/logistic-hub/webhook`

The receiver consumes the exact request bytes before JSON parsing. The signing secret is the one-time endpoint secret issued by Logistic Hub webhook management and is configured separately from the outbound integration credential as `LOGISTIC_HUB_WEBHOOK_SECRET`. Default timestamp tolerance is 300 seconds; the accepted configuration range is 30–600 seconds.

The Hub signs `<unix-seconds>.<exact-raw-body>` using HMAC-SHA256. MarketIQ verifies the digest with constant-time comparison and requires the signature timestamp to match `X-Logistic-Hub-Timestamp` and fall within tolerance. It also requires these headers to match the signed envelope:

- `X-Logistic-Hub-Event-Id`
- `X-Logistic-Hub-Event-Type`
- `X-Logistic-Hub-Event-Sequence`
- `X-Logistic-Hub-Timestamp`
- `X-Logistic-Hub-Signature: t=<unix-seconds>,v1=<hex-digest>`

The v1 JSON envelope is `{ id, type, schemaVersion, occurredAt, sequence, data }`; `data` contains only `shipmentReference` and resulting `status`. The accepted event vocabulary is `shipment.created`, `shipment.partner_assigned`, `shipment.in_transit`, `shipment.custody_handover_confirmed` and `shipment.delivery_leg_completed` (the latter may represent multiple Hub custody milestones).

After signature verification, MarketIQ stores a verified receipt with the SHA-256 body fingerprint (not the raw body), deduplicates by provider + event ID, and appends a sanitized `LogisticsEvent`. A shipment-row lock serializes sequence checks. Older events remain in the audit timeline but cannot regress the latest `providerStatus`; a conflicting event ID at an already-used shipment sequence is retained as a failed receipt for reconciliation. If the webhook arrives before LI-02E has persisted the local Hub tracking reference, MarketIQ returns a retryable 503 so Hub delivery retries rather than acknowledging a lost event.

Buyer tracking is exposed at:

`GET /api/checkout/logistics/shipments/:sellerOrderId/tracking`

The endpoint requires the authenticated, verified buyer and scopes the shipment through its owning order. It returns the Hub tracking reference, MarketIQ booking status, separate Hub `providerStatus`, last sequence and ordered sanitized event timeline. It does not mutate MarketIQ order/payment/refund/settlement state. Packing evidence, buyer review and cancellation commands are implemented in the subsequent LI-02G phases; physical return execution and refund review remain separate follow-up work.

Every slice updates this contract and both repositories' implementation status. Documentation is not evidence that a feature is implemented.
