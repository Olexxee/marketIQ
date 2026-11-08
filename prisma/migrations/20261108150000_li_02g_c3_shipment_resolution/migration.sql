CREATE TYPE "ShipmentResolutionStatus" AS ENUM (
  'COMMAND_PENDING',
  'COMMAND_PROCESSING',
  'STOP_CONFIRMED',
  'RETURN_REQUESTED',
  'REJECTED',
  'FAILED'
);

CREATE TABLE "ShipmentResolutionRequest" (
  "id" TEXT NOT NULL,
  "sellerOrderId" TEXT NOT NULL,
  "shipmentId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "status" "ShipmentResolutionStatus" NOT NULL DEFAULT 'COMMAND_PENDING',
  "reason" TEXT NOT NULL,
  "hubResponse" JSONB,
  "physicalReturnConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "commandAcceptedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentResolutionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShipmentResolutionRequest_sellerOrderId_key" ON "ShipmentResolutionRequest"("sellerOrderId");
CREATE UNIQUE INDEX "ShipmentResolutionRequest_shipmentId_key" ON "ShipmentResolutionRequest"("shipmentId");
CREATE INDEX "ShipmentResolutionRequest_status_createdAt_idx" ON "ShipmentResolutionRequest"("status", "createdAt");
CREATE INDEX "ShipmentResolutionRequest_buyerId_createdAt_idx" ON "ShipmentResolutionRequest"("buyerId", "createdAt");

ALTER TABLE "ShipmentResolutionRequest"
  ADD CONSTRAINT "ShipmentResolutionRequest_sellerOrderId_fkey"
  FOREIGN KEY ("sellerOrderId") REFERENCES "SellerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentResolutionRequest"
  ADD CONSTRAINT "ShipmentResolutionRequest_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "LogisticsShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentResolutionRequest"
  ADD CONSTRAINT "ShipmentResolutionRequest_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
