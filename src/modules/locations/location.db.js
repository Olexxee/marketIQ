import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const findCountries = async (tx) => {
  return dbClient(tx).country.findMany({
    orderBy: {
      name: "asc",
    },
  });
};

export const findCountryById = async (id, tx) => {
  return dbClient(tx).country.findUnique({
    where: { id },
  });
};

export const findStatesByCountry = async (countryId, tx) => {
  return dbClient(tx).state.findMany({
    where: {
      countryId,
    },
    orderBy: {
      name: "asc",
    },
  });
};

export const findStateById = async (id, tx) => {
  return dbClient(tx).state.findUnique({
    where: { id },
  });
};

export const findLgasByState = async (stateId, tx) => {
  return dbClient(tx).lga.findMany({
    where: {
      stateId,
    },
    orderBy: {
      name: "asc",
    },
  });
};

export const findLgaById = async (id, tx) => {
  return dbClient(tx).lga.findUnique({
    where: { id },
  });
};

export const findCitiesByLga = async (lgaId, tx) => {
  return dbClient(tx).city.findMany({
    where: {
      lgaId,
    },
    orderBy: {
      name: "asc",
    },
  });
};

export const findCityById = async (id, tx) => {
  return dbClient(tx).city.findUnique({
    where: { id },
  });
};
