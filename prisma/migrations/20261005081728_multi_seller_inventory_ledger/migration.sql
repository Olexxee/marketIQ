/*
  Warnings:

  - You are about to drop the column `quantity` on the `InventoryMovement` table. All the data in the column will be lost.
  - You are about to drop the `ReviewImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VariantMedia` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `InventoryMovement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sellerId,slug]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sellerId,sku]` on the table `ProductVariant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `quantityAfter` to the `InventoryMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantityDelta` to the `InventoryMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reservedAfter` to the `InventoryMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reservedDelta` to the `InventoryMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sellerId` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'RESERVE';
ALTER TYPE "InventoryMovementType" ADD VALUE 'RELEASE';

-- DropForeignKey
ALTER TABLE "ReviewImage" DROP CONSTRAINT "ReviewImage_reviewId_fkey";

-- DropForeignKey
ALTER TABLE "VariantMedia" DROP CONSTRAINT "VariantMedia_variantId_fkey";

-- DropIndex
DROP INDEX "Product_slug_key";

-- DropIndex
DROP INDEX "ProductVariant_sku_key";

-- AlterTable
ALTER TABLE "Inventory" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryMovement" DROP COLUMN "quantity",
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "quantityAfter" INTEGER NOT NULL,
ADD COLUMN     "quantityDelta" INTEGER NOT NULL,
ADD COLUMN     "reservedAfter" INTEGER NOT NULL,
ADD COLUMN     "reservedDelta" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "inventoryId" TEXT,
ADD COLUMN     "reservedLocationId" TEXT;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "sellerId" TEXT NOT NULL;

-- DropTable
DROP TABLE "ReviewImage";

-- DropTable
DROP TABLE "VariantMedia";

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "publicId" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "variantId" TEXT,
    "categoryId" TEXT,
    "brandId" TEXT,
    "collectionId" TEXT,
    "reviewId" TEXT,
    "sellerId" TEXT,
    "sourcingRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Media_productId_idx" ON "Media"("productId");

-- CreateIndex
CREATE INDEX "Media_variantId_idx" ON "Media"("variantId");

-- CreateIndex
CREATE INDEX "Media_categoryId_idx" ON "Media"("categoryId");

-- CreateIndex
CREATE INDEX "Media_brandId_idx" ON "Media"("brandId");

-- CreateIndex
CREATE INDEX "Media_collectionId_idx" ON "Media"("collectionId");

-- CreateIndex
CREATE INDEX "Media_reviewId_idx" ON "Media"("reviewId");

-- CreateIndex
CREATE INDEX "Media_sellerId_idx" ON "Media"("sellerId");

-- CreateIndex
CREATE INDEX "Media_sourcingRequestId_idx" ON "Media"("sourcingRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "OrderItem_inventoryId_idx" ON "OrderItem"("inventoryId");

-- CreateIndex
CREATE INDEX "OrderItem_reservedLocationId_idx" ON "OrderItem"("reservedLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sellerId_slug_key" ON "Product"("sellerId", "slug");

-- CreateIndex
CREATE INDEX "ProductVariant_sellerId_idx" ON "ProductVariant"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sellerId_sku_key" ON "ProductVariant"("sellerId", "sku");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_sourcingRequestId_fkey" FOREIGN KEY ("sourcingRequestId") REFERENCES "SourcingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_reservedLocationId_fkey" FOREIGN KEY ("reservedLocationId") REFERENCES "BusinessLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
