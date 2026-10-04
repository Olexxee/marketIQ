import { BadRequestError } from "../classes/errorClasses.js";

/**
 * Multipart form data arrives as strings. This converts the fields that the
 * rest of the pipeline expects to be typed (objects, booleans, nulls).
 *
 * Design notes:
 *   - Bad JSON for `variants` / `attributes` / `imageIndexes` throws a
 *     BadRequestError here, because those fields are structural and a
 *     malformed value is unrecoverable. Joi would reject it anyway, but the
 *     message would be less clear.
 *   - Bad JSON for `metadata` is swallowed on purpose: leave it as the raw
 *     string and let Joi report `"metadata" must be of type object`. That's
 *     the schema's job, not ours.
 *   - Booleans are coerced only when the value is exactly "true" / "false".
 *     Anything else is left alone so Joi can complain about it.
 *   - `undefined` means "field not present"; `""` for a nullable FK means
 *     "clear it". Those are different, so we don't collapse them.
 */

const coerceBoolean = (value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value; // leave for Joi to reject with a useful message
};

const coerceNullableString = (value) => (value === "" ? null : value);

export const parseProductMultipart = (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return next();
    }

    // ---- Structural JSON fields: must parse cleanly -----------------------
    if (typeof req.body.variants === "string") {
      req.body.variants = JSON.parse(req.body.variants);
    }

    // ---- Free-form JSON fields: parse if possible, otherwise defer --------
    if (typeof req.body.metadata === "string" && req.body.metadata !== "") {
      try {
        req.body.metadata = JSON.parse(req.body.metadata);
      } catch {
        // Leave as string; Joi will report it as "must be of type object".
      }
    }

    // ---- Booleans ---------------------------------------------------------
    for (const key of ["isFeatured", "isNew", "isBestSeller"]) {
      if (typeof req.body[key] === "string") {
        req.body[key] = coerceBoolean(req.body[key]);
      }
    }

    // ---- Nullable foreign keys -------------------------------------------
    for (const key of ["brandId", "collectionId", "categoryId"]) {
      if (typeof req.body[key] === "string") {
        req.body[key] = coerceNullableString(req.body[key]);
      }
    }

    next();
  } catch {
    return next(new BadRequestError("Invalid JSON data in product request"));
  }
};

export const parseCategoryMultipart = (req, res, next) => {
  try {
    if (typeof req.body.isActive === "string") {
      req.body.isActive = coerceBoolean(req.body.isActive);
    }

    if (typeof req.body.sortOrder === "string" && req.body.sortOrder !== "") {
      const parsed = Number(req.body.sortOrder);
      // NaN would silently become "sortOrder: NaN" and confuse the DB layer.
      // Leave it as the raw string so Joi rejects with "must be a number".
      if (!Number.isNaN(parsed)) {
        req.body.sortOrder = parsed;
      }
    }

    if (req.body.parentId === "") {
      req.body.parentId = null;
    }

    next();
  } catch {
    next(new BadRequestError("Invalid category data in request"));
  }
};
// ============================================================================
// VARIANT MULTIPART
// ============================================================================

const VARIANT_NULLABLE_NUMERIC = [
  "compareAtPrice",
  "length",
  "width",
  "height",
];

const coerceNullableNumber = (value) => {
  if (value === "") return null;
  if (typeof value !== "string") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

export const parseVariantMultipart = (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object") return next();

    if (typeof req.body.isActive === "string") {
      req.body.isActive = coerceBoolean(req.body.isActive);
    }

    for (const key of VARIANT_NULLABLE_NUMERIC) {
      if (typeof req.body[key] === "string") {
        req.body[key] = coerceNullableNumber(req.body[key]);
      }
    }

    for (const key of ["attributes", "metadata"]) {
      if (typeof req.body[key] === "string" && req.body[key] !== "") {
        try {
          req.body[key] = JSON.parse(req.body[key]);
        } catch {
          // leave as string; Joi will reject with "must be of type object"
        }
      }
    }

    if (typeof req.body.imageIndexes === "string" && req.body.imageIndexes !== "") {
      try {
        req.body.imageIndexes = JSON.parse(req.body.imageIndexes);
      } catch {
        // leave as string; Joi will reject
      }
    }

    next();
  } catch {
    return next(new BadRequestError("Invalid variant data in request"));
  }
};