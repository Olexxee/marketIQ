import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const findSellerByUserId = async (userId, tx) => {
  return dbClient(tx).sellerProfile.findUnique({
    where: {
      userId,
    },
    include: {
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
        orderBy: [
          {
            isPrimary: "desc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
    },
  });
};

export const findSellerById = async (id, tx) => {
  return dbClient(tx).sellerProfile.findUnique({
    where: {
      id,
    },
  });
};

export const createSeller = async (data, tx) => {
  return dbClient(tx).sellerProfile.create({
    data,
    include: {
      country: true,
      state: true,
      lga: true,
      locations: true,
    },
  });
};

export const updateSeller = async (id, data, tx) => {
  return dbClient(tx).sellerProfile.update({
    where: {
      id,
    },
    data,
    include: {
      country: true,
      state: true,
      lga: true,
      locations: true,
    },
  });
};

export const createBusinessLocation = async (data, tx) => {
  return dbClient(tx).businessLocation.create({
    data,
    include: {
      country: true,
      state: true,
      lga: true,
      city: true,
    },
  });
};

export const findBusinessLocations = async (sellerId, tx) => {
  return dbClient(tx).businessLocation.findMany({
    where: {
      sellerId,
    },
    include: {
      country: true,
      state: true,
      lga: true,
      city: true,
    },
    orderBy: [
      {
        isPrimary: "desc",
      },
      {
        createdAt: "asc",
      },
    ],
  });
};

export const findBusinessLocationById = async (id, tx) => {
  return dbClient(tx).businessLocation.findUnique({
    where: {
      id,
    },
    include: {
      country: true,
      state: true,
      lga: true,
      city: true,
    },
  });
};

export const updateBusinessLocation = async (id, data, tx) => {
  return dbClient(tx).businessLocation.update({
    where: {
      id,
    },
    data,
    include: {
      country: true,
      state: true,
      lga: true,
      city: true,
    },
  });
};

export const deleteBusinessLocation = async (id, tx) => {
  return dbClient(tx).businessLocation.delete({
    where: {
      id,
    },
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
      ...(exceptId && {
        id: {
          not: exceptId,
        },
      }),
    },
    data: {
      isPrimary: false,
    },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
