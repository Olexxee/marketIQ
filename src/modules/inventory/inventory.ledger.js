import prisma from "../../config/prisma.js";
import { BadRequestError, ConflictError } from "../../classes/errorClasses.js";

const dbClient = (tx) => tx || prisma;

// ============================================================
// INTERNAL
// ============================================================

const findFulfillmentLocationForSeller = async (sellerId, tx) => {
  return dbClient(tx).businessLocation.findFirst({
    where: { sellerId, isActive: true, isFulfillmentLocation: true },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });
};

const findInventoryRow = async ({ variantId, locationId }, tx) => {
  return dbClient(tx).inventory.findUnique({
    where: { variantId_locationId: { variantId, locationId } },
  });
};

const lockInventoryRow = async (inventoryId, tx) => {
  const rows = await tx.$queryRaw`
    SELECT id, "variantId", "locationId", quantity, "reservedQty",
           "reorderLevel", version, "isActive"
    FROM "Inventory"
    WHERE id = ${inventoryId}
    FOR UPDATE
  `;
  return rows[0] || null;
};

const updateInventoryRow = async (inventoryId, data, tx) => {
  return dbClient(tx).inventory.update({ where: { id: inventoryId }, data });
};

const createMovement = async (data, tx) => {
  return dbClient(tx).inventoryMovement.create({ data });
};

// ============================================================
// RESERVE
// ============================================================

export const reserveInventoryForOrderItem = async (
  { orderItemId, variantId, sellerId, quantity, sku, orderId },
  tx,
) => {
  const location = await findFulfillmentLocationForSeller(sellerId, tx);

  if (!location) {
    throw new BadRequestError("Seller has no active fulfillment location");
  }

  const inventory = await findInventoryRow(
    { variantId, locationId: location.id },
    tx,
  );

  if (!inventory || !inventory.isActive) {
    throw new ConflictError(`No inventory available for SKU "${sku}"`);
  }

  const locked = await lockInventoryRow(inventory.id, tx);
  if (!locked) throw new ConflictError("Inventory unavailable");

  const available = locked.quantity - locked.reservedQty;

  if (available < quantity) {
    throw new ConflictError(
      `Insufficient inventory for SKU "${sku}". Available: ${available}, required: ${quantity}`,
    );
  }

  const nextReserved = locked.reservedQty + quantity;

  await updateInventoryRow(
    inventory.id,
    { reservedQty: nextReserved, version: { increment: 1 } },
    tx,
  );

  await createMovement(
    {
      inventoryId: inventory.id,
      type: "RESERVE",
      quantityDelta: 0,
      reservedDelta: quantity,
      quantityAfter: locked.quantity,
      reservedAfter: nextReserved,
      idempotencyKey: `${orderItemId}:reserve`,
      reference: orderId,
    },
    tx,
  );

   await publishEvent(
     {
       eventType: EVENT_TYPES.INVENTORY_RESERVED,
       aggregateType: "INVENTORY",
       aggregateId: inventory.id,
       payload: {
         inventoryId: inventory.id,
         variantId,
         orderId,
         orderItemId,
         quantityReserved: quantity,
       },
     },
     tx,
   );

  return {
    inventoryId: inventory.id,
    reservedLocationId: location.id,
  };
};

// ============================================================
// RELEASE
// ============================================================

export const releaseReservationForOrderItem = async (orderItem, tx) => {
  if (!orderItem.inventoryId) return;

  const locked = await lockInventoryRow(orderItem.inventoryId, tx);
  if (!locked) return;

  const releaseQty = Math.min(orderItem.quantity, locked.reservedQty);
  if (releaseQty <= 0) return;

  const nextReserved = locked.reservedQty - releaseQty;

  await updateInventoryRow(
    orderItem.inventoryId,
    { reservedQty: nextReserved, version: { increment: 1 } },
    tx,
  );

  await createMovement(
    {
      inventoryId: orderItem.inventoryId,
      type: "RELEASE",
      quantityDelta: 0,
      reservedDelta: -releaseQty,
      quantityAfter: locked.quantity,
      reservedAfter: nextReserved,
      idempotencyKey: `${orderItem.id}:release`,
      reference: orderItem.orderId,
    },
    tx,
  );
};

// ============================================================
// COMMIT SALE
// ============================================================

export const commitSaleForOrderItem = async (orderItem, tx) => {
  if (!orderItem.inventoryId) {
    throw new BadRequestError("Order item has no reserved inventory");
  }

  const locked = await lockInventoryRow(orderItem.inventoryId, tx);
  if (!locked) throw new ConflictError("Inventory unavailable");

  if (locked.reservedQty < orderItem.quantity) {
    throw new ConflictError(
      `Reserved quantity insufficient for SKU "${orderItem.sku}"`,
    );
  }

  if (locked.quantity < orderItem.quantity) {
    throw new ConflictError(
      `Physical quantity insufficient for SKU "${orderItem.sku}"`,
    );
  }

  const nextQuantity = locked.quantity - orderItem.quantity;
  const nextReserved = locked.reservedQty - orderItem.quantity;

  await updateInventoryRow(
    orderItem.inventoryId,
    {
      quantity: nextQuantity,
      reservedQty: nextReserved,
      version: { increment: 1 },
    },
    tx,
  );

  await createMovement(
    {
      inventoryId: orderItem.inventoryId,
      type: "SALE",
      quantityDelta: -orderItem.quantity,
      reservedDelta: -orderItem.quantity,
      quantityAfter: nextQuantity,
      reservedAfter: nextReserved,
      idempotencyKey: `${orderItem.id}:commit`,
      reference: orderItem.orderId,
    },
    tx,
  );

  await publishEvent(
    {
      eventType: EVENT_TYPES.INVENTORY_COMMITTED,
      aggregateType: "INVENTORY",
      aggregateId: orderItem.inventoryId,
      payload: {
        inventoryId: orderItem.inventoryId,
        variantId: locked.variantId,
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
        quantityCommitted: orderItem.quantity,
      },
    },
    tx,
  );
};
