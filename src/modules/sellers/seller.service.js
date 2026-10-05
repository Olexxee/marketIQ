import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../classes/errorClasses.js";

import {
  createBusinessLocation,
  createSeller,
  deleteBusinessLocation,
  findBusinessLocationById,
  findBusinessLocations,
  findSellerById,
  findSellerByUserId,
  updateBusinessLocation,
  updateSeller,
  clearPrimaryBusinessLocations,
  withTransaction,
} from "./seller.db.js";

import {
  findCityById,
  findCountryById,
  findLgaById,
  findStateById,
} from "../locations/location.db.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps API field names → Prisma field names for SellerProfile.
 * Only includes keys explicitly present in `data`.
 */
const mapSellerWritePayload = (data) => {
  const payload = {};

  if (data.businessName !== undefined) payload.businessName = data.businessName;
  if (data.description !== undefined)
    payload.businessDescription = data.description;
  if (data.phone !== undefined) payload.businessPhone = data.phone;
  if (data.email !== undefined) payload.businessEmail = data.email;
  if (data.tradeCapabilities !== undefined)
    payload.tradeCapabilities = data.tradeCapabilities;

  return payload;
};

const requireSellerProfile = async (userId) => {
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  return seller;
};

const requireSellerProfileById = async (sellerId) => {
  const seller = await findSellerById(sellerId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  return seller;
};

const requireOwnedLocation = async (sellerId, locationId) => {
  const location = await findBusinessLocationById(locationId);

  if (!location || location.sellerId !== sellerId) {
    throw new NotFoundError("Business location not found");
  }

  return location;
};

const validateLocationHierarchy = async ({
  countryId,
  stateId,
  lgaId,
  cityId,
}) => {
  const country = await findCountryById(countryId);
  if (!country) throw new NotFoundError("Country not found");

  const state = await findStateById(stateId);
  if (!state) throw new NotFoundError("State not found");
  if (state.countryId !== countryId) {
    throw new BadRequestError("State does not belong to the selected country");
  }

  const lga = await findLgaById(lgaId);
  if (!lga) throw new NotFoundError("LGA not found");
  if (lga.stateId !== stateId) {
    throw new BadRequestError("LGA does not belong to the selected state");
  }

  const city = await findCityById(cityId);
  if (!city) throw new NotFoundError("City not found");
  if (city.lgaId !== lgaId) {
    throw new BadRequestError("City does not belong to the selected LGA");
  }
};

// ---------------------------------------------------------------------------
// Seller profile
// ---------------------------------------------------------------------------

export const onboardSeller = async (userId, data) => {
  const existingSeller = await findSellerByUserId(userId);

  if (existingSeller) {
    throw new ConflictError("You already have a seller profile");
  }

  return createSeller({
    userId,
    businessName: data.businessName,
    businessDescription: data.description ?? null,
    businessPhone: data.phone ?? null,
    businessEmail: data.email ?? null,
    tradeCapabilities: data.tradeCapabilities,
    status: "PENDING",
  });
};

export const getSellerProfile = async (userId) => {
  return requireSellerProfile(userId);
};

/**
 * Fetch a seller profile by its own id (not userId).
 * Use for admin routes or cross-module lookups.
 */
export const getSellerProfileById = async (sellerId) => {
  return requireSellerProfileById(sellerId);
};

export const updateSellerProfile = async (userId, data) => {
  const seller = await requireSellerProfile(userId);

  const payload = mapSellerWritePayload(data);

  return updateSeller(seller.id, payload);
};

// ---------------------------------------------------------------------------
// Business locations
// ---------------------------------------------------------------------------

export const createSellerLocation = async (userId, data) => {
  const seller = await requireSellerProfile(userId);

  await validateLocationHierarchy(data);

  return withTransaction(async (tx) => {
    if (data.isPrimary) {
      await clearPrimaryBusinessLocations(seller.id, tx);
    }

    return createBusinessLocation(
      {
        sellerId: seller.id,
        name: data.name,
        addressLine: data.addressLine,
        countryId: data.countryId,
        stateId: data.stateId,
        lgaId: data.lgaId,
        cityId: data.cityId,
        isPrimary: data.isPrimary,
        isActive: true,
        isFulfillmentLocation: data.isFulfillmentLocation,
      },
      tx,
    );
  });
};

export const getSellerLocations = async (userId) => {
  const seller = await requireSellerProfile(userId);
  return findBusinessLocations(seller.id);
};

export const getSellerLocation = async (userId, locationId) => {
  const seller = await requireSellerProfile(userId);
  return requireOwnedLocation(seller.id, locationId);
};

export const updateSellerLocation = async (userId, locationId, data) => {
  const seller = await requireSellerProfile(userId);
  const location = await requireOwnedLocation(seller.id, locationId);

  const geographicFields = ["countryId", "stateId", "lgaId", "cityId"];
  const hasGeographicUpdate = geographicFields.some((field) => field in data);

  if (hasGeographicUpdate) {
    await validateLocationHierarchy({
      countryId: data.countryId ?? location.countryId,
      stateId: data.stateId ?? location.stateId,
      lgaId: data.lgaId ?? location.lgaId,
      cityId: data.cityId ?? location.cityId,
    });
  }

  return withTransaction(async (tx) => {
    if (data.isPrimary === true) {
      await clearPrimaryBusinessLocations(seller.id, tx, locationId);
    }

    return updateBusinessLocation(locationId, data, tx);
  });
};

export const deleteSellerLocation = async (userId, locationId) => {
  const seller = await requireSellerProfile(userId);
  const location = await requireOwnedLocation(seller.id, locationId);

  if (location.isPrimary) {
    throw new BadRequestError(
      "The primary business location cannot be deleted",
    );
  }

  await deleteBusinessLocation(locationId);
};
