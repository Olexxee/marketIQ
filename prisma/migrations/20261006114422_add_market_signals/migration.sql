-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketSignalType" AS ENUM ('PRODUCT_DEMAND', 'CATEGORY_DEMAND', 'GEOGRAPHIC_DEMAND', 'SUPPLY_DEMAND_OPPORTUNITY');

-- CreateEnum
CREATE TYPE "MarketSignalEntityType" AS ENUM ('PRODUCT', 'CATEGORY', 'LOCATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MarketActivityType" ADD VALUE 'PAYMENT_FAILED';
ALTER TYPE "MarketActivityType" ADD VALUE 'FULFILLMENT_CREATED';
ALTER TYPE "MarketActivityType" ADD VALUE 'FULFILLMENT_SHIPPED';
ALTER TYPE "MarketActivityType" ADD VALUE 'FULFILLMENT_DELIVERED';
ALTER TYPE "MarketActivityType" ADD VALUE 'INVENTORY_STOCKED_IN';
ALTER TYPE "MarketActivityType" ADD VALUE 'INVENTORY_ADJUSTED';
ALTER TYPE "MarketActivityType" ADD VALUE 'INVENTORY_RESERVED';
ALTER TYPE "MarketActivityType" ADD VALUE 'INVENTORY_RELEASED';
ALTER TYPE "MarketActivityType" ADD VALUE 'INVENTORY_COMMITTED';

-- CreateTable
CREATE TABLE "MarketSignal" (
    "id" TEXT NOT NULL,
    "signalType" "MarketSignalType" NOT NULL,
    "entityType" "MarketSignalEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "countryId" TEXT,
    "stateId" TEXT,
    "lgaId" TEXT,
    "cityId" TEXT,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "score" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketSignal_entityId_idx" ON "MarketSignal"("entityId");

-- CreateIndex
CREATE INDEX "MarketSignal_windowStart_windowEnd_idx" ON "MarketSignal"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "MarketSignal_countryId_signalType_idx" ON "MarketSignal"("countryId", "signalType");

-- CreateIndex
CREATE INDEX "MarketSignal_stateId_signalType_idx" ON "MarketSignal"("stateId", "signalType");

-- CreateIndex
CREATE INDEX "MarketSignal_lgaId_signalType_idx" ON "MarketSignal"("lgaId", "signalType");

-- CreateIndex
CREATE INDEX "MarketSignal_cityId_signalType_idx" ON "MarketSignal"("cityId", "signalType");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSignal_signalType_entityType_entityId_windowStart_win_key" ON "MarketSignal"("signalType", "entityType", "entityId", "windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_eventType_createdAt_idx" ON "OutboxEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- AddForeignKey
ALTER TABLE "MarketSignal" ADD CONSTRAINT "MarketSignal_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSignal" ADD CONSTRAINT "MarketSignal_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSignal" ADD CONSTRAINT "MarketSignal_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "Lga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSignal" ADD CONSTRAINT "MarketSignal_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
