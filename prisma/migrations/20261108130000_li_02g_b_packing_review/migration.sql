CREATE TYPE "ShipmentReviewStatus" AS ENUM (
  'WAITING_FOR_EVIDENCE',
  'PENDING_BUYER_REVIEW',
  'APPROVED',
  'AUTO_AUTHORIZED',
  'EVIDENCE_OVERDUE',
  'CANCELLATION_REQUESTED',
  'CANCELLATION_CONFIRMED',
  'RETURN_REQUESTED',
  'CLOSED'
);

CREATE TABLE "ShipmentReview" (
  "id" TEXT NOT NULL,
  "sellerOrderId" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "status" "ShipmentReviewStatus" NOT NULL DEFAULT 'WAITING_FOR_EVIDENCE',
  "policyVersion" TEXT NOT NULL DEFAULT 'LI-02G-B-v1',
  "evidenceDeadlineAt" TIMESTAMP(3) NOT NULL,
  "evidenceCompletedAt" TIMESTAMP(3),
  "reviewStartedAt" TIMESTAMP(3),
  "reviewExpiresAt" TIMESTAMP(3),
  "buyerApprovedAt" TIMESTAMP(3),
  "dispatchAuthorizedAt" TIMESTAMP(3),
  "cancellationRequestedAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "returnRequestedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentReview_sellerOrderId_key" ON "ShipmentReview"("sellerOrderId");
CREATE UNIQUE INDEX "ShipmentReview_shipmentId_key" ON "ShipmentReview"("shipmentId");
CREATE INDEX "ShipmentReview_status_evidenceDeadlineAt_idx" ON "ShipmentReview"("status", "evidenceDeadlineAt");
CREATE INDEX "ShipmentReview_status_reviewExpiresAt_idx" ON "ShipmentReview"("status", "reviewExpiresAt");
CREATE INDEX "ShipmentReview_buyerId_createdAt_idx" ON "ShipmentReview"("buyerId", "createdAt");

ALTER TABLE "ShipmentReview"
  ADD CONSTRAINT "ShipmentReview_sellerOrderId_fkey"
  FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentReview"
  ADD CONSTRAINT "ShipmentReview_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "LogisticsShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentReview"
  ADD CONSTRAINT "ShipmentReview_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
