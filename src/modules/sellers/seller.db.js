import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

// ---------------------------------------------------------------------------
// Reusable includes
// ---------------------------------------------------------------------------

const SELLER_INCLUDE = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  },
  country: true,
  state: true,
  lga: true,
  locations: {
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  },
};

const LOCATION_INCLUDE = {
  country: true,
  state: true,
  lga: true,
  city: true,
};

// ---------------------------------------------------------------------------
// Seller profile
// ---------------------------------------------------------------------------

export const findSellerByUserId = async (userId, tx) => {
  return dbClient(tx).sellerProfile.findUnique({
    where: { userId },
    include: SELLER_INCLUDE,
  });
};

export const findSellerById = async (id, tx) => {
  return dbClient(tx).sellerProfile.findUnique({
    where: { id },
    include: SELLER_INCLUDE,
  });
};

export const createSeller = async (data, tx) => {
  return dbClient(tx).sellerProfile.create({
    data,
    include: SELLER_INCLUDE,
  });
};

export const updateSeller = async (id, data, tx) => {
  return dbClient(tx).sellerProfile.update({
    where: { id },
    data,
    include: SELLER_INCLUDE,
  });
};

// ---------------------------------------------------------------------------
// Business locations
// ---------------------------------------------------------------------------

export const createBusinessLocation = async (data, tx) => {
  return dbClient(tx).businessLocation.create({
    data,
    include: LOCATION_INCLUDE,
  });
};

export const findBusinessLocations = async (sellerId, tx) => {
  return dbClient(tx).businessLocation.findMany({
    where: { sellerId },
    include: LOCATION_INCLUDE,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
};

export const findBusinessLocationById = async (id, tx) => {
  return dbClient(tx).businessLocation.findUnique({
    where: { id },
    include: LOCATION_INCLUDE,
  });
};

export const updateBusinessLocation = async (id, data, tx) => {
  return dbClient(tx).businessLocation.update({
    where: { id },
    data,
    include: LOCATION_INCLUDE,
  });
};

export const deleteBusinessLocation = async (id, tx) => {
  return dbClient(tx).businessLocation.delete({
    where: { id },
  });
};

export const clearPrimaryBusinessLocations = async (
  sellerId,
  tx,
  exceptId = null,
) => {
  return dbClient(tx).businessLocation.updateMany({
    where: {
      sellerId,
      isPrimary: true,
      ...(exceptId && { id: { not: exceptId } }),
    },
    data: { isPrimary: false },
  });
};

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
