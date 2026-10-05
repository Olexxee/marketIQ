import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const MEDIA_ORDER = [{ isPrimary: "desc" }, { sortOrder: "asc" }];

const LIST_INCLUDE = {
  media: {
    where: { isPrimary: true },
    take: 1,
    orderBy: MEDIA_ORDER,
  },
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  collection: { select: { id: true, name: true, slug: true } },
  seller: { select: { id: true, businessName: true, status: true } },
  _count: { select: { variants: true } },
};

const DETAIL_INCLUDE = (isPublic) => ({
  media: { orderBy: MEDIA_ORDER },
  category: { select: { id: true, name: true, slug: true, type: true } },
  brand: { select: { id: true, name: true, slug: true } },
  collection: { select: { id: true, name: true, slug: true } },
  seller: { select: { id: true, businessName: true, status: true } },
  variants: {
    where: isPublic ? { isActive: true } : undefined,
    include: {
      media: { orderBy: MEDIA_ORDER },
    },
    orderBy: { createdAt: "asc" },
  },
  _count: {
    select: { variants: true, wishlists: true },
  },
});

const buildSellerProductWhere = ({
  sellerId,
  status,
  search,
  categoryId,
  brandId,
  collectionId,
} = {}) => {
  const where = { sellerId };

  if (status) where.status = status;

  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (collectionId) where.collectionId = collectionId;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

const buildPublicProductWhere = ({
  search,
  categoryId,
  brandId,
  collectionId,
} = {}) => {
  const where = {
    status: "ACTIVE",
    seller: { status: "ACTIVE" },
  };

  if (categoryId) where.categoryId = categoryId;
  if (brandId) where.brandId = brandId;
  if (collectionId) where.collectionId = collectionId;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
};

// ============================================================
// CORE
// ============================================================

export const createProduct = async (data, tx) => {
  return dbClient(tx).product.create({ data });
};

export const updateProduct = async (id, data, tx) => {
  return dbClient(tx).product.update({ where: { id }, data });
};

export const archiveProduct = async (id, tx) => {
  return dbClient(tx).product.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
};

export const findProductById = async (id, { isPublic = false } = {}, tx) => {
  return dbClient(tx).product.findFirst({
    where: isPublic
      ? { id, status: "ACTIVE", seller: { status: "ACTIVE" } }
      : { id },
    include: DETAIL_INCLUDE(isPublic),
  });
};

export const findProductBySlugForSeller = async (sellerId, slug, tx) => {
  return dbClient(tx).product.findUnique({
    where: { sellerId_slug: { sellerId, slug } },
  });
};

// ============================================================
// LISTINGS
// ============================================================

export const findSellerProducts = async (
  {
    sellerId,
    status,
    search,
    categoryId,
    brandId,
    collectionId,
    skip,
    take,
  } = {},
  tx,
) => {
  return dbClient(tx).product.findMany({
    where: buildSellerProductWhere({
      sellerId,
      status,
      search,
      categoryId,
      brandId,
      collectionId,
    }),
    include: LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countSellerProducts = async (
  { sellerId, status, search, categoryId, brandId, collectionId } = {},
  tx,
) => {
  return dbClient(tx).product.count({
    where: buildSellerProductWhere({
      sellerId,
      status,
      search,
      categoryId,
      brandId,
      collectionId,
    }),
  });
};

export const findPublicProducts = async (
  { search, categoryId, brandId, collectionId, skip, take } = {},
  tx,
) => {
  return dbClient(tx).product.findMany({
    where: buildPublicProductWhere({
      search,
      categoryId,
      brandId,
      collectionId,
    }),
    include: LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countPublicProducts = async (
  { search, categoryId, brandId, collectionId } = {},
  tx,
) => {
  return dbClient(tx).product.count({
    where: buildPublicProductWhere({
      search,
      categoryId,
      brandId,
      collectionId,
    }),
  });
};

// ============================================================
// REFERENCE CHECKS
// ============================================================

export const findCategoryForProduct = async (id, tx) => {
  return dbClient(tx).category.findUnique({ where: { id } });
};

export const findBrandForProduct = async (id, tx) => {
  return dbClient(tx).brand.findUnique({ where: { id } });
};

export const findCollectionForProduct = async (id, tx) => {
  return dbClient(tx).collection.findUnique({ where: { id } });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
