import {
  findCountries,
  findCountryById,
  findStatesByCountry,
  findStateById,
  findLgasByState,
  findLgaById,
  findCitiesByLga,
  findCityById,
} from "./location.db.js";

import { NotFoundError } from "../../classes/errorClasses.js";

export const getCountries = async () => {
  return findCountries();
};

export const getCountry = async (id) => {
  const country = await findCountryById(id);

  if (!country) {
    throw new NotFoundError("Country not found");
  }

  return country;
};

export const getStates = async (countryId) => {
  const country = await findCountryById(countryId);

  if (!country) {
    throw new NotFoundError("Country not found");
  }

  return findStatesByCountry(countryId);
};

export const getState = async (id) => {
  const state = await findStateById(id);

  if (!state) {
    throw new NotFoundError("State not found");
  }

  return state;
};

export const getLgas = async (stateId) => {
  const state = await findStateById(stateId);

  if (!state) {
    throw new NotFoundError("State not found");
  }

  return findLgasByState(stateId);
};

export const getLga = async (id) => {
  const lga = await findLgaById(id);

  if (!lga) {
    throw new NotFoundError("LGA not found");
  }

  return lga;
};

export const getCities = async (lgaId) => {
  const lga = await findLgaById(lgaId);

  if (!lga) {
    throw new NotFoundError("LGA not found");
  }

  return findCitiesByLga(lgaId);
};

export const getCity = async (id) => {
  const city = await findCityById(id);

  if (!city) {
    throw new NotFoundError("City not found");
  }

  return city;
};
