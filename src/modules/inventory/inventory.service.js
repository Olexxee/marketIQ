import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../classes/errorClasses.js";
import {
  countMovementsByInventory,
  countSellerInventory,
  createInventoryMovement,
  findInventoryById,
  findMovementsByInventory,
  findSellerInventory,
  findLocationWithSeller,
  findVariantWithSeller,
  lockInventoryRow,
  updateInventoryRow,
  upsertInventoryRow,
  withTransaction,
} from "./inventory.db.js";

// ============================================================
// HELPERS
// ============================================================

const assertVariantOwnedBySeller = async (sellerId, variantId, tx) => {
  const variant = await findVariantWithSeller(variantId, tx);

  if (!variant || variant.sellerId !== sellerId) {
    throw new NotFoundError("Variant not found");
  }

  return variant;
};

const assertLocationOwnedBySeller = async (sellerId, locationId, tx) => {
  const location = await findLocationWithSeller(locationId, tx);

  if (!location || location.sellerId !== sellerId) {
    throw new NotFoundError("Business location not found");
  }

  return location;
};

const getInventoryForSellerOrThrow = async (sellerId, inventoryId, tx) => {
  const inventory = await findInventoryById(inventoryId, tx);

  if (!inventory || inventory.variant.sellerId !== sellerId) {
    throw new NotFoundError("Inventory not found");
  }

  return inventory;
};

// ============================================================
// STOCK IN
// ============================================================

export const stockInService = async (sellerId, payload) => {
  const { variantId, locationId, quantity, reference, note } = payload;

  if (quantity <= 0) {
    throw new BadRequestError("Quantity must be greater than zero");
  }

  return withTransaction(async (tx) => {
    await assertVariantOwnedBySeller(sellerId, variantId, tx);
    await assertLocationOwnedBySeller(sellerId, locationId, tx);

    const row = await upsertInventoryRow({ variantId, locationId }, tx);

    const locked = await lockInventoryRow(row.id, tx);

    if (!locked) {
      throw new NotFoundError("Inventory not found");
    }

    const nextQuantity = locked.quantity + quantity;

    await updateInventoryRow(
      row.id,
      {
        quantity: nextQuantity,
        version: { increment: 1 },
      },
      tx,
    );

    await createInventoryMovement(
      {
        inventoryId: row.id,
        type: "STOCK_IN",
        quantityDelta: quantity,
        reservedDelta: 0,
        quantityAfter: nextQuantity,
        reservedAfter: locked.reservedQty,
        reference: reference || null,
        note: note || null,
      },
      tx,
    );

    await publishEvent(
      {
        eventType: EVENT_TYPES.INVENTORY_STOCKED_IN,
        aggregateType: "INVENTORY",
        aggregateId: row.id,
        payload: {
          inventoryId: row.id,
          variantId: row.variantId,
          quantityAdded: quantity,
          reference: reference || null,
        },
      },
      tx,
    );

    return findInventoryById(row.id, tx);
  });
};

// ============================================================
// ADJUST
// ============================================================

export const adjustService = async (sellerId, inventoryId, payload) => {
  const { delta, reference, note } = payload;

  if (delta === 0) {
    throw new BadRequestError("Delta must not be zero");
  }

  return withTransaction(async (tx) => {
    await getInventoryForSellerOrThrow(sellerId, inventoryId, tx);

    const locked = await lockInventoryRow(inventoryId, tx);

    if (!locked) {
      throw new NotFoundError("Inventory not found");
    }

    const nextQuantity = locked.quantity + delta;

    if (nextQuantity < 0) {
      throw new ConflictError("Adjustment would reduce quantity below zero");
    }

    if (nextQuantity < locked.reservedQty) {
      throw new ConflictError(
        "Adjustment would reduce quantity below reserved quantity",
      );
    }

    await updateInventoryRow(
      inventoryId,
      {
        quantity: nextQuantity,
        version: { increment: 1 },
      },
      tx,
    );

    await createInventoryMovement(
      {
        inventoryId,
        type: "ADJUSTMENT",
        quantityDelta: delta,
        reservedDelta: 0,
        quantityAfter: nextQuantity,
        reservedAfter: locked.reservedQty,
        reference: reference || null,
        note: note || null,
      },
      tx,
    );

     await publishEvent(
       {
         eventType: EVENT_TYPES.INVENTORY_ADJUSTED,
         aggregateType: "INVENTORY",
         aggregateId: inventoryId,
         payload: {
           inventoryId,
           variantId: locked.variantId,
           quantityDelta: delta,
           reference: reference || null,
         },
       },
       tx,
     );

    return findInventoryById(inventoryId, tx);
  });
};

// ============================================================
// REORDER LEVEL
// ============================================================

export const setReorderLevelService = async (
  sellerId,
  inventoryId,
  reorderLevel,
) => {
  return withTransaction(async (tx) => {
    await getInventoryForSellerOrThrow(sellerId, inventoryId, tx);

    await updateInventoryRow(
      inventoryId,
      { reorderLevel, version: { increment: 1 } },
      tx,
    );

    return findInventoryById(inventoryId, tx);
  });
};

// ============================================================
// READ
// ============================================================

export const listInventoryService = async (sellerId, filters = {}) => {
  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findSellerInventory({
      sellerId,
      variantId: filters.variantId,
      locationId: filters.locationId,
      isActive: filters.isActive,
      skip,
      take,
    }),
    countSellerInventory({
      sellerId,
      variantId: filters.variantId,
      locationId: filters.locationId,
      isActive: filters.isActive,
    }),
  ]);

  return { items, total, page, limit };
};

export const getInventoryService = async (sellerId, inventoryId) => {
  return getInventoryForSellerOrThrow(sellerId, inventoryId);
};

export const listMovementsService = async (
  sellerId,
  inventoryId,
  filters = {},
) => {
  await getInventoryForSellerOrThrow(sellerId, inventoryId);

  const { page, limit, skip, take } = filters.pagination;

  const [items, total] = await Promise.all([
    findMovementsByInventory({ inventoryId, skip, take }),
    countMovementsByInventory(inventoryId),
  ]);

  return { items, total, page, limit };
};
