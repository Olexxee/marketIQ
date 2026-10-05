import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import { generateUniqueSlug } from "../../lib/slug.js";
import { persistOwnerMedia } from "../media/media.service.js";
import {
  countCategories,
  createCategory,
  deleteCategory,
  findCategories,
  findCategoryById,
  findCategoryByParentAndName,
  findCategoryBySlug,
  updateCategory,
  withTransaction,
} from "./category.db.js";



// ============================================================
// HELPERS
// ============================================================

const normalizeName = (value) => value.trim();

const getCategoryOrThrow = async (id, tx) => {
  const category = await findCategoryById(id, tx);

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  return category;
};

// Slugs are always generated from the name. currentId lets a category
// keep its own slug when it is updated.
const resolveSlug = (name, currentId, tx) =>
  generateUniqueSlug({
    name,
    currentId,
    existsFn: (slug) => findCategoryBySlug(slug, tx),
  });

const validateParentCategory = async (
  { parentId, categoryType, currentCategoryId = null },
  tx,
) => {
  if (!parentId) return null;

  if (currentCategoryId && parentId === currentCategoryId) {
    throw new ConflictError("A category cannot be its own parent");
  }

  const parent = await findCategoryById(parentId, tx);

  if (!parent) {
    throw new NotFoundError("Parent category not found");
  }

  if (parent.type !== categoryType) {
    throw new ConflictError("Parent category must have the same category type");
  }

  return parent;
};

const validateNoCircularParent = async (categoryId, parentId, tx) => {
  if (!parentId) return;

  let currentId = parentId;

  while (currentId) {
    if (currentId === categoryId) {
      throw new ConflictError(
        "Category hierarchy cannot contain a circular relationship",
      );
    }

    const current = await findCategoryById(currentId, tx);

    if (!current) break;

    currentId = current.parentId;
  }
};

// Splits media out of the payload and drops any client-sent slug, so slugs
// can never be set directly even if the validator is bypassed.
const extractMediaInput = (data) => {
  // eslint-disable-next-line no-unused-vars
  const { coverImage, galleryImages, slug: _slug, ...rest } = data;

  return {
    rest,
    coverImage: coverImage || null,
    galleryImages: Array.isArray(galleryImages) ? galleryImages : [],
  };
};

// ============================================================
// CREATE
// ============================================================

export const createCategoryService = async (payload) => {
  const { rest, coverImage, galleryImages } = extractMediaInput(payload);
  const name = normalizeName(rest.name);

  return withTransaction(async (tx) => {
    const existingName = await findCategoryByParentAndName(
      { name, parentId: rest.parentId || null },
      tx,
    );

    if (existingName) {
      throw new ConflictError(
        "A category with this name already exists under this parent",
      );
    }

    await validateParentCategory(
      { parentId: rest.parentId, categoryType: rest.type },
      tx,
    );

    const slug = await resolveSlug(name, null, tx);

    const category = await createCategory(
      {
        ...rest,
        name,
        slug,
        parentId: rest.parentId || null,
      },
      tx,
    );

    await persistOwnerMedia(
      {
        ownerField: "categoryId",
        ownerId: category.id,
        coverImage,
        galleryImages,
        replace: false,
      },
      tx,
    );

    return findCategoryById(category.id, tx);
  });
};

// ============================================================
// READ
// ============================================================

export const listCategories = async (filters = {}) => {
  let parentId;

  if (filters.rootOnly) {
    parentId = null;
  } else if (filters.parentId) {
    parentId = filters.parentId;
  }

  const baseWhere = {
    type: filters.type,
    isActive: filters.isActive,
    ...(parentId !== undefined && { parentId }),
    search: filters.search,
  };

  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findCategories({ ...baseWhere, skip, take }),
    countCategories(baseWhere),
  ]);

  return { items, total, page, limit };
};

export const listCategoryTree = async (filters = {}) => {
  const categories = await findCategories({
    type: filters.type,
    isActive: filters.isActive,
    search: filters.search,
  });

  const categoryMap = new Map();

  for (const category of categories) {
    categoryMap.set(category.id, { ...category, children: [] });
  }

  const roots = [];

  for (const category of categoryMap.values()) {
    if (category.parentId) {
      const parent = categoryMap.get(category.parentId);

      if (parent) {
        parent.children.push(category);
      } else {
        roots.push(category);
      }
    } else {
      roots.push(category);
    }
  }

  return roots;
};

export const getCategoryService = async (id) => {
  return getCategoryOrThrow(id);
};

// ============================================================
// UPDATE
// ============================================================

export const updateCategoryService = async (id, payload) => {
  const { rest, coverImage, galleryImages } = extractMediaInput(payload);

  const hasNewMedia = Boolean(coverImage) || galleryImages.length > 0;

  return withTransaction(async (tx) => {
    const existing = await getCategoryOrThrow(id, tx);

    // Type is not changeable on update.
    const nextType = existing.type;
    const nextParentId =
      rest.parentId !== undefined ? rest.parentId : existing.parentId;

    if (rest.name !== undefined || rest.parentId !== undefined) {
      const name = normalizeName(
        rest.name !== undefined ? rest.name : existing.name,
      );

      const duplicate = await findCategoryByParentAndName(
        { name, parentId: nextParentId || null },
        tx,
      );

      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(
          "A category with this name already exists under this parent",
        );
      }
    }

    await validateParentCategory(
      {
        parentId: nextParentId,
        categoryType: nextType,
        currentCategoryId: id,
      },
      tx,
    );

    await validateNoCircularParent(id, nextParentId, tx);

    // Regenerate the slug only when the name changes.
    let slug;

    if (rest.name !== undefined) {
      slug = await resolveSlug(normalizeName(rest.name), id, tx);
    }

    await updateCategory(
      id,
      {
        ...rest,
        ...(rest.name !== undefined && { name: normalizeName(rest.name) }),
        ...(slug !== undefined && { slug }),
        ...(rest.parentId !== undefined && {
          parentId: rest.parentId || null,
        }),
      },
      tx,
    );

    if (hasNewMedia) {
      await persistOwnerMedia(
        {
          ownerField: "categoryId",
          ownerId: id,
          coverImage,
          galleryImages,
          replace: true,
        },
        tx,
      );
    }

    return findCategoryById(id, tx);
  });
};

// ============================================================
// DELETE
// ============================================================

export const deleteCategoryService = async (id) => {
  const category = await getCategoryOrThrow(id);

  if (category.children.length > 0) {
    throw new ConflictError(
      "Cannot delete a category that has child categories",
    );
  }

  if (category._count.products > 0) {
    throw new ConflictError("Cannot delete a category that has products");
  }

  if (category._count.sourcingRequests > 0) {
    throw new ConflictError(
      "Cannot delete a category used by sourcing requests",
    );
  }

  await deleteCategory(id);

  return null;
};
