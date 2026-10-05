import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const buildCategoryWhere = ({ type, isActive, parentId, search } = {}) => {
  const where = {};

  if (type) where.type = type;
  if (typeof isActive === "boolean") where.isActive = isActive;

  if (parentId !== undefined) {
    where.parentId = parentId || null;
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

export const createCategory = async (data, tx) => {
  return dbClient(tx).category.create({ data });
};

export const findCategories = async (
  { type, isActive, parentId, search, skip, take } = {},
  tx,
) => {
  return dbClient(tx).category.findMany({
    where: buildCategoryWhere({ type, isActive, parentId, search }),
    include: {
      ...MEDIA_INCLUDE,
      parent: { select: { id: true, name: true, slug: true, type: true } },
      _count: {
        select: { children: true, products: true, sourcingRequests: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countCategories = async (
  { type, isActive, parentId, search } = {},
  tx,
) => {
  return dbClient(tx).category.count({
    where: buildCategoryWhere({ type, isActive, parentId, search }),
  });
};

export const findCategoryById = async (id, tx) => {
  return dbClient(tx).category.findUnique({
    where: { id },
    include: {
      ...MEDIA_INCLUDE,
      parent: { select: { id: true, name: true, slug: true, type: true } },
      children: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      _count: {
        select: { children: true, products: true, sourcingRequests: true },
      },
    },
  });
};

export const findCategoryBySlug = async (slug, tx) => {
  return dbClient(tx).category.findUnique({ where: { slug } });
};

export const findCategoryByName = async (name, tx) => {
  return dbClient(tx).category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
};

export const findCategoryByParentAndName = async ({ name, parentId }, tx) => {
  return dbClient(tx).category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      parentId: parentId || null,
    },
  });
};

export const updateCategory = async (id, data, tx) => {
  return dbClient(tx).category.update({ where: { id }, data });
};

export const deleteCategory = async (id, tx) => {
  return dbClient(tx).category.delete({ where: { id } });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
