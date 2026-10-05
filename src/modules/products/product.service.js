import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import { generateUniqueSlug } from "../../lib/slug.js";
import { persistOwnerMedia } from "../media/media.service.js";
import {
  archiveProduct,
  countPublicProducts,
  countSellerProducts,
  createProduct,
  findBrandForProduct,
  findCategoryForProduct,
  findCollectionForProduct,
  findProductById,
  findProductBySlugForSeller,
  findPublicProducts,
  findSellerProducts,
  updateProduct,
  withTransaction,
} from "./product.db.js";

// ============================================================
// HELPERS
// ============================================================

const normalizeName = (value) => value.trim();

const resolveSlug = (sellerId, name, providedSlug, currentId, tx) =>
  generateUniqueSlug({
    name,
    providedSlug,
    currentId,
    existsFn: (slug) => findProductBySlugForSeller(sellerId, slug, tx),
  });

const validateCatalogRefs = async (
  { categoryId, brandId, collectionId },
  tx,
) => {
  const category = await findCategoryForProduct(categoryId, tx);
  if (!category) throw new NotFoundError("Category not found");
  if (!category.isActive) throw new ConflictError("Category is not active");

  if (brandId) {
    const brand = await findBrandForProduct(brandId, tx);
    if (!brand) throw new NotFoundError("Brand not found");
    if (!brand.isActive) throw new ConflictError("Brand is not active");
  }

  if (collectionId) {
    const collection = await findCollectionForProduct(collectionId, tx);
    if (!collection) throw new NotFoundError("Collection not found");
    if (!collection.isActive)
      throw new ConflictError("Collection is not active");
  }
};

const getSellerProductOrThrow = async (sellerId, id, tx) => {
  const product = await findProductById(id, { isPublic: false }, tx);

  if (!product || product.sellerId !== sellerId) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

const extractMediaInput = (data) => {
  const { coverImage, galleryImages, ...rest } = data;

  return {
    rest,
    coverImage: coverImage || null,
    galleryImages: Array.isArray(galleryImages) ? galleryImages : [],
  };
};

// ============================================================
// CREATE
// ============================================================

export const createProductService = async (sellerId, payload) => {
  const { rest, coverImage, galleryImages } = extractMediaInput(payload);
  const name = normalizeName(rest.name);

  return withTransaction(async (tx) => {
    await validateCatalogRefs(
      {
        categoryId: rest.categoryId,
        brandId: rest.brandId,
        collectionId: rest.collectionId,
      },
      tx,
    );

    const slug = await resolveSlug(sellerId, name, rest.slug, null, tx);

    const product = await createProduct(
      {
        ...rest,
        name,
        slug,
        sellerId,
        status: rest.status || "DRAFT",
      },
      tx,
    );

    await persistOwnerMedia(
      {
        ownerField: "productId",
        ownerId: product.id,
        coverImage,
        galleryImages,
        replace: false,
      },
      tx,
    );

    return findProductById(product.id, { isPublic: false }, tx);
  });
};

// ============================================================
// READ
// ============================================================

export const listSellerProductsService = async (sellerId, filters = {}) => {
  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findSellerProducts({
      sellerId,
      status: filters.status,
      search: filters.search,
      categoryId: filters.categoryId,
      brandId: filters.brandId,
      collectionId: filters.collectionId,
      skip,
      take,
    }),
    countSellerProducts({
      sellerId,
      status: filters.status,
      search: filters.search,
      categoryId: filters.categoryId,
      brandId: filters.brandId,
      collectionId: filters.collectionId,
    }),
  ]);

  return { items, total, page, limit };
};

export const getSellerProductService = async (sellerId, id) => {
  return getSellerProductOrThrow(sellerId, id);
};

export const listPublicProductsService = async (filters = {}) => {
  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findPublicProducts({
      search: filters.search,
      categoryId: filters.categoryId,
      brandId: filters.brandId,
      collectionId: filters.collectionId,
      skip,
      take,
    }),
    countPublicProducts({
      search: filters.search,
      categoryId: filters.categoryId,
      brandId: filters.brandId,
      collectionId: filters.collectionId,
    }),
  ]);

  return { items, total, page, limit };
};

export const getPublicProductService = async (id) => {
  const product = await findProductById(id, { isPublic: true });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

// ============================================================
// UPDATE
// ============================================================

export const updateProductService = async (sellerId, id, payload) => {
  const { rest, coverImage, galleryImages } = extractMediaInput(payload);
  const hasNewMedia = Boolean(coverImage) || galleryImages.length > 0;

  return withTransaction(async (tx) => {
    const existing = await getSellerProductOrThrow(sellerId, id, tx);

    if (
      rest.categoryId ||
      rest.brandId !== undefined ||
      rest.collectionId !== undefined
    ) {
      await validateCatalogRefs(
        {
          categoryId: rest.categoryId || existing.categoryId,
          brandId: rest.brandId !== undefined ? rest.brandId : existing.brandId,
          collectionId:
            rest.collectionId !== undefined
              ? rest.collectionId
              : existing.collectionId,
        },
        tx,
      );
    }

    let slug;

    if (rest.name !== undefined && !rest.slug) {
      slug = await resolveSlug(sellerId, rest.name, undefined, id, tx);
    } else if (rest.slug) {
      slug = await resolveSlug(sellerId, existing.name, rest.slug, id, tx);
    }

    await updateProduct(
      id,
      {
        ...rest,
        ...(rest.name !== undefined && { name: normalizeName(rest.name) }),
        ...(slug !== undefined && { slug }),
      },
      tx,
    );

    if (hasNewMedia) {
      await persistOwnerMedia(
        {
          ownerField: "productId",
          ownerId: id,
          coverImage,
          galleryImages,
          replace: true,
        },
        tx,
      );
    }

    return findProductById(id, { isPublic: false }, tx);
  });
};

// ============================================================
// DELETE (archive)
// ============================================================

export const archiveProductService = async (sellerId, id) => {
  return withTransaction(async (tx) => {
    await getSellerProductOrThrow(sellerId, id, tx);
    await archiveProduct(id, tx);
    return findProductById(id, { isPublic: false }, tx);
  });
};
