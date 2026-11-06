ALTER TABLE "Address"
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7),
  ADD COLUMN "coordinatesVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "coordinatesSource" TEXT;

ALTER TABLE "Warehouse"
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7),
  ADD COLUMN "coordinatesVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "coordinatesSource" TEXT;

ALTER TABLE "Address"
  ADD CONSTRAINT "Address_coordinates_pair_check"
    CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)),
  ADD CONSTRAINT "Address_coordinates_range_check"
    CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)),
  ADD CONSTRAINT "Address_coordinates_verification_check"
    CHECK ("coordinatesVerifiedAt" IS NULL OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "coordinatesSource" IS NOT NULL));

ALTER TABLE "Warehouse"
  ADD CONSTRAINT "Warehouse_coordinates_pair_check"
    CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL)),
  ADD CONSTRAINT "Warehouse_coordinates_range_check"
    CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)),
  ADD CONSTRAINT "Warehouse_coordinates_verification_check"
    CHECK ("coordinatesVerifiedAt" IS NULL OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "coordinatesSource" IS NOT NULL));
