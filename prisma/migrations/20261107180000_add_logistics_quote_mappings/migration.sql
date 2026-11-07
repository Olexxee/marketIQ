ALTER TABLE "LogisticsWarehouseMapping"
ADD COLUMN "externalServiceZoneId" TEXT;

CREATE TABLE "LogisticsServiceZoneMapping" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "lgaId" TEXT NOT NULL,
    "externalServiceZoneId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogisticsServiceZoneMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogisticsPackageCategoryMapping" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "externalPackageCategory" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogisticsPackageCategoryMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LogisticsServiceZoneMapping_providerId_lgaId_key"
ON "LogisticsServiceZoneMapping"("providerId", "lgaId");
CREATE UNIQUE INDEX "LogisticsServiceZoneMapping_providerId_externalServiceZoneId_key"
ON "LogisticsServiceZoneMapping"("providerId", "externalServiceZoneId");
CREATE INDEX "LogisticsServiceZoneMapping_lgaId_isActive_idx"
ON "LogisticsServiceZoneMapping"("lgaId", "isActive");

CREATE UNIQUE INDEX "LogisticsPackageCategoryMapping_providerId_categoryId_key"
ON "LogisticsPackageCategoryMapping"("providerId", "categoryId");
CREATE UNIQUE INDEX "LogisticsPackageCategoryMapping_providerId_externalPackageCategory_key"
ON "LogisticsPackageCategoryMapping"("providerId", "externalPackageCategory");
CREATE INDEX "LogisticsPackageCategoryMapping_categoryId_isActive_idx"
ON "LogisticsPackageCategoryMapping"("categoryId", "isActive");

ALTER TABLE "LogisticsServiceZoneMapping"
ADD CONSTRAINT "LogisticsServiceZoneMapping_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "LogisticsProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsServiceZoneMapping"
ADD CONSTRAINT "LogisticsServiceZoneMapping_lgaId_fkey"
FOREIGN KEY ("lgaId") REFERENCES "Lga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LogisticsPackageCategoryMapping"
ADD CONSTRAINT "LogisticsPackageCategoryMapping_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "LogisticsProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogisticsPackageCategoryMapping"
ADD CONSTRAINT "LogisticsPackageCategoryMapping_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
