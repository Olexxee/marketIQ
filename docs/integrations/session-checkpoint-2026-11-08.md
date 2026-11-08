# MarketIQ × Logistic Hub — Session checkpoint

**Checkpoint date:** 2026-11-08  
**Repository:** `Olexxee/marketIQ`  
**Integration contract:** [Logistic Hub Integration Contract v2](./logistic-hub-v2.md)

This checkpoint records merged implementation separately from deployment, staging acceptance and policy approval.

## 1. Current implementation status

| Slice | Scope | Code status |
|---|---|---|
| LI-02A | Contract/source audit and system boundaries | Merged |
| LI-02B | MarketIQ integration persistence | Merged |
| LI-02C | Hub quote acquisition, checkout pricing and financial allocation hardening | Merged |
| LI-02D | Atomic payment verification + shipment-authorization outbox | Merged |
| LI-02E | Embedded shipment-authorization worker and idempotent Hub booking | Merged |
| LI-02F | Signed Hub webhooks and buyer-scoped tracking projection | Merged |
| LI-02G-A | Private four-slot packing evidence backend | Merged |
| LI-02G-B | Buyer review window and dispatch gate | Merged |
| LI-02G-C1A | Partner-to-recipient delivery closure | Merged |
| LI-02G-C2 | Hub stop and return-request commands | Merged |
| LI-02G-C3 | Buyer cancellation/return request API and durable command worker | Merged |
| LI-02G-C4 | Signed Hub cancellation/return outcome reconciliation | Merged |
| LI-02G-C5 | Admin refund review and financial resolution | Next phase; policy/design audit started |

### Latest merge — LI-02G-C4

- **PR:** [#23 — reconcile signed Hub cancellation and return outcomes](https://github.com/Olexxee/marketIQ/pull/23)
- **Merged:** 2026-11-08
- **Merge commit:** `4c4a3141f5eaa3d1bc381a0c0d5e4d7ec6ae3b9e`
- **PR head:** `0ad80c0ada766efe0c11dee8bf83f74c8137d443`
- **Changed files:** webhook repository, webhook repository tests, integration contract.
- **Validation:** Both CI workflows on the PR head passed. Prisma validation/generation, clean PostgreSQL migration deploy and full backend test suite passed.
- **Schema:** No migration required.

## 2. What C4 delivered

The existing LI-02F signed webhook receiver now reconciles newer accepted events transactionally:

- `shipment.cancelled` projects the local logistics shipment to `CANCELLED`, eligible buyer resolution requests to `STOP_CONFIRMED`, and the related packing review to `CANCELLATION_CONFIRMED`.
- `shipment.return_requested` projects eligible buyer resolution requests and packing reviews to `RETURN_REQUESTED`, without cancelling the local booking.
- Both event types preserve `physicalReturnConfirmed=false`.
- Projection only occurs when the signed event advances the accepted shipment sequence. Stale events remain auditable but cannot regress the current state.
- Hub events without a corresponding buyer resolution request still update the shipment projection; no buyer request is fabricated.
- Existing HMAC verification, event deduplication, sequence locking and receipt/event persistence remain the source-of-truth controls.

C4 does not issue refunds, cancel MarketIQ seller orders, adjust seller settlement, or confirm physical return.

## 3. C5 repository audit — findings

MarketIQ already has:
- ADMIN-only refund listing, request, process and retry endpoints.
- Paystack refund execution outside database transactions.
- Refund statuses, idempotency keys, provider references and audit logs.
- Dispute review/resolution and seller settlement controls.
- A ledger with `BUYER_REFUND`, `REFUND_UNALLOCATED`, `SELLER_PAYABLE`, `LOGISTICS_PAYABLE`, `LOGISTICS_SUBSIDY`, `DELIVERY_UNALLOCATED`, `TAX_PAYABLE` and `PLATFORM_REVENUE` accounts.

Important gaps:
- Existing refunds are linked to Order and Payment, not directly to SellerOrder, ShipmentResolutionRequest or LogisticsShipment.
- Ordinary successful refunds are currently posted to `REFUND_UNALLOCATED`; the system cannot infer the seller, delivery-charge, Hub-cost, tax or platform allocation from a logistics outcome.
- Refunds and ledger amounts are stored as Decimal major-unit values and existing service logic uses JavaScript Number arithmetic. Integration quote/shipment values use integer minor-unit strings/BigInts. C5 must reconcile this boundary rather than introduce float-based allocation.
- Existing general refund APIs are not a substitute for a logistics-specific financial review workflow.
- A paid seller settlement already blocks the current refund request path unless finance records a recovery plan. C5 must not bypass that guard.

## 4. C5 implementation sequence

1. **C5-A — Read-only admin resolution review:** ADMIN-only queue/detail exposing buyer request, MarketIQ order/SellerOrder, signed Hub event timeline, packing review/evidence references, payments, refunds, seller settlements and ledger entries. Include explicit missing/contradictory-evidence flags. No mutation or Paystack call.
2. **C5-B — Audited financial decision:** Durable, idempotent decision linked to resolution request and SellerOrder; capture actor, rationale, evidence, outcome, approved amount/currency and allocation breakdown. No Paystack call.
3. **C5-C — Controlled refund execution and ledger allocation:** Implement only after financial allocation policy is explicitly approved. Preserve Paystack idempotency/provider uncertainty handling, atomic exposure reservation, balanced ledger posting and paid-settlement recovery controls.
4. **C5-D — Reconciliation and acceptance:** Test partial/full refunds, multiple payments, concurrent admins, provider timeouts/retries, settlement conflicts, Hub stop vs return-request vs actual physical-return evidence, and audit completeness.

### Business rules still requiring approval before C5-B/C5-C

Do not guess:
- Which operational facts make a refund eligible: confirmed stop, return requested, physical return confirmed, seller receipt confirmed, or a separately adjudicated dispute.
- Whether customer delivery charge is refundable at each custody point, separately from actual Hub logistics cost.
- Refund allocation for merchandise, tax, platform fee, delivery charge and partial remedies.
- Recovery process where seller settlement has already been paid.
- Treatment of Hub costs already incurred and any return/cancellation fees under the platform-funded billing agreement.
- Approval roles, maker-checker separation and amount thresholds.
- Whether all refunds must return to the original Paystack method and how provider NEEDS_ATTENTION cases are handled.

## 5. Operational gates remain unverified

Merged code and green CI do not prove production deployment or configured-Hub staging acceptance. Do not enable the embedded workers or claim the integration is live until the following are confirmed:
- Production migrations applied using the controlled Render deployment procedure.
- Outbound Hub credentials, billing-agreement version and inbound webhook secret configured correctly.
- Hub webhook callback registered and real signed delivery accepted.
- Quote → payment → shipment booking → four photos → buyer review → dispatch → partner assignment → tracking tested against configured Hub staging.
- Pre-custody stop and post-custody return-request flows exercised, including signed webhook delivery and replay/stale-event behavior.
- Buyer A/B access isolation verified.
- Worker settings remain opt-in and disabled by default until acceptance.

## 6. Separate workstream: physical reverse logistics

C2/C3/C4 do not implement reverse transport. A future operational slice must define who creates/accepts the reverse job, who pays, partner/rider assignment, reverse route, pickup, custody milestones, failed pickup, hub receipt and seller receipt confirmation. Only actual Hub custody evidence may set `physicalReturnConfirmed=true`.

---
**Stop point:** LI-02G-C4 is merged and CI-green. C5 contract/repository audit is documented on the current documentation branch. C5 runtime behavior has not started; financial allocation policy remains unapproved.
