import test from "node:test";
import assert from "node:assert/strict";
import {
  coordinateVerificationSchema,
  mappingCreateSchema,
  mappingVerificationSchema,
} from "./logistics-admin.validation.js";

test("coordinate verification accepts valid Nigeria coordinate input", () => {
  const parsed = coordinateVerificationSchema.parse({
    latitude: "6.6018",
    longitude: "3.3515",
    source: "admin_reviewed_map_pin",
  });
  assert.equal(parsed.latitude, 6.6018);
  assert.equal(parsed.longitude, 3.3515);
  assert.equal(parsed.source, "admin_reviewed_map_pin");
});

test("coordinate verification rejects out-of-range values and unknown fields", () => {
  assert.throws(() => coordinateVerificationSchema.parse({
    latitude: 91,
    longitude: 3.3,
    source: "admin",
  }));
  assert.throws(() => coordinateVerificationSchema.parse({
    latitude: 6.6,
    longitude: 181,
    source: "admin",
  }));
  assert.throws(() => coordinateVerificationSchema.parse({ latitude: "", longitude: 3.3, source: "admin" }));
  assert.throws(() => coordinateVerificationSchema.parse({ latitude: null, longitude: 3.3, source: "admin" }));
  assert.throws(() => coordinateVerificationSchema.parse({
    latitude: 6.6,
    longitude: 3.3,
    source: "admin",
    coordinatesVerifiedAt: "2026-11-05",
  }));
});

test("mapping creation requires provider, warehouse and an external reference", () => {
  assert.throws(() => mappingCreateSchema.parse({
    providerId: "provider",
    warehouseId: "warehouse",
    externalWarehouseReference: "",
    externalServiceZoneId: "",
  }));
});

test("mapping verification requires a meaningful audit note", () => {
  assert.throws(() => mappingVerificationSchema.parse({ notes: "ok" }));
  assert.equal(mappingVerificationSchema.parse({ notes: "Confirmed in provider console" }).notes, "Confirmed in provider console");
});

import {
  serviceZoneMappingCreateSchema,
  packageCategoryMappingCreateSchema,
} from "./logistics-admin.validation.js";

test("service-zone mapping requires an explicit LGA and provider zone reference", () => {
  assert.throws(() => serviceZoneMappingCreateSchema.parse({
    providerId: "c123456789012345678901234", lgaId: "c123456789012345678901235", externalServiceZoneId: "",
  }));
});

test("package-category mapping requires a provider-compatible category reference", () => {
  assert.throws(() => packageCategoryMappingCreateSchema.parse({
    providerId: "c123456789012345678901234", categoryId: "c123456789012345678901235", externalPackageCategory: "",
  }));
  assert.equal(packageCategoryMappingCreateSchema.parse({
    providerId: "c123456789012345678901234", categoryId: "c123456789012345678901235", externalPackageCategory: "PARCEL",
  }).externalPackageCategory, "PARCEL");
});
