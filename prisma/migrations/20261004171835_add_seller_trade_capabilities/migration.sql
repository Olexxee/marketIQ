-- CreateEnum
CREATE TYPE "SellerTradeCapability" AS ENUM ('RETAIL', 'WHOLESALE', 'IMPORTER', 'EXPORTER', 'MANUFACTURER', 'DISTRIBUTOR');

-- AlterTable
ALTER TABLE "SellerProfile" ADD COLUMN     "tradeCapabilities" "SellerTradeCapability"[];
