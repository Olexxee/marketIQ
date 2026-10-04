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



const validateLocationHierarchy = async ({
  countryId,
  stateId,
  lgaId,
  cityId,
}) => {
  const country = await findCountryById(countryId);

  if (!country) {
    throw new NotFoundError("Country not found");
  }

  const state = await findStateById(stateId);

  if (!state) {
    throw new NotFoundError("State not found");
  }

  if (state.countryId !== countryId) {
    throw new BadRequestError("State does not belong to the selected country");
  }

  const lga = await findLgaById(lgaId);

  if (!lga) {
    throw new NotFoundError("LGA not found");
  }

  if (lga.stateId !== stateId) {
    throw new BadRequestError("LGA does not belong to the selected state");
  }

  const city = await findCityById(cityId);

  if (!city) {
    throw new NotFoundError("City not found");
  }

  if (city.lgaId !== lgaId) {
    throw new BadRequestError("City does not belong to the selected LGA");
  }
};

export const onboardSeller = async (userId, data) => {
  const existingSeller = await findSellerByUserId(userId);

  if (existingSeller) {
    throw new ConflictError("You already have a seller profile");
  }

  return createSeller({
    userId,
    businessName: data.businessName,
    description: data.description || null,
    phone: data.phone || null,
    email: data.email || null,
    tradeCapabilities: data.tradeCapabilities,
    status: "PENDING",
  });
};

export const getSellerProfile = async (userId) => {
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  return seller;
};

export const updateSellerProfile = async (userId, data) => {
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  return updateSeller(seller.id, data);
};

export const createSellerLocation = async (userId, data) => {
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

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
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  return findBusinessLocations(seller.id);
};

const getOwnedLocation = async (sellerId, locationId) => {
  const location = await findBusinessLocationById(locationId);

  if (!location) {
    throw new NotFoundError("Business location not found");
  }

  if (location.sellerId !== sellerId) {
    throw new NotFoundError("Business location not found");
  }

  return location;
};

export const getSellerLocation = async (userId, locationId) => {
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  return getOwnedLocation(seller.id, locationId);
};

export const updateSellerLocation = async (userId, locationId, data) => {
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  const location = await getOwnedLocation(seller.id, locationId);

  const geographicFields = ["countryId", "stateId", "lgaId", "cityId"];

  const hasGeographicUpdate = geographicFields.some((field) => field in data);

  if (hasGeographicUpdate) {
    await validateLocationHierarchy({
      countryId: data.countryId || location.countryId,
      stateId: data.stateId || location.stateId,
      lgaId: data.lgaId || location.lgaId,
      cityId: data.cityId || location.cityId,
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
  const seller = await findSellerByUserId(userId);

  if (!seller) {
    throw new NotFoundError("Seller profile not found");
  }

  const location = await getOwnedLocation(seller.id, locationId);

  if (location.isPrimary) {
    throw new BadRequestError(
      "The primary business location cannot be deleted",
    );
  }

  await deleteBusinessLocation(locationId);
};
