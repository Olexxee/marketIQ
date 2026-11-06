import { BadRequestError } from "../../classes/errorClasses.js";

const readCoordinate = (value, field, minimum, maximum) => {
  const parsed = Number(value);

  if (value === null || value === undefined || value === "" || !Number.isFinite(parsed)) {
    throw new BadRequestError(`Verified logistics location is missing a valid ${field}`);
  }

  if (parsed < minimum || parsed > maximum) {
    throw new BadRequestError(`Verified logistics location has an out-of-range ${field}`);
  }

  return parsed;
};

/**
 * Build the only location shape permitted in a Logistic Hub quote/booking
 * request. Geographic labels alone are not sufficient for routing/pricing.
 */
export const buildVerifiedLogisticsLocation = (location, label = "Location") => {
  if (!location || !location.coordinatesVerifiedAt || !location.coordinatesSource?.trim()) {
    throw new BadRequestError(`${label} coordinates have not been verified`);
  }

  const latitude = readCoordinate(location.latitude, "latitude", -90, 90);
  const longitude = readCoordinate(location.longitude, "longitude", -180, 180);

  return {
    addressLine: location.addressLine ?? location.address ?? null,
    latitude,
    longitude,
    coordinatesVerifiedAt: new Date(location.coordinatesVerifiedAt).toISOString(),
    coordinatesSource: location.coordinatesSource.trim(),
    countryId: location.countryId ?? null,
    stateId: location.stateId ?? null,
    lgaId: location.lgaId ?? null,
    cityId: location.cityId ?? null,
  };
};
