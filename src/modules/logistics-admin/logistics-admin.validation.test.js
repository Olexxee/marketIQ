import test from "node:test";
import assert from "node:assert/strict";
import {
  coordinateVerificationSchema,
  mappingCreateSchema,
  mappingVerificationSchema,
  serviceZoneMappingCreateSchema,
  packageCategoryMappingCreateSchema,
  warehouseMappingUpdateSchema,
  serviceZoneMappingUpdateSchema,
  packageCategoryMappingUpdateSchema,
} from "./logistics-admin.validation.js";

const providerId = "c123456789012345678901234";
const resourceId = "c123456789012345678901235";

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
  assert.throws(() => coordinateVerificationSchema.parse({ latitude: 91, longitude: 3.3, source: "admin" }));
  assert.throws(() => coordinateVerificationSchema.parse({ latitude: 6.6, longitude: 181, source: "admin" }));
  assert.throws(() => coordinateVerificationSchema.parse({ latitude: "", longitude: 3.3, source: "admin" }));
  assert.throws(() => coordinateVerificationSchema.parse({ latitude: null, longitude: 3.3, source: "admin" }));
  assert.throws(() => coordinateVerificationSchema.parse({
    latitude: 6.6, longitude: 3.3, source: "admin", coordinatesVerifiedAt: "2026-11-05",
  }));
});

test("pickup mapping creation requires provider, warehouse and both external references", () => {
  assert.throws(() => mappingCreateSchema.parse({
    providerId, warehouseId: resourceId, externalWarehouseReference: "warehouse-ref",
  }));
  assert.throws(() => mappingCreateSchema.parse({
    providerId, warehouseId: resourceId, externalWarehouseReference: "", externalServiceZoneId: "",
  }));
  assert.equal(mappingCreateSchema.parse({
    providerId, warehouseId: resourceId,
    externalWarehouseReference: "warehouse-ref", externalServiceZoneId: "zone-ref",
  }).externalServiceZoneId, "zone-ref");
});

test("mapping verification requires a meaningful audit note", () => {
  assert.throws(() => mappingVerificationSchema.parse({ notes: "ok" }));
  assert.equal(mappingVerificationSchema.parse({ notes: "Confirmed in provider console" }).notes, "Confirmed in provider console");
});

test("service-zone mapping requires an explicit LGA and provider zone reference", () => {
  assert.throws(() => serviceZoneMappingCreateSchema.parse({ providerId, lgaId: resourceId, externalServiceZoneId: "" }));
  assert.equal(serviceZoneMappingCreateSchema.parse({
    providerId, lgaId: resourceId, externalServiceZoneId: "zone-ref",
  }).externalServiceZoneId, "zone-ref");
});

test("package-category mapping requires a provider-compatible category reference", () => {
  assert.throws(() => packageCategoryMappingCreateSchema.parse({
    providerId, categoryId: resourceId, externalPackageCategory: "",
  }));
  assert.equal(packageCategoryMappingCreateSchema.parse({
    providerId, categoryId: resourceId, externalPackageCategory: "PARCEL",
  }).externalPackageCategory, "PARCEL");
});

test("mapping updates require valid provider references and reject empty payloads", () => {
  assert.throws(() => warehouseMappingUpdateSchema.parse({}));
  assert.equal(warehouseMappingUpdateSchema.parse({ externalServiceZoneId: "zone-ref" }).externalServiceZoneId, "zone-ref");
  assert.equal(serviceZoneMappingUpdateSchema.parse({ externalServiceZoneId: "zone-ref" }).externalServiceZoneId, "zone-ref");
  assert.equal(packageCategoryMappingUpdateSchema.parse({ externalPackageCategory: "PARCEL" }).externalPackageCategory, "PARCEL");
});
