import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const buildCollectionWhere = ({ isActive, search } = {}) => {
  const where = {};

  if (typeof isActive === "boolean") {
    where.isActive = isActive;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

const MEDIA_INCLUDE = {
  media: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  },
};

export const createCollection = async (data, tx) => {
  return dbClient(tx).collection.create({
    data,
  });
};

export const findCollections = async (
  { isActive, search, skip, take } = {},
  tx,
) => {
  return dbClient(tx).collection.findMany({
    where: buildCollectionWhere({ isActive, search }),
    include: {
      ...MEDIA_INCLUDE,
      _count: {
        select: {
          products: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countCollections = async ({ isActive, search } = {}, tx) => {
  return dbClient(tx).collection.count({
    where: buildCollectionWhere({ isActive, search }),
  });
};

export const findCollectionById = async (id, tx) => {
  return dbClient(tx).collection.findUnique({
    where: { id },
    include: {
      ...MEDIA_INCLUDE,
      _count: {
        select: {
          products: true,
        },
      },
    },
  });
};

export const findCollectionBySlug = async (slug, tx) => {
  return dbClient(tx).collection.findUnique({
    where: { slug },
  });
};

export const findCollectionByName = async (name, tx) => {
  return dbClient(tx).collection.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });
};

export const updateCollection = async (id, data, tx) => {
  return dbClient(tx).collection.update({
    where: { id },
    data,
  });
};

export const deleteCollection = async (id, tx) => {
  return dbClient(tx).collection.delete({
    where: { id },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
