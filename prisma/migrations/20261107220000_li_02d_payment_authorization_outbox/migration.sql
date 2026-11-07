-- LI-02D: database-enforced idempotency for durable cross-system outbox events.
-- Existing generic events remain valid with a NULL dedupe key.
ALTER TABLE "OutboxEvent"
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key"
  ON "OutboxEvent"("dedupeKey");
