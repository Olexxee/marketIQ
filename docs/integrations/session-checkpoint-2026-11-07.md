# MarketIQ × Logistic Hub — Session checkpoint

**Checkpoint date:** 2026-11-07  
**Repository:** `Olexxee/marketIQ`  
**Integration contract:** [Logistic Hub Integration Contract v2](./logistic-hub-v2.md)

This is the hand-off point for the next development session. It records merged code separately from deployment and operational acceptance; do not treat one as proof of the other.

## 1. Where we stopped

The integration implementation has reached **LI-02F**.

| Slice | Scope | Code status |
|---|---|---|
| LI-02A | Contract/source audit and system boundaries | Merged |
| LI-02B | MarketIQ integration persistence | Merged |
| LI-02C | Hub quote acquisition, checkout pricing and financial allocation hardening | Merged |
| LI-02D | Atomic payment verification + shipment-authorization outbox | Merged |
| LI-02E | Embedded shipment-authorization worker and idempotent Hub booking | Merged |
| LI-02F | Signed Hub webhooks and buyer-scoped tracking projection | Merged |
| LI-02G | Packing evidence, buyer review and cancellation coordination | Not started |

### Latest merge

- **PR:** [#17 — LI-02F: signed Logistic Hub webhooks and buyer tracking](https://github.com/Olexxee/marketIQ/pull/17)
- **Merged:** 2026-11-07
- **Merge commit:** `37f98358b9db46420edee082ca573484ffcf730a`
- **PR head tested:** `d00daa6aff8e168428f33aa08b412589abb024bf`
- **CI on that exact PR head:** Backend CI #227 and Backend checks #342 both passed.
- **Validation:** Prisma validation, clean PostgreSQL migration and 116/116 automated tests passed in CI.

The feature branch is one merge commit behind `master`; continue from the updated `master`, not from the old feature branch.

## 2. What LI-02F delivered

- Inbound receiver: `POST /api/integrations/logistic-hub/webhook`.
- Verifies HMAC-SHA256 against the exact raw request bytes and timestamp, with constant-time digest comparison, timestamp tolerance and event-header consistency checks.
- Uses a dedicated inbound secret: `LOGISTIC_HUB_WEBHOOK_SECRET`. This is not the outbound integration client secret.
- Stores verified receipt metadata and a SHA-256 body fingerprint; does not persist the raw webhook body.
- Deduplicates by provider + event ID.
- Stores sanitized shipment events and protects the current projection from stale sequence updates and sequence collisions.
- Returns retryable 503 if an event arrives before MarketIQ has persisted the corresponding local Hub booking reference, allowing Hub delivery retry.
- Buyer tracking endpoint: `GET /api/checkout/logistics/shipments/:sellerOrderId/tracking`.
- Tracking is scoped through the authenticated buyer's own order.
- Hub operational status remains separate from MarketIQ booking, order and payment states. Hub events do not mark payments paid, issue refunds, complete orders or settle sellers.

## 3. Deployment and staging status — still unverified

The following must **not** be assumed complete merely because the code is merged or CI is green:

- The LI-02F Prisma migration has passed in CI, but production Render migration execution has not been confirmed in this checkpoint.
- The inbound webhook secret has not been confirmed configured on MarketIQ Render.
- The callback has not been confirmed registered in Logistic Hub webhook management.
- Real Hub-to-MarketIQ webhook delivery and buyer tracking have not been confirmed in configured-Hub staging.
- LI-02E shipment worker must remain disabled until staging acceptance is complete:
  `LOGISTIC_HUB_SHIPMENT_WORKER_ENABLED=false`.
- LI-02E worker is embedded in the MarketIQ server; do not create a separate paid worker service.
- Do not claim end-to-end shipment automation is live based on merged code alone.

### LI-02F deployment checklist

1. Confirm the MarketIQ Render start command runs the controlled Prisma migration step before server startup, or apply the migration explicitly against the production database using the established deployment procedure.
2. Configure `LOGISTIC_HUB_WEBHOOK_SECRET` on MarketIQ Render using the one-time endpoint secret issued by Logistic Hub.
3. Register `https://marketiq-k9uh.onrender.com/api/integrations/logistic-hub/webhook` in Logistic Hub webhook management.
4. Subscribe only to event types supported by the v2 contract.
5. Deliver a real test event and verify signature acceptance, receipt persistence, event deduplication and shipment projection.
6. Verify buyer A can see their own shipment timeline and buyer B cannot access it.
7. Replay a duplicate event, deliver an older sequence after a newer one, and simulate an event arriving before the local booking record. Confirm the expected dedupe, non-regression and retry behavior.

## 4. Earlier release gates still open

LI-02C through LI-02F being merged does not mean the complete integration has passed operational acceptance. The following remain explicit gates:

- Seller physical variants have valid positive measurements, explicit units and measurement source. No guessed legacy backfill.
- Real Hub quote tests use configured warehouse mapping and actual staging destinations.
- Quote acceptance, expiry and immutable snapshot mismatch behavior are verified.
- Paystack verification matches the exact expected amount and currency, including delivery.
- Seller settlement excludes customer delivery charges.
- Historical settlement/refund allocation and suspense balances are reconciled.
- Shipment authorization is exercised against a configured Hub client and billing agreement.
- Timeout-after-Hub-commit recovers the same shipment rather than creating a duplicate.
- Transient Hub outage retries; permanent validation errors are dead-lettered and recoverable through controlled operations.
- Signed webhook delivery and buyer-scoped tracking pass the LI-02F checklist above.

## 5. Next development phase — LI-02G

Start with a design/contract pass before writing code. The agreed direction is:

### Packing evidence

- Maximum **four packing photographs per SellerOrder/fulfilment**.
- Packing photos only; catalogue/product images are not packing evidence.
- Four intended slots:
  1. Full contents together.
  2. Product/variant identifying details.
  3. Quantity/accessory verification.
  4. Final packed/sealed parcel before handover.
- Buyer can inspect the evidence while the parcel is being sent to the Hub and can raise an issue or request cancellation.
- Evidence is not proof of delivery.
- Preserve originals; replacements must create audited versions, not silently overwrite evidence.
- Private media storage and authenticated server-to-server transfer or short-lived scoped retrieval. No base64 blobs in shipment JSON and no permanent public media URLs.

### Decisions that must be settled before implementation

- Exact buyer review window and what happens if the buyer does not respond. **No automatic approval timeout has been agreed.**
- What buyer actions are allowed during review: issue report, cancellation request, or both; define state transitions and seller notification.
- Whether dispatch is held pending buyer review and the precise custody/operational cutoff after which cancellation becomes a return/stop request.
- How MarketIQ communicates a cancellation request to Hub, how Hub reports whether it can stop/hold/return a shipment, and how MarketIQ alone decides and executes any refund.
- Evidence access control, retention, replacement, audit and dispute export requirements.
- Seller agreement enforcement language and remedies. Nigerian counsel must review it. A seller contract does not itself authorize arrest or determine criminal guilt.

Do not conflate a buyer cancellation **request** with a completed cancellation or refund. Hub reports operational feasibility; MarketIQ owns order and financial decisions.

## 6. Architectural invariants — do not regress

- MarketIQ owns buyers, sellers, products, orders, payment verification, refunds, seller settlement and buyer-facing review.
- Logistic Hub owns quotes, shipment execution, partner/rider assignment, custody, route and delivery operations.
- Separate databases and identities; no cross-database reads or writes.
- MarketIQ is the sole Paystack verification authority.
- Payment success must not wait for Hub availability. Shipment authorization remains an outbox-driven asynchronous action.
- Platform-funded logistics billing remains the model; no automatic Hub payout at shipment booking.
- Keep merchandise subtotal, buyer delivery charge, Hub logistics cost, discounts/taxes, delivery margin/subsidy, seller payable and refunds distinct.
- Use exact integer minor-unit amounts with explicit currency; no floating-point money arithmetic.
- One Hub shipment per MarketIQ SellerOrder remains the v1 rule.
- Never transmit buyer login credentials, JWTs, email addresses, card/bank data or raw payment-provider payloads to Hub.
- Hub webhook events must never mutate payment, refund or seller-settlement state.

## 7. First actions next session

1. Pull the latest `master` and confirm merge commit `37f98358b9db46420edee082ca573484ffcf730a` is present.
2. Confirm whether the LI-02F migration and webhook secret are deployed/configured; do not guess.
3. Complete the LI-02F configured-Hub staging checks that can be run safely.
4. Then begin LI-02G with the unresolved buyer-review, dispatch-hold and cancellation semantics. Document those decisions before implementing the workflow.

---
**Stop point:** LI-02F code is merged and CI-green. LI-02F deployment/staging acceptance is unconfirmed. LI-02G has not started.
