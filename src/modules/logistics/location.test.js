import test from "node:test";
import assert from "node:assert/strict";
import { buildVerifiedLogisticsLocation } from "./location.js";

const verifiedLocation = {
  addressLine: "12 Market Road, Ikeja",
  latitude: "6.6018",
  longitude: "3.3515",
  coordinatesVerifiedAt: "2026-11-05T10:00:00.000Z",
  coordinatesSource: "admin_verified",
  countryId: "country_1",
  stateId: "state_1",
  lgaId: "lga_1",
  cityId: "city_1",
};

test("builds a normalized verified logistics location snapshot", () => {
  assert.deepEqual(buildVerifiedLogisticsLocation(verifiedLocation, "Pickup"), {
    addressLine: "12 Market Road, Ikeja",
    latitude: 6.6018,
    longitude: 3.3515,
    coordinatesVerifiedAt: "2026-11-05T10:00:00.000Z",
    coordinatesSource: "admin_verified",
    countryId: "country_1",
    stateId: "state_1",
    lgaId: "lga_1",
    cityId: "city_1",
  });
});

test("rejects missing verification metadata", () => {
  assert.throws(
    () => buildVerifiedLogisticsLocation({ ...verifiedLocation, coordinatesVerifiedAt: null }),
    /coordinates have not been verified/,
  );
  assert.throws(
    () => buildVerifiedLogisticsLocation({ ...verifiedLocation, coordinatesSource: " " }),
    /coordinates have not been verified/,
  );
});

test("rejects missing and out-of-range coordinates", () => {
  assert.throws(
    () => buildVerifiedLogisticsLocation({ ...verifiedLocation, latitude: null }),
    /missing a valid latitude/,
  );
  assert.throws(
    () => buildVerifiedLogisticsLocation({ ...verifiedLocation, longitude: "181" }),
    /out-of-range longitude/,
  );
  assert.throws(
    () => buildVerifiedLogisticsLocation({ ...verifiedLocation, latitude: "91" }),
    /out-of-range latitude/,
  );
});

test("rejects an invalid verification timestamp", () => {
  assert.throws(
    () => buildVerifiedLogisticsLocation({ ...verifiedLocation, coordinatesVerifiedAt: "not-a-date" }),
    RangeError,
  );
});
