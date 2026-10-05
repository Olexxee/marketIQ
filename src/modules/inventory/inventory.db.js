import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const upsertInventoryRow = async ({ variantId, locationId }, tx) => {
  return dbClient(tx).inventory.upsert({
    where: { variantId_locationId: { variantId, locationId } },
    update: {},
    create: { variantId, locationId, quantity: 0, reservedQty: 0 },
  });
};

export const lockInventoryRow = async (inventoryId, tx) => {
  const rows = await tx.$queryRaw`
    SELECT id, "variantId", "locationId", quantity, "reservedQty", "reorderLevel", version, "isActive"
    FROM "Inventory"
    WHERE id = ${inventoryId}
    FOR UPDATE
  `;

  return rows[0] || null;
};

export const updateInventoryRow = async (id, data, tx) => {
  return dbClient(tx).inventory.update({
    where: { id },
    data,
  });
};

export const createInventoryMovement = async (data, tx) => {
  return dbClient(tx).inventoryMovement.create({ data });
};

export const findInventoryById = async (id, tx) => {
  return dbClient(tx).inventory.findUnique({
    where: { id },
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          productId: true,
          sellerId: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      },
      location: {
        select: { id: true, name: true, addressLine: true },
      },
    },
  });
};

export const findInventoryByVariantAndLocation = async (
  { variantId, locationId },
  tx,
) => {
  return dbClient(tx).inventory.findUnique({
    where: { variantId_locationId: { variantId, locationId } },
  });
};

const buildInventoryWhere = ({
  sellerId,
  variantId,
  locationId,
  isActive,
} = {}) => {
  const where = {
    variant: { sellerId },
  };

  if (variantId) where.variantId = variantId;
  if (locationId) where.locationId = locationId;
  if (typeof isActive === "boolean") where.isActive = isActive;

  return where;
};

export const findSellerInventory = async (
  { sellerId, variantId, locationId, isActive, skip, take } = {},
  tx,
) => {
  return dbClient(tx).inventory.findMany({
    where: buildInventoryWhere({ sellerId, variantId, locationId, isActive }),
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          productId: true,
          sellerId: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      },
      location: {
        select: { id: true, name: true, addressLine: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countSellerInventory = async (
  { sellerId, variantId, locationId, isActive } = {},
  tx,
) => {
  return dbClient(tx).inventory.count({
    where: buildInventoryWhere({ sellerId, variantId, locationId, isActive }),
  });
};

export const findMovementsByInventory = async (
  { inventoryId, skip, take } = {},
  tx,
) => {
  return dbClient(tx).inventoryMovement.findMany({
    where: { inventoryId },
    orderBy: { createdAt: "desc" },
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countMovementsByInventory = async (inventoryId, tx) => {
  return dbClient(tx).inventoryMovement.count({
    where: { inventoryId },
  });
};

// ============================================================
// OWNERSHIP CHECKS
// ============================================================

export const findVariantWithSeller = async (variantId, tx) => {
  return dbClient(tx).productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, sellerId: true, isActive: true },
  });
};

export const findLocationWithSeller = async (locationId, tx) => {
  return dbClient(tx).businessLocation.findUnique({
    where: { id: locationId },
    select: { id: true, sellerId: true, isActive: true },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback);
};
