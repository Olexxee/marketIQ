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
