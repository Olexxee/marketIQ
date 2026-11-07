# Logistic Hub Integration Contract v2 — MarketIQ

**Status:** Architecture and contract decisions approved for LI-02D planning. Documentation only: packing-photo capture, buyer review, cancellation coordination, payment-authorization changes and new media APIs are not yet implemented.

**Supersedes:** Conflicting MarketIQ-specific v1 assumptions about mirrored Logistic Hub customer/seller accounts, customer email transmission or Hub-side Paystack verification.

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

### Media transfer and access

The exact media transport endpoint is a future implementation detail; no new endpoint is implied by this document. Do not embed image binaries as base64 in shipment JSON and do not use permanent public URLs.

Use private object storage and a controlled server-to-server transfer or short-lived signed retrieval capability. Authenticate and authorize each transfer, constrain expiry and object scope, validate downloaded bytes, and avoid logging signed URLs. Logistic Hub retains a durable operational copy or durable controlled reference for the applicable evidence-retention period. MarketIQ remains responsible for buyer-facing authorization: the buyer views packing evidence through MarketIQ, not by receiving unrestricted Hub storage URLs.

## 5. Buyer review and cancellation coordination

MarketIQ owns the buyer-facing order timeline, evidence visibility, review-window policy and buyer cancellation decision. Logistic Hub owns execution of accepted operational instructions.

Target flow:

1. Seller prepares the seller order and submits up to four packing photographs.
2. MarketIQ associates evidence with the relevant seller fulfilment and sends it to Logistic Hub through the agreed media/evidence mechanism.
3. Logistic Hub records the evidence and emits a signed event referencing the external fulfilment and evidence-set/version.
4. MarketIQ displays the photographs to the buyer in the order timeline.
5. The buyer may raise an issue or request cancellation under MarketIQ's published policy.
6. MarketIQ sends a cancellation/hold instruction to Logistic Hub. Logistic Hub applies the permitted operational action and reports the actual outcome.
7. Final dispatch from a hub or the next delivery stage proceeds only according to the agreed MarketIQ authorization and Logistic Hub's operational state.

The review-window duration, timeout behavior, refund eligibility, seller response rules and the exact point at which dispatch becomes irreversible remain policy decisions to be finalized before implementation. Do not invent an automatic-approval timeout in code before those rules are approved.

A cancellation request is not a completed cancellation or refund. If a rider has already collected the parcel or it is in transit, the Hub may be unable to stop it immediately. The Hub reports actual custody and offers supported stop, hold, return-to-seller or return-to-hub actions. MarketIQ makes the customer refund decision and records the financial outcome.

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

All cross-system monetary values use exact integer minor-unit strings and explicit currency. Floating-point money calculations are prohibited.

## 8. Seller accountability

MarketIQ owns seller onboarding, seller terms, enforcement and buyer remedies. Its seller agreement should require accurate descriptions, variants, quantities and condition; genuine packing evidence; no substitution, counterfeit or prohibited goods; cooperation with disputes and lawful investigations; and defined remedies for proven misrepresentation.

The seller agreement must be reviewed by qualified Nigerian counsel. It may preserve MarketIQ's right to suspend sellers, withhold disputed amounts where lawful and contractually permitted, terminate accounts, preserve evidence and report suspected offences to competent authorities. Do not promise that a contract automatically makes a seller arrestable or determines criminal guilt; arrest and prosecution are matters for competent authorities under applicable law.

Logistic Hub preserves shipment, custody and packing evidence and provides auditable operational facts. It does not adjudicate seller fraud or enforce MarketIQ seller terms.

## 9. Existing constraints and implementation gates

- One Logistic Hub shipment per MarketIQ SellerOrder remains the v1 rule.
- The current LI-02C quote adapter rejects cart-line quantity greater than one because the package consolidation/separation model is not defined. This restriction remains until a tested packing model is implemented; the richer manifest contract does not silently remove it.
- MarketIQ variant measurement units must be confirmed against seller data entry. Current adapter assumptions (weight in kg, dimensions in cm) must not be treated as verified until confirmed or replaced with explicit unit metadata.
- Quote and shipment acceptance retain immutable request, option, price, package and billing-agreement snapshots.
- The Hub must not create synthetic sender/customer users to satisfy internal booking assumptions. The integration-owned shipment path remains sender-user independent.
- Existing generic integration APIs and webhook contracts remain the baseline; any payload/schema change must be versioned and implemented in both systems before use.

## 10. LI-02 delivery sequence

1. LI-02C post-merge hardening: confirm measurement units, retain quantity restriction until packing is designed, add checkout/Paystack amount tests and quote lifecycle recovery tests.
2. LI-02D: MarketIQ payment-verification transaction writes a durable shipment-authorization outbox event; payment response never waits for Hub.
3. LI-02E: embedded booking worker sends/retries authorization; Hub creates or recovers shipment idempotently and activates fulfilment.
4. LI-02F: signed event receiver and customer-facing tracking projection, including packing-evidence and cancellation coordination events.
5. LI-02G: four-photo media transfer, buyer review/cancellation policy, operational exception/return flows, reconciliation and staging end-to-end acceptance.

Every slice updates this contract and both repositories' implementation status. Documentation is not evidence that a feature is implemented.
