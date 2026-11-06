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
  }));
});

test("mapping verification requires a meaningful audit note", () => {
  assert.throws(() => mappingVerificationSchema.parse({ notes: "ok" }));
  assert.equal(mappingVerificationSchema.parse({ notes: "Confirmed in provider console" }).notes, "Confirmed in provider console");
});
