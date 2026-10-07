/*
  Warnings:

  - A unique constraint covering the columns `[signalType,entityType,entityId,scopeKey,windowStart,windowEnd]` on the table `MarketSignal` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MarketIntelligenceType" AS ENUM ('TREND', 'OPPORTUNITY', 'RISK', 'DEMAND_SPIKE', 'SUPPLY_GAP', 'GEOGRAPHIC_SHIFT', 'CATEGORY_GROWTH', 'MARKET_STRENGTH');

-- CreateEnum
CREATE TYPE "MarketIntelligenceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MarketIntelligenceEntityType" AS ENUM ('PRODUCT', 'CATEGORY', 'LOCATION');

-- DropIndex
DROP INDEX "MarketSignal_entityId_idx";

-- DropIndex
DROP INDEX "MarketSignal_signalType_entityType_entityId_windowStart_win_key";

-- AlterTable
ALTER TABLE "MarketSignal" ADD COLUMN     "scopeKey" TEXT NOT NULL DEFAULT 'GLOBAL';

-- CreateTable
CREATE TABLE "MarketIntelligence" (
    "id" TEXT NOT NULL,
    "intelligenceType" "MarketIntelligenceType" NOT NULL,
    "entityType" "MarketIntelligenceEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "severity" "MarketIntelligenceSeverity" NOT NULL,
    "confidence" DECIMAL(65,30),
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "evidence" JSONB,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketIntelligence_intelligenceType_entityType_entityId_idx" ON "MarketIntelligence"("intelligenceType", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "MarketIntelligence_severity_createdAt_idx" ON "MarketIntelligence"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "MarketIntelligence_windowStart_windowEnd_idx" ON "MarketIntelligence"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "MarketIntelligence_entityId_idx" ON "MarketIntelligence"("entityId");

-- CreateIndex
CREATE INDEX "MarketSignal_entityId_scopeKey_idx" ON "MarketSignal"("entityId", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "MarketSignal_signalType_entityType_entityId_scopeKey_window_key" ON "MarketSignal"("signalType", "entityType", "entityId", "scopeKey", "windowStart", "windowEnd");
