# MarketIQ Transaction Protection Runbook

## Deployment order

1. Back up the PostgreSQL database.
2. Run `npx prisma validate` and `npx prisma generate`.
3. Review existing fulfilments before migration. The fulfilment migration intentionally stops if a seller order has duplicate fulfilment records; reconcile those records before retrying.
4. Apply migrations with `npx prisma migrate deploy`.
5. Deploy the API service.
6. Deploy a separate long-running worker service using `npm run worker`. The worker must use the same `DATABASE_URL` and required event-listener environment variables as the API.
7. Verify health, payment webhook delivery, worker logs, and the smoke tests below before routing production traffic.

## Policy configuration

- `FULFILLMENT_AUTO_COMPLETION_DAYS`: integer 1–90, default 7. Set this on the API process that records delivery deadlines, or set the `BusinessConfig` key `FULFILLMENT_AUTO_COMPLETION_DAYS` to a JSON number. Setting this variable only on the worker does not change deadlines already stored in the database.
- `ORDER_PAYMENT_EXPIRY_MINUTES`: integer 5–120, default 30. Set on the API process. Existing pending/failed orders are backfilled to expire 30 minutes after their creation time.

## Buyer and fulfilment smoke tests

- Create an unpaid order and verify `paymentExpiresAt` is populated.
- Let an unpaid order expire and verify the worker marks its payment attempts abandoned, cancels seller orders, releases inventory reservations, and emits an order-cancelled event.
- Report delivery for a seller order and verify the parent order gets a completion deadline only when its derived state is delivered.
- Confirm receipt as the buyer and verify only delivered seller orders become completed.
- Create a multi-seller order with one cancelled seller order and the remaining seller orders delivered; verify buyer confirmation and automatic completion can resolve the order.
- Open a dispute as the buyer and verify automatic completion stops. Verify sellers cannot create or complete a dispute on behalf of a buyer.
- Verify the database unique index rejects a second fulfilment for the same seller order.

## Payment, refund, and settlement smoke tests

- Send duplicate signed Paystack success webhooks and verify only one inventory sale and one payment-capture ledger transaction are recorded.
- Send a failed payment webhook and verify a later valid success event can still be reconciled.
- Trigger two successful payment references for one order; verify only the first claims the order and the duplicate charge creates a refund request and reconciliation audit entry.
- Request a refund with an idempotency key, attempt to exceed the remaining refundable balance, and verify the second request is rejected.
- Process a refund in Paystack test mode; verify only a processed refund creates the refund ledger transaction and a dispute resolution closes only after refund success.
- Verify seller settlement cannot be requested before order completion, while disputed, or while refund exposure exists.
- Approve a settlement, record the external bank-transfer reference only after funds are sent, and verify the settlement ledger transaction and audit record are created atomically.

## Admin API

Base path: `/api/admin/operations`. Dispute review supports ADMIN and STAFF; dispute resolution, refunds, and settlements require ADMIN.

- `GET /disputes?status=OPEN&page=1&limit=20`
- `GET /disputes/:id`
- `POST /disputes/:id/review`
- `POST /disputes/:id/resolve` with `{ "resolution": "NO_ACTION", "resolutionNotes": "..." }`, or refund outcomes `REFUND_FULL` / `REFUND_PARTIAL` (partial requires `refundAmount`).
- `GET /refunds?status=REQUESTED&page=1&limit=20`
- `POST /orders/:orderId/refunds` with `{ "amount": 1000, "reason": "...", "idempotencyKey": "unique-key-123" }`. Omit amount to request the remaining refundable balance.
- `POST /refunds/:id/process` submits the refund to Paystack. If the provider response times out, the record stays PROCESSING with a reconciliation note; do not retry until the provider's state is checked.
- `POST /refunds/:id/retry` accepts `{ "currency": "NGN", "accountNumber": "1234567890", "bankId": "..." }` for a Paystack refund in NEEDS_ATTENTION. Bank details are sent to Paystack and are not persisted by MarketIQ.
- `GET /settlements?status=REQUESTED&page=1&limit=20`
- `POST /seller-orders/:sellerOrderId/settlements` (after refunds or an amount adjustment, provide `{ "amount": 5000, "adjustmentReason": "documented reconciliation" }`)
- `POST /settlements/:id/approve`
- `POST /settlements/:id/mark-paid` with `{ "externalReference": "bank-transfer-reference" }`. This endpoint records a manually executed payout; it does not initiate a bank transfer.

## Verification status

CI is configured to run Prisma validation, client generation, and unit tests; the current run has not been verified from this environment. A real PostgreSQL migration and Paystack test-mode smoke test are still required before production rollout.
