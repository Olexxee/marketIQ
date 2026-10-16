-- Phase 2: dispute lifecycle, refund workflow, and immutable financial journal.
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "DisputeResolution" AS ENUM ('REFUND_FULL', 'REFUND_PARTIAL', 'RELEASE_PAYMENT', 'NO_ACTION');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REJECTED');
CREATE TYPE "LedgerTransactionType" AS ENUM ('PAYMENT_CAPTURE', 'REFUND', 'SELLER_SETTLEMENT', 'PLATFORM_FEE', 'ADJUSTMENT');
CREATE TYPE "LedgerAccount" AS ENUM ('PAYMENT_CLEARING', 'SELLER_PAYABLE', 'PLATFORM_REVENUE', 'BUYER_REFUND');
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "SettlementStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');

CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "openedById" TEXT,
  "assignedToId" TEXT,
  "resolvedById" TEXT,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT NOT NULL,
  "resolution" "DisputeResolution",
  "resolutionNotes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Dispute_orderId_createdAt_idx" ON "Dispute"("orderId", "createdAt");
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");
CREATE INDEX "Dispute_assignedToId_status_idx" ON "Dispute"("assignedToId", "status");
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "reason" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "idempotencyKey" TEXT NOT NULL,
  "providerReference" TEXT,
  "failureReason" TEXT,
  "providerPayload" JSONB,
  "reviewedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
CREATE UNIQUE INDEX "Refund_providerReference_key" ON "Refund"("providerReference");
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");
CREATE INDEX "Refund_paymentId_status_idx" ON "Refund"("paymentId", "status");
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SellerSettlement" (
  "id" TEXT NOT NULL,
  "sellerOrderId" TEXT NOT NULL,
  "requestedById" TEXT,
  "processedById" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "SettlementStatus" NOT NULL DEFAULT 'REQUESTED',
  "externalReference" TEXT,
  "failureReason" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerSettlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerSettlement_sellerOrderId_key" ON "SellerSettlement"("sellerOrderId");
CREATE UNIQUE INDEX "SellerSettlement_externalReference_key" ON "SellerSettlement"("externalReference");
CREATE INDEX "SellerSettlement_status_createdAt_idx" ON "SellerSettlement"("status", "createdAt");
CREATE INDEX "SellerSettlement_requestedById_createdAt_idx" ON "SellerSettlement"("requestedById", "createdAt");
ALTER TABLE "SellerSettlement" ADD CONSTRAINT "SellerSettlement_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerSettlement" ADD CONSTRAINT "SellerSettlement_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerSettlement" ADD CONSTRAINT "SellerSettlement_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LedgerTransaction" (
  "id" TEXT NOT NULL,
  "type" "LedgerTransactionType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "orderId" TEXT,
  "paymentId" TEXT,
  "refundId" TEXT,
  "settlementId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");
CREATE UNIQUE INDEX "LedgerTransaction_reference_key" ON "LedgerTransaction"("reference");
CREATE UNIQUE INDEX "LedgerTransaction_refundId_key" ON "LedgerTransaction"("refundId");
CREATE UNIQUE INDEX "LedgerTransaction_settlementId_key" ON "LedgerTransaction"("settlementId");
CREATE INDEX "LedgerTransaction_orderId_createdAt_idx" ON "LedgerTransaction"("orderId", "createdAt");
CREATE INDEX "LedgerTransaction_paymentId_createdAt_idx" ON "LedgerTransaction"("paymentId", "createdAt");
CREATE INDEX "LedgerTransaction_type_createdAt_idx" ON "LedgerTransaction"("type", "createdAt");
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "SellerSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LedgerEntry" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "sellerOrderId" TEXT,
  "account" "LedgerAccount" NOT NULL,
  "direction" "LedgerDirection" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");
CREATE INDEX "LedgerEntry_sellerOrderId_account_createdAt_idx" ON "LedgerEntry"("sellerOrderId", "account", "createdAt");
CREATE INDEX "LedgerEntry_account_createdAt_idx" ON "LedgerEntry"("account", "createdAt");
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill immutable payment-capture journal entries for existing successful payments.
INSERT INTO "LedgerTransaction" (
  "id", "type", "idempotencyKey", "reference", "orderId", "paymentId", "amount", "currency", "metadata", "createdAt"
)
SELECT
  'legacy-payment-capture-' || p."id",
  'PAYMENT_CAPTURE'::"LedgerTransactionType",
  'payment-capture:' || p."id",
  'PAYCAP-' || p."reference",
  p."orderId", p."id", p."amount", p."currency",
  jsonb_build_object('source', 'migration-backfill'), p."createdAt"
FROM "Payment" p
WHERE p."status" = 'SUCCESS' AND p."orderId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "LedgerEntry" ("id", "transactionId", "account", "direction", "amount", "currency", "createdAt")
SELECT 'legacy-ledger-debit-' || lt."id", lt."id", 'PAYMENT_CLEARING'::"LedgerAccount", 'DEBIT'::"LedgerDirection", lt."amount", lt."currency", lt."createdAt"
FROM "LedgerTransaction" lt
WHERE lt."type" = 'PAYMENT_CAPTURE' AND lt."metadata"->>'source' = 'migration-backfill'
ON CONFLICT DO NOTHING;

INSERT INTO "LedgerEntry" ("id", "transactionId", "account", "direction", "amount", "currency", "createdAt")
SELECT 'legacy-ledger-credit-' || lt."id", lt."id", 'SELLER_PAYABLE'::"LedgerAccount", 'CREDIT'::"LedgerDirection", lt."amount", lt."currency", lt."createdAt"
FROM "LedgerTransaction" lt
WHERE lt."type" = 'PAYMENT_CAPTURE' AND lt."metadata"->>'source' = 'migration-backfill'
ON CONFLICT DO NOTHING;
