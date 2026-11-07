import { ConflictError, NotFoundError } from "../../classes/errorClasses.js";
import { generateUniqueSku } from "../../lib/sku.js";
import { persistOwnerMedia } from "../media/media.service.js";
import { findProductById } from "../products/product.db.js";
import {
  createVariant,
  deactivateVariant,
  findVariantById,
  findVariantBySkuForSeller,
  findVariantsByProduct,
  updateVariant,
  withTransaction,
} from "./variant.db.js";


// ============================================================
// HELPERS
// ============================================================

const getProductForSellerOrThrow = async (sellerId, productId, tx) => {
  const product = await findProductById(productId, { isPublic: false }, tx);

  if (!product || product.sellerId !== sellerId) {
    throw new NotFoundError("Product not found");
  }

  return product;
};

const getVariantForSellerOrThrow = async (sellerId, id, tx) => {
  const variant = await findVariantById(id, tx);

  if (!variant || variant.sellerId !== sellerId) {
    throw new NotFoundError("Variant not found");
  }

  return variant;
};

const slugPrefix = (slug) => String(slug || "").split("-")[0];

const resolveSku = async (sellerId, product, payload, tx) => {
  if (payload.sku) {
    const existing = await findVariantBySkuForSeller(sellerId, payload.sku, tx);

    if (existing) {
      throw new ConflictError("A variant with this SKU already exists");
    }

    return payload.sku;
  }

  return generateUniqueSku({
    segments: [slugPrefix(product.slug), payload.color, payload.size],
    existsFn: (sku) => findVariantBySkuForSeller(sellerId, sku, tx),
  });
};

const validatePriceRules = (payload) => {
  if (
    payload.compareAtPrice !== undefined &&
    payload.compareAtPrice !== null &&
    Number(payload.compareAtPrice) < Number(payload.price)
  ) {
    throw new ConflictError("compareAtPrice cannot be less than price");
  }
};

const MEASUREMENT_FIELDS = ["weight", "weightUnit", "length", "width", "height", "dimensionUnit"];

const hasMeasurementChanges = payload =>
  MEASUREMENT_FIELDS.some(field => payload[field] !== undefined);

const assertPhysicalMeasurements = payload => {
  if (payload.fulfillmentType === "DIGITAL") return;

  const positive = value => value !== undefined && value !== null &&
    Number.isFinite(Number(value)) && Number(value) > 0;

  if (!positive(payload.weight) || !payload.weightUnit) {
    throw new ConflictError("Physical product options require a positive package weight and an explicit weight unit.");
  }
  if (!positive(payload.length) || !positive(payload.width) || !positive(payload.height) || !payload.dimensionUnit) {
    throw new ConflictError("Physical product options require positive package length, width and height with an explicit dimension unit.");
  }
};

const extractMediaInput = (data) => {
  const { variantImages, ...rest } = data;

  return {
    rest,
    variantImages: Array.isArray(variantImages) ? variantImages : [],
  };
};

// ============================================================
// CREATE
// ============================================================

export const createVariantService = async (sellerId, productId, payload) => {
  const { rest, variantImages } = extractMediaInput(payload);

  validatePriceRules(rest);

  return withTransaction(async (tx) => {
    const product = await getProductForSellerOrThrow(sellerId, productId, tx);

    if (product.status === "ARCHIVED") {
      throw new ConflictError("Cannot add variants to an archived product");
    }

    const sku = await resolveSku(sellerId, product, rest, tx);
    const fulfillmentType = rest.fulfillmentType ?? "LOCAL";
    assertPhysicalMeasurements({ ...rest, fulfillmentType });

    const variant = await createVariant(
      {
        ...rest,
        fulfillmentType,
        ...(fulfillmentType !== "DIGITAL" ? { measurementSource: "SELLER_DECLARED" } : {}),
        sku,
        productId,
        sellerId,
      },
      tx,
    );

    if (variantImages.length) {
      await persistOwnerMedia(
        {
          ownerField: "variantId",
          ownerId: variant.id,
          coverImage: variantImages[0],
          galleryImages: variantImages.slice(1),
          replace: false,
        },
        tx,
      );
    }

    return findVariantById(variant.id, tx);
  });
};

// ============================================================
// READ
// ============================================================

export const listSellerVariantsService = async (sellerId, productId) => {
  await getProductForSellerOrThrow(sellerId, productId);
  return findVariantsByProduct(productId, { includeInactive: true });
};

export const listPublicVariantsService = async (productId) => {
  const product = await findProductById(productId, { isPublic: true });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return findVariantsByProduct(productId, { includeInactive: false });
};

export const getVariantService = async (sellerId, id) => {
  return getVariantForSellerOrThrow(sellerId, id);
};

// ============================================================
// UPDATE
// ============================================================

export const updateVariantService = async (sellerId, id, payload) => {
  const { rest, variantImages } = extractMediaInput(payload);

  return withTransaction(async (tx) => {
    const existing = await getVariantForSellerOrThrow(sellerId, id, tx);

    const nextPrice = rest.price !== undefined ? rest.price : existing.price;
    const nextCompare =
      rest.compareAtPrice !== undefined
        ? rest.compareAtPrice
        : existing.compareAtPrice;

    if (nextCompare !== null && nextCompare !== undefined) {
      validatePriceRules({ price: nextPrice, compareAtPrice: nextCompare });
    }

    if (rest.sku && rest.sku !== existing.sku) {
      const clash = await findVariantBySkuForSeller(sellerId, rest.sku, tx);

      if (clash) {
        throw new ConflictError("A variant with this SKU already exists");
      }
    }

    const nextVariant = { ...existing, ...rest };
    const measurementChanged = hasMeasurementChanges(rest);
    const fulfillmentChanged = rest.fulfillmentType !== undefined &&
      rest.fulfillmentType !== existing.fulfillmentType;
    if (nextVariant.fulfillmentType !== "DIGITAL" && (measurementChanged || fulfillmentChanged)) {
      assertPhysicalMeasurements(nextVariant);
    }

    await updateVariant(id, {
      ...rest,
      ...(measurementChanged && nextVariant.fulfillmentType !== "DIGITAL"
        ? { measurementSource: "SELLER_DECLARED" }
        : {}),
    }, tx);

    if (variantImages.length) {
      await persistOwnerMedia(
        {
          ownerField: "variantId",
          ownerId: id,
          coverImage: variantImages[0],
          galleryImages: variantImages.slice(1),
          replace: true,
        },
        tx,
      );
    }

    return findVariantById(id, tx);
  });
};

// ============================================================
// DELETE (deactivate)
// ============================================================

export const deactivateVariantService = async (sellerId, id) => {
  return withTransaction(async (tx) => {
    await getVariantForSellerOrThrow(sellerId, id, tx);
    await deactivateVariant(id, tx);
    return findVariantById(id, tx);
  });
};
