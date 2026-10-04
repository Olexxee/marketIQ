import { uploadBufferToCloudinary } from "../config/cloudinaryService.js";

/**
 * Process variant images from multer upload
 * Expects req.files from upload.array('images')
 * Attaches processed images to req.body.variantImages
 */
export const processVariantImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      req.body.variantImages = [];
      return next();
    }

    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: "keplex/variants",
        resource_type: "image",
      });

      return {
        url: result.url,
        publicId: result.publicId,
        mimeType: file.mimetype,
        bytes: result.bytes,
        format: result.format,
        width: result.width,
        height: result.height,
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);
    req.body.variantImages = uploadedImages;

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Process product hero image
 * Expects req.file from upload.single('heroImage')
 */
export const processHeroImage = async (req, res, next) => {
  try {
    if (!req.file) {
      req.body.heroImage = null;
      return next();
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: "keplex/products/hero",
      resource_type: "image",
    });

    req.body.heroImage = {
      url: result.url,
      publicId: result.publicId,
      mimeType: req.file.mimetype,
      bytes: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
    };

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Generic image processor for any field
 * Usage: processImages('variantImages', 'keplex/variants')
 */
export const processImages = (
  bodyField = "images",
  folder = "keplex/general",
) => {
  return async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        req.body[bodyField] = [];
        return next();
      }

      const uploadPromises = req.files.map(async (file) => {
        const result = await uploadBufferToCloudinary(file.buffer, {
          folder,
          resource_type: "image",
        });

        return {
          url: result.url,
          publicId: result.publicId,
          mimeType: file.mimetype,
          bytes: result.bytes,
          format: result.format,
          width: result.width,
          height: result.height,
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);
      req.body[bodyField] = uploadedImages;

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Process single image upload to a specific folder
 * Usage: processSingleImage('keplex/products')
 */
export const processSingleImage = (folder = "keplex/general") => {
  return async (req, res, next) => {
    try {
      if (!req.file) {
        req.uploadedImage = null;
        return next();
      }

      const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder,
        resource_type: "image",
      });

      req.uploadedImage = {
        url: result.url,
        publicId: result.publicId,
        mimeType: req.file.mimetype,
        bytes: result.bytes,
        format: result.format,
        width: result.width,
        height: result.height,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};

/**
 * Process sourcing reference images
 *
 * Expects req.files from uploadSourcingImages
 * Attaches processed images to req.body.referenceImages
 */
/**
 * Process sourcing reference images
 *
 * Expects req.files from uploadSourcingImages
 * Attaches processed images to req.body.referenceImages
 */
export const processSourcingImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      req.body.referenceImages = [];
      return next();
    }

    const uploadPromises = req.files.map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: "keplex/sourcing",
        resource_type: "image",
      });

      return {
        url: result.url,
        publicId: result.publicId,
        mimeType: file.mimetype,
        bytes: result.bytes,
        format: result.format,
        width: result.width,
        height: result.height,
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);

    req.body.referenceImages = uploadedImages;

    next();
  } catch (err) {
    next(err);
  }
};


