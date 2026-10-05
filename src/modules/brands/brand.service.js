import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import { generateUniqueSlug } from "../../lib/slug.js";
import { persistOwnerMedia } from "../media/media.service.js";

import {
  countBrands,
  createBrand,
  deleteBrand,
  findBrandById,
  findBrandByName,
  findBrandBySlug,
  findBrands,
  updateBrand,
  withTransaction,
} from "./brand.db.js";

// ============================================================
// HELPERS
// ============================================================

const normalizeName = (value) => value.trim();

const getBrandOrThrow = async (id, tx) => {
  const brand = await findBrandById(id, tx);

  if (!brand) {
    throw new NotFoundError("Brand not found");
  }

  return brand;
};

const resolveSlug = (name, providedSlug, currentId, tx) =>
  generateUniqueSlug({
    name,
    providedSlug,
    currentId,
    existsFn: (slug) => findBrandBySlug(slug, tx),
  });

const ensureNameIsAvailable = async (name, currentId, tx) => {
  const existing = await findBrandByName(name, tx);

  if (existing && existing.id !== currentId) {
    throw new ConflictError("A brand with this name already exists");
  }
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

export const createBrandService = async (payload) => {
  const { rest, coverImage, galleryImages } = extractMediaInput(payload);
  const name = normalizeName(rest.name);

  return withTransaction(async (tx) => {
    await ensureNameIsAvailable(name, null, tx);

    const slug = await resolveSlug(name, rest.slug, null, tx);

    const brand = await createBrand(
      {
        ...rest,
        name,
        slug,
      },
      tx,
    );

    await persistOwnerMedia(
      {
        ownerField: "brandId",
        ownerId: brand.id,
        coverImage,
        galleryImages,
        replace: false,
      },
      tx,
    );

    return findBrandById(brand.id, tx);
  });
};

// ============================================================
// READ
// ============================================================

export const listBrands = async (filters = {}) => {
  const baseWhere = {
    isActive: filters.isActive,
    search: filters.search,
  };

  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findBrands({ ...baseWhere, skip, take }),
    countBrands(baseWhere),
  ]);

  return { items, total, page, limit };
};

export const getBrandService = async (id) => {
  return getBrandOrThrow(id);
};

// ============================================================
// UPDATE
// ============================================================

export const updateBrandService = async (id, payload) => {
  const { rest, coverImage, galleryImages } = extractMediaInput(payload);

  const hasNewMedia = Boolean(coverImage) || galleryImages.length > 0;

  return withTransaction(async (tx) => {
    const existing = await getBrandOrThrow(id, tx);

    if (rest.name !== undefined) {
      const name = normalizeName(rest.name);
      await ensureNameIsAvailable(name, id, tx);
    }

    let slug;

    if (rest.name !== undefined && !rest.slug) {
      slug = await resolveSlug(rest.name, undefined, id, tx);
    } else if (rest.slug) {
      slug = await resolveSlug(existing.name, rest.slug, id, tx);
    }

    await updateBrand(
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
          ownerField: "brandId",
          ownerId: id,
          coverImage,
          galleryImages,
          replace: true,
        },
        tx,
      );
    }

    return findBrandById(id, tx);
  });
};

// ============================================================
// DELETE
// ============================================================

export const deleteBrandService = async (id) => {
  const brand = await getBrandOrThrow(id);

  if (brand._count.products > 0) {
    throw new ConflictError("Cannot delete a brand that has products");
  }

  await deleteBrand(id);

  return null;
};
