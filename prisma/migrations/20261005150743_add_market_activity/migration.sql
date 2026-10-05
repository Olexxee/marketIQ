-- CreateEnum
CREATE TYPE "MarketActivityType" AS ENUM ('PRODUCT_VIEW', 'PRODUCT_SEARCH', 'CATEGORY_VIEW', 'SELLER_VIEW', 'PRODUCT_FAVORITED', 'PRODUCT_UNFAVORITED', 'PRODUCT_ADDED_TO_CART', 'PRODUCT_REMOVED_FROM_CART', 'SOURCING_REQUEST_CREATED', 'SOURCING_RESPONSE_SUBMITTED', 'ORDER_CREATED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'PAYMENT_COMPLETED');

-- CreateTable
CREATE TABLE "MarketActivity" (
    "id" TEXT NOT NULL,
    "activityType" "MarketActivityType" NOT NULL,
    "userId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "sellerId" TEXT,
    "categoryId" TEXT,
    "brandId" TEXT,
    "collectionId" TEXT,
    "countryId" TEXT,
    "stateId" TEXT,
    "lgaId" TEXT,
    "cityId" TEXT,
    "quantity" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketActivity_activityType_createdAt_idx" ON "MarketActivity"("activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_userId_createdAt_idx" ON "MarketActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_productId_activityType_createdAt_idx" ON "MarketActivity"("productId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_variantId_activityType_createdAt_idx" ON "MarketActivity"("variantId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_sellerId_activityType_createdAt_idx" ON "MarketActivity"("sellerId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_categoryId_activityType_createdAt_idx" ON "MarketActivity"("categoryId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_countryId_activityType_createdAt_idx" ON "MarketActivity"("countryId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_stateId_activityType_createdAt_idx" ON "MarketActivity"("stateId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_lgaId_activityType_createdAt_idx" ON "MarketActivity"("lgaId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_cityId_activityType_createdAt_idx" ON "MarketActivity"("cityId", "activityType", "createdAt");

-- CreateIndex
CREATE INDEX "MarketActivity_createdAt_idx" ON "MarketActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_lgaId_fkey" FOREIGN KEY ("lgaId") REFERENCES "Lga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketActivity" ADD CONSTRAINT "MarketActivity_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
