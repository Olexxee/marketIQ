DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Fulfillment"
    GROUP BY "sellerOrderId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Fulfillment repair migration blocked: duplicate fulfillment records exist for a seller order. Reconcile duplicates before retrying.';
  END IF;
END $$;

ALTER TABLE "Order"
  ADD COLUMN "completionDueAt" TIMESTAMP(3),
  ADD COLUMN "disputedAt" TIMESTAMP(3),
  ADD COLUMN "disputeNotes" TEXT;

CREATE UNIQUE INDEX "Fulfillment_sellerOrderId_key"
  ON "Fulfillment"("sellerOrderId");

INSERT INTO "BusinessConfig" ("id", "key", "value", "createdAt", "updatedAt")
VALUES (
  'fulfillment-auto-completion-days',
  'FULFILLMENT_AUTO_COMPLETION_DAYS',
  '7'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT ("key") DO NOTHING;

UPDATE "Order"
SET "completionDueAt" = COALESCE("updatedAt", NOW()) + INTERVAL '7 days'
WHERE "status" = 'DELIVERED'
  AND "completionDueAt" IS NULL
  AND "disputedAt" IS NULL;
