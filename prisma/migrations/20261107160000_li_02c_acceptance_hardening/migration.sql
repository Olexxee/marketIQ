-- LI-02C acceptance hardening.
-- Existing variant measurements are intentionally left without units/source.
-- They must be explicitly reviewed by sellers before they are quote-eligible.

CREATE TYPE "WeightUnit" AS ENUM ('KG', 'G');
CREATE TYPE "DimensionUnit" AS ENUM ('CM', 'MM');
CREATE TYPE "MeasurementSource" AS ENUM ('SELLER_DECLARED', 'PLATFORM_MEASURED', 'HUB_MEASURED');

ALTER TABLE "ProductVariant"
  ADD COLUMN "weightUnit" "WeightUnit",
  ADD COLUMN "dimensionUnit" "DimensionUnit",
  ADD COLUMN "measurementSource" "MeasurementSource";

ALTER TYPE "LedgerAccount" ADD VALUE 'LOGISTICS_PAYABLE';
ALTER TYPE "LedgerAccount" ADD VALUE 'LOGISTICS_SUBSIDY';
ALTER TYPE "LedgerAccount" ADD VALUE 'TAX_PAYABLE';
ALTER TYPE "LedgerAccount" ADD VALUE 'DELIVERY_UNALLOCATED';
