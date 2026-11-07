-- LI-02B: provider-scoped identities, selectable quote options, event cursor
-- and webhook signature audit metadata. Existing rows are preserved.

CREATE TYPE "FulfillmentOwnerMode" AS ENUM ('SELLER_MANAGED', 'LOGISTICS_PROVIDER_MANAGED');

ALTER TABLE "Fulfillment"
  ADD COLUMN "ownerMode" "FulfillmentOwnerMode" NOT NULL DEFAULT 'SELLER_MANAGED';

-- Quote snapshots can exist before the buyer selects an option.
ALTER TABLE "LogisticsQuote"
  ALTER COLUMN "customerDeliveryChargeMinor" DROP NOT NULL,
  ALTER COLUMN "agreedLogisticsCostMinor" DROP NOT NULL,
  ADD COLUMN "externalFulfillmentReference" TEXT,
  ADD COLUMN "selectedOptionId" TEXT;

-- Replace global idempotency/reference uniqueness with provider-scoped uniqueness.
DROP INDEX IF EXISTS "LogisticsQuote_idempotencyKey_key";
CREATE UNIQUE INDEX "LogisticsQuote_providerId_idempotencyKey_key"
  ON "LogisticsQuote"("providerId", "idempotencyKey");
CREATE UNIQUE INDEX "LogisticsQuote_providerId_providerQuoteReference_key"
  ON "LogisticsQuote"("providerId", "providerQuoteReference");
CREATE UNIQUE INDEX "LogisticsQuote_providerId_externalFulfillmentReference_key"
  ON "LogisticsQuote"("providerId", "externalFulfillmentReference");

CREATE TABLE "LogisticsQuoteOption" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "providerOptionReference" TEXT NOT NULL,
  "customerDeliveryChargeMinor" BIGINT NOT NULL,
  "agreedLogisticsCostMinor" BIGINT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "serviceLevel" TEXT,
  "expiresAt" TIMESTAMP(3),
  "optionSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LogisticsQuoteOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LogisticsQuoteOption_quoteId_providerOptionReference_key"
  ON "LogisticsQuoteOption"("quoteId", "providerOptionReference");
CREATE INDEX "LogisticsQuoteOption_quoteId_expiresAt_idx"
  ON "LogisticsQuoteOption"("quoteId", "expiresAt");

ALTER TABLE "LogisticsQuoteOption"
  ADD CONSTRAINT "LogisticsQuoteOption_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "LogisticsQuote"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LogisticsQuote"
  ADD CONSTRAINT "LogisticsQuote_selectedOptionId_fkey"
  FOREIGN KEY ("selectedOptionId") REFERENCES "LogisticsQuoteOption"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Shipment idempotency/reference scope follows the provider boundary.
DROP INDEX IF EXISTS "LogisticsShipment_externalReference_key";
DROP INDEX IF EXISTS "LogisticsShipment_externalBookingReference_key";
DROP INDEX IF EXISTS "LogisticsShipment_idempotencyKey_key";
CREATE UNIQUE INDEX "LogisticsShipment_providerId_externalReference_key"
  ON "LogisticsShipment"("providerId", "externalReference");
CREATE UNIQUE INDEX "LogisticsShipment_providerId_externalBookingReference_key"
  ON "LogisticsShipment"("providerId", "externalBookingReference");
CREATE UNIQUE INDEX "LogisticsShipment_providerId_idempotencyKey_key"
  ON "LogisticsShipment"("providerId", "idempotencyKey");

-- Enforce a single provider sequence per shipment. Null shipment/sequence rows
-- remain legal for legacy/unmatched events; PostgreSQL permits multiple NULLs.
CREATE UNIQUE INDEX "LogisticsEvent_shipmentId_sequence_key"
  ON "LogisticsEvent"("shipmentId", "sequence");

ALTER TABLE "LogisticsEvent"
  ADD CONSTRAINT "LogisticsEvent_sequence_positive_check"
  CHECK ("sequence" IS NULL OR "sequence" > 0);

-- Persist the verified raw-body digest and HMAC metadata, not raw PII-bearing
-- request bytes. Verification must occur against the raw bytes before insert.
ALTER TABLE "LogisticsWebhookReceipt"
  ADD COLUMN "rawBodySha256" TEXT,
  ADD COLUMN "signatureTimestamp" BIGINT,
  ADD COLUMN "signatureVersion" TEXT;
