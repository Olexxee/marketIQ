import multer from "multer";
import { BadRequestError } from "../classes/errorClasses.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new BadRequestError("Only JPEG, PNG, WEBP, and GIF images are allowed"),
    );
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 20,
  },
});

// Generic factories — use these per route.
export const uploadSingle = (field) => upload.single(field);
export const uploadArray = (field, max = 20) => upload.array(field, max);
export const uploadFields = (fields) => upload.fields(fields);

// Named handlers for catalog flows.
export const uploadCatalogMedia = upload.fields([
  { name: "coverImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 10 },
]);

export const uploadVariantImages = upload.array("variantImages", 20);
export const uploadReviewImages = upload.array("reviewImages", 5);
export const uploadSourcingImages = upload.array("referenceImages", 5);
