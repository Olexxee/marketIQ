import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import { generateUniqueSlug } from "../../lib/slug.js";
import { persistOwnerMedia } from "../media/media.service.js";
import {
  countCollections,
  createCollection,
  deleteCollection,
  findCollectionById,
  findCollectionByName,
  findCollectionBySlug,
  findCollections,
  updateCollection,
  withTransaction,
} from "./collection.db.js";



const normalizeName = (value) => value.trim();

const getCollectionOrThrow = async (id, tx) => {
  const collection = await findCollectionById(id, tx);

  if (!collection) {
    throw new NotFoundError("Collection not found");
  }

  return collection;
};

const resolveSlug = async ({ name, currentId, tx }) => {
  return generateUniqueSlug({
    name,
    currentId,
    existsFn: async (slug) => {
      const collection = await findCollectionBySlug(slug, tx);

      return Boolean(collection && collection.id !== currentId);
    },
  });
};

const extractMediaInput = (data) => {
  const { coverImage, galleryImages, slug: _slug, ...rest } = data;

  return {
    rest,
    coverImage: coverImage || null,
    galleryImages: Array.isArray(galleryImages) ? galleryImages : [],
  };
};

const validateUniqueName = async ({ name, currentId, tx }) => {
  const existing = await findCollectionByName(name, tx);

  if (existing && existing.id !== currentId) {
    throw new ConflictError("A collection with this name already exists");
  }
};

export const createCollectionService = async (data) => {
  const { rest, coverImage, galleryImages } = extractMediaInput(data);

  const name = normalizeName(rest.name);

  return withTransaction(async (tx) => {
    await validateUniqueName({
      name,
      tx,
    });

    const slug = await resolveSlug({
      name,
      tx,
    });

    const collection = await createCollection(
      {
        ...rest,
        name,
        slug,
      },
      tx,
    );

    await persistOwnerMedia(
      {
        ownerField: "collectionId",
        ownerId: collection.id,
        coverImage,
        galleryImages,
        replace: false,
      },
      tx,
    );

    return getCollectionOrThrow(collection.id, tx);
  });
};

export const listCollectionsService = async ({
  isActive,
  search,
  skip,
  take,
}) => {
  const [collections, total] = await Promise.all([
    findCollections({
      isActive,
      search,
      skip,
      take,
    }),

    countCollections({
      isActive,
      search,
    }),
  ]);

  return {
    collections,
    total,
  };
};

export const getCollectionService = async (id) => {
  return getCollectionOrThrow(id);
};

export const updateCollectionService = async (id, data) => {
  const existing = await getCollectionOrThrow(id);

  const { rest, coverImage, galleryImages } = extractMediaInput(data);

  const hasNameChange =
    rest.name !== undefined && normalizeName(rest.name) !== existing.name;

  return withTransaction(async (tx) => {
    if (hasNameChange) {
      const name = normalizeName(rest.name);

      await validateUniqueName({
        name,
        currentId: id,
        tx,
      });

      rest.name = name;
      rest.slug = await resolveSlug({
        name,
        currentId: id,
        tx,
      });
    }

    await updateCollection(id, rest, tx);

    const hasMediaInput = coverImage !== null || galleryImages.length > 0;

    if (hasMediaInput) {
      await persistOwnerMedia(
        {
          ownerField: "collectionId",
          ownerId: id,
          coverImage,
          galleryImages,
          replace: true,
        },
        tx,
      );
    }

    return getCollectionOrThrow(id, tx);
  });
};

export const deleteCollectionService = async (id) => {
  const collection = await getCollectionOrThrow(id);

  if (collection._count.products > 0) {
    throw new ConflictError("Cannot delete a collection that has products");
  }

  return withTransaction(async (tx) => {
    await deleteCollection(id, tx);

    return null;
  });
};
