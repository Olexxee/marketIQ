import cloudinary from "./cloudinery.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Upload buffer to Cloudinary
 * @param {Buffer} buffer - The image buffer to upload
 * @param {Object} options
 * @param {string} options.folder - Cloudinary folder
 * @param {string} [options.publicId] - Optional public ID; auto-generated if not provided
 * @param {string} [options.resourceType="image"] - Resource type (image, video, raw)
 * @returns {Promise<{url, publicId, resourceType, format, bytes, width, height}>}
 */
export const uploadBufferToCloudinary = async (buffer, options = {}) => {
  const { folder, publicId, resourceType = "image" } = options;

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Invalid buffer provided for Cloudinary upload.");
  }

  // NOTE: don't prepend `folder` here — the `folder` option passed to
  // upload_stream below already gets combined with public_id by Cloudinary.
  // Prepending it ourselves as well produced doubled paths.
  const finalPublicId = publicId || uuidv4();

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          public_id: finalPublicId,
          resource_type: resourceType,
          overwrite: false,
        },
        (error, result) => {
          if (error) return reject(error);

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        },
      )
      .end(buffer);
  });
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) {
    throw new Error("Public ID is required to delete Cloudinary file.");
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log("Cloudinary delete result:", result);
    return result;
  } catch (err) {
    console.error("Cloudinary delete failed:", err);
    throw err;
  }
};

/**
 * Delete multiple files from Cloudinary.
 *
 * Uses Promise.allSettled so one failed deletion does not prevent
 * the remaining assets from being cleaned up.
 *
 * @param {Array<{publicId?: string}>} images
 * @returns {Promise<void>}
 */
export const deleteMultipleFromCloudinary = async (images = []) => {
  const assets = images.filter((image) => image?.publicId);

  if (assets.length === 0) return;

  const results = await Promise.allSettled(
    assets.map((image) => deleteFromCloudinary(image.publicId)),
  );

  const failed = results.filter((result) => result.status === "rejected");

  if (failed.length > 0) {
    console.error(
      `Failed to delete ${failed.length} Cloudinary asset(s) during cleanup.`,
      failed.map((result) => result.reason),
    );
  }
};
