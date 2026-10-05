import { createMedia, deleteMediaByOwner } from "./media.db.js";

/**
 * Persist cover + gallery media for an owner inside a transaction.
 *
 * ownerField:   "productId" | "variantId" | "categoryId" | "brandId" | ...
 * ownerId:      parent row id
 * coverImage:   uploaded asset object (or null)
 * galleryImages: array of uploaded asset objects
 * replace:      if true, delete existing media for this owner first
 *
 * Returns the list of created Media rows.
 */
export const persistOwnerMedia = async (
  {
    ownerField,
    ownerId,
    coverImage = null,
    galleryImages = [],
    replace = false,
  },
  tx,
) => {
  if (!ownerId) {
    throw new Error("persistOwnerMedia requires an ownerId");
  }

  if (replace) {
    await deleteMediaByOwner(ownerField, ownerId, tx);
  }

  const rows = [];

  if (coverImage) {
    rows.push({
      ...coverImage,
      [ownerField]: ownerId,
      isPrimary: true,
      sortOrder: 0,
    });
  }

  galleryImages.forEach((img, index) => {
    rows.push({
      ...img,
      [ownerField]: ownerId,
      isPrimary: false,
      sortOrder: index + 1,
    });
  });

  if (!rows.length) return [];

  return Promise.all(rows.map((row) => createMedia(row, tx)));
};

/**
 * Split a media list into a primary cover plus gallery.
 * Used by read shapes when returning catalog entities.
 */
export const shapeOwnerMedia = (mediaList = []) => {
  const cover = mediaList.find((m) => m.isPrimary) || null;
  const gallery = mediaList.filter((m) => !m.isPrimary);
  return { cover, gallery };
};
