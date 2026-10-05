import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const createMedia = async (data, tx) => {
  return dbClient(tx).media.create({ data });
};

export const createManyMedia = async (rows, tx) => {
  if (!rows.length) return { count: 0 };
  return dbClient(tx).media.createMany({ data: rows });
};

export const deleteMediaByOwner = async (ownerField, ownerId, tx) => {
  return dbClient(tx).media.deleteMany({
    where: { [ownerField]: ownerId },
  });
};

export const findMediaByOwner = async (ownerField, ownerId, tx) => {
  return dbClient(tx).media.findMany({
    where: { [ownerField]: ownerId },
    orderBy: [
      { isPrimary: "desc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  });
};

export const findPrimaryMedia = async (ownerField, ownerId, tx) => {
  return dbClient(tx).media.findFirst({
    where: { [ownerField]: ownerId, isPrimary: true },
  });
};
