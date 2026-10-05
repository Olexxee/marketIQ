import { uploadBufferToCloudinary } from "../config/cloudinaryService.js";

export const MEDIA_FOLDERS = {
  PRODUCT: "marketiq/products",
  VARIANT: "marketiq/products/variants",
  CATEGORY: "marketiq/categories",
  BRAND: "marketiq/brands",
  COLLECTION: "marketiq/collections",
  SELLER: "marketiq/sellers",
  REVIEW: "marketiq/reviews",
  SOURCING: "marketiq/sourcing",
};

// 300x300, crop fill, auto quality + format. One thumbnail size for now.
const THUMBNAIL_TRANSFORMATION = "w_300,h_300,c_fill,q_auto,f_auto";

/**
 * Insert the thumbnail transformation into a Cloudinary delivery URL.
 * Isolated here so no other module needs to know Cloudinary's URL shape.
 */
const buildThumbnailUrl = (url) => {
  if (!url) return null;
  if (!url.includes("/upload/")) return null;
  return url.replace("/upload/", `/upload/${THUMBNAIL_TRANSFORMATION}/`);
};

const toMediaAsset = (result, file) => {
  const url = result.secure_url || result.url;

  return {
    url,
    thumbnailUrl: buildThumbnailUrl(url),
    publicId: result.public_id || result.publicId || null,
    mimeType: file.mimetype,
    bytes: result.bytes ?? null,
    format: result.format ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
  };
};

export const uploadSingleMedia = async (file, folder) => {
  if (!file) return null;

  const result = await uploadBufferToCloudinary(file.buffer, {
    folder,
    resource_type: "image",
  });

  return toMediaAsset(result, file);
};

export const uploadManyMedia = async (files = [], folder) => {
  if (!files.length) return [];
  return Promise.all(files.map((file) => uploadSingleMedia(file, folder)));
};
