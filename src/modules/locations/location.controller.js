import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";

import {
  getCountries,
  getCountry,
  getStates,
  getState,
  getLgas,
  getLga,
  getCities,
  getCity,
} from "./location.service.js";

export const listCountries = asyncWrapper(async (_req, res) => {
  const countries = await getCountries();

  return successResponse({
    res,
    statusCode: 200,
    message: "Countries retrieved successfully",
    data: countries,
  });
});

export const showCountry = asyncWrapper(async (req, res) => {
  const country = await getCountry(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Country retrieved successfully",
    data: country,
  });
});

export const listStates = asyncWrapper(async (req, res) => {
  const states = await getStates(req.params.countryId);

  return successResponse({
    res,
    statusCode: 200,
    message: "States retrieved successfully",
    data: states,
  });
});

export const showState = asyncWrapper(async (req, res) => {
  const state = await getState(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "State retrieved successfully",
    data: state,
  });
});

export const listLgas = asyncWrapper(async (req, res) => {
  const lgas = await getLgas(req.params.stateId);

  return successResponse({
    res,
    statusCode: 200,
    message: "LGAs retrieved successfully",
    data: lgas,
  });
});

export const showLga = asyncWrapper(async (req, res) => {
  const lga = await getLga(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "LGA retrieved successfully",
    data: lga,
  });
});

export const listCities = asyncWrapper(async (req, res) => {
  const cities = await getCities(req.params.lgaId);

  return successResponse({
    res,
    statusCode: 200,
    message: "Cities retrieved successfully",
    data: cities,
  });
});

export const showCity = asyncWrapper(async (req, res) => {
  const city = await getCity(req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "City retrieved successfully",
    data: city,
  });
});