import { uploadManyMedia, uploadSingleMedia } from "../lib/media.js";

export const processCatalogMedia = (folder) => async (req, res, next) => {
  try {
    const coverFile = req.files?.coverImage?.[0] || null;
    const galleryFiles = req.files?.galleryImages || [];

    if (coverFile) {
      req.body.coverImage = await uploadSingleMedia(coverFile, folder);
    }

    if (galleryFiles.length) {
      req.body.galleryImages = await uploadManyMedia(galleryFiles, folder);
    }

    next();
  } catch (err) {
    next(err);
  }
};

export const processMediaField =
  (fileField, folder, bodyField = fileField) =>
  async (req, res, next) => {
    try {
      const file = req.file || req.files?.[fileField]?.[0] || null;

      if (file) {
        req.body[bodyField] = await uploadSingleMedia(file, folder);
      }

      next();
    } catch (err) {
      next(err);
    }
  };

export const processMediaList =
  (fileField, folder, bodyField = fileField) =>
  async (req, res, next) => {
    try {
      const files = req.files?.[fileField] || req.files || [];

      if (files.length) {
        req.body[bodyField] = await uploadManyMedia(files, folder);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
