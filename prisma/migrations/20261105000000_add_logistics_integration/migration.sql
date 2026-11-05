-- CreateEnum
CREATE TYPE "LogisticsQuoteStatus" AS ENUM ('QUOTED', 'ACCEPTED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LogisticsShipmentStatus" AS ENUM ('PENDING', 'BOOKING', 'BOOKED', 'RETRY_PENDING', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogisticsWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "LogisticsProvider" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogisticsProvider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsQuote" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sellerOrderId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "providerQuoteReference" TEXT,
    "status" "LogisticsQuoteStatus" NOT NULL DEFAULT 'QUOTED',
    "customerDeliveryChargeMinor" BIGINT NOT NULL,
    "agreedLogisticsCostMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "requestSnapshot" JSONB NOT NULL,
    "responseSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogisticsQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsShipment" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sellerOrderId" TEXT NOT NULL,
    "fulfillmentId" TEXT,
    "externalReference" TEXT NOT NULL,
    "externalBookingReference" TEXT,
    "trackingReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "LogisticsShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "customerDeliveryChargeMinor" BIGINT NOT NULL,
    "agreedLogisticsCostMinor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "billingAgreementReference" TEXT,
    "requestSnapshot" JSONB NOT NULL,
    "responseSnapshot" JSONB,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "bookedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogisticsShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsEvent" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sequence" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogisticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsWebhookReceipt" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" "LogisticsWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    CONSTRAINT "LogisticsWebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsProvider_code_key" ON "LogisticsProvider"("code");
CREATE UNIQUE INDEX "LogisticsQuote_sellerOrderId_key" ON "LogisticsQuote"("sellerOrderId");
CREATE UNIQUE INDEX "LogisticsQuote_idempotencyKey_key" ON "LogisticsQuote"("idempotencyKey");
CREATE INDEX "LogisticsQuote_cartId_sellerId_status_idx" ON "LogisticsQuote"("cartId", "sellerId", "status");
CREATE INDEX "LogisticsQuote_providerId_expiresAt_idx" ON "LogisticsQuote"("providerId", "expiresAt");
CREATE UNIQUE INDEX "LogisticsShipment_sellerOrderId_key" ON "LogisticsShipment"("sellerOrderId");
CREATE UNIQUE INDEX "LogisticsShipment_fulfillmentId_key" ON "LogisticsShipment"("fulfillmentId");
CREATE UNIQUE INDEX "LogisticsShipment_externalReference_key" ON "LogisticsShipment"("externalReference");
CREATE UNIQUE INDEX "LogisticsShipment_externalBookingReference_key" ON "LogisticsShipment"("externalBookingReference");
CREATE UNIQUE INDEX "LogisticsShipment_idempotencyKey_key" ON "LogisticsShipment"("idempotencyKey");
CREATE INDEX "LogisticsShipment_providerId_status_updatedAt_idx" ON "LogisticsShipment"("providerId", "status", "updatedAt");
CREATE INDEX "LogisticsShipment_trackingReference_idx" ON "LogisticsShipment"("trackingReference");
CREATE UNIQUE INDEX "LogisticsEvent_providerId_externalEventId_key" ON "LogisticsEvent"("providerId", "externalEventId");
CREATE INDEX "LogisticsEvent_shipmentId_occurredAt_idx" ON "LogisticsEvent"("shipmentId", "occurredAt");
CREATE UNIQUE INDEX "LogisticsWebhookReceipt_providerId_externalEventId_key" ON "LogisticsWebhookReceipt"("providerId", "externalEventId");
CREATE INDEX "LogisticsWebhookReceipt_status_receivedAt_idx" ON "LogisticsWebhookReceipt"("status", "receivedAt");

-- AddForeignKey
ALTER TABLE "LogisticsQuote" ADD CONSTRAINT "LogisticsQuote_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LogisticsProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsQuote" ADD CONSTRAINT "LogisticsQuote_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsQuote" ADD CONSTRAINT "LogisticsQuote_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsQuote" ADD CONSTRAINT "LogisticsQuote_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogisticsShipment" ADD CONSTRAINT "LogisticsShipment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LogisticsProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsShipment" ADD CONSTRAINT "LogisticsShipment_sellerOrderId_fkey" FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogisticsShipment" ADD CONSTRAINT "LogisticsShipment_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "Fulfillment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogisticsEvent" ADD CONSTRAINT "LogisticsEvent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LogisticsProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsEvent" ADD CONSTRAINT "LogisticsEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "LogisticsShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogisticsWebhookReceipt" ADD CONSTRAINT "LogisticsWebhookReceipt_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "LogisticsProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
