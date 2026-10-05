import prisma from "../../config/prisma.js";


const dbClient = (tx) => tx || prisma;

const buildBrandWhere = ({ isActive, search } = {}) => {
  const where = {};

  if (typeof isActive === "boolean") where.isActive = isActive;

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

export const createBrand = async (data, tx) => {
  return dbClient(tx).brand.create({ data });
};

export const findBrands = async ({ isActive, search, skip, take } = {}, tx) => {
  return dbClient(tx).brand.findMany({
    where: buildBrandWhere({ isActive, search }),
    include: {
      ...MEDIA_INCLUDE,
      _count: { select: { products: true } },
    },
    orderBy: [{ name: "asc" }],
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countBrands = async ({ isActive, search } = {}, tx) => {
  return dbClient(tx).brand.count({
    where: buildBrandWhere({ isActive, search }),
  });
};

export const findBrandById = async (id, tx) => {
  return dbClient(tx).brand.findUnique({
    where: { id },
    include: {
      ...MEDIA_INCLUDE,
      _count: { select: { products: true } },
    },
  });
};

export const findBrandBySlug = async (slug, tx) => {
  return dbClient(tx).brand.findUnique({ where: { slug } });
};

export const findBrandByName = async (name, tx) => {
  return dbClient(tx).brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
};

export const updateBrand = async (id, data, tx) => {
  return dbClient(tx).brand.update({ where: { id }, data });
};

export const deleteBrand = async (id, tx) => {
  return dbClient(tx).brand.delete({ where: { id } });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
