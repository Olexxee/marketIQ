import prisma from "../../config/prisma.js";
const dbClient = (tx) => tx || prisma;

// ============================================================
// CART LOCK + FETCH
// ============================================================
export const lockActiveCartForUser = async (userId, tx) => {
  const rows =
    await tx.$queryRaw`SELECT id FROM "Cart" WHERE "userId" = ${userId} AND status = 'ACTIVE' FOR UPDATE`;
  return rows[0] || null;
};

export const findCartWithItems = async (cartId, tx) => {
  return dbClient(tx).cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  seller: {
                    select: {
                      id: true,
                      userId: true,
                      businessName: true,
                      status: true,
                      stateId: true,
                      lgaId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
};

// ============================================================
// ADDRESS
// ============================================================
export const findAddressById = async (id, tx) => {
  return dbClient(tx).address.findUnique({ where: { id } });
};

export const findAddressByUser = async (id, userId, tx) => {
  return dbClient(tx).address.findFirst({ where: { id, userId } });
};

// ============================================================
// LOCATION SNAPSHOT HELPERS
// ============================================================
export const findLocationSnapshot = async (
  { countryId, stateId, lgaId, cityId },
  tx,
) => {
  const [country, state, lga, city] = await Promise.all([
    countryId
      ? dbClient(tx).country.findUnique({
          where: { id: countryId },
          select: { name: true },
        })
      : null,
    stateId
      ? dbClient(tx).state.findUnique({
          where: { id: stateId },
          select: { name: true },
        })
      : null,
    lgaId
      ? dbClient(tx).lga.findUnique({
          where: { id: lgaId },
          select: { name: true },
        })
      : null,
    cityId
      ? dbClient(tx).city.findUnique({
          where: { id: cityId },
          select: { name: true },
        })
      : null,
  ]);

  return {
    countryName: country?.name ?? null,
    stateName: state?.name ?? null,
    lgaName: lga?.name ?? null,
    cityName: city?.name ?? null,
  };
};

// ============================================================
// ORDER CREATION
// ============================================================
export const createOrder = async (data, tx) => {
  return dbClient(tx).order.create({ data });
};

export const createSellerOrder = async (data, tx) => {
  return dbClient(tx).sellerOrder.create({ data });
};

export const createOrderItem = async (data, tx) => {
  return dbClient(tx).orderItem.create({ data });
};

export const updateOrderItemReservation = async (
  id,
  { inventoryId, reservedLocationId },
  tx,
) => {
  return dbClient(tx).orderItem.update({
    where: { id },
    data: { inventoryId, reservedLocationId },
  });
};

// ❌ REMOVED: findFulfillmentLocationForSeller, findInventoryRow, lockInventoryRow,
// updateInventoryReservedQty, and createInventoryMovement.
// These are now strictly handled by inventory.ledger.js

// ============================================================
// CART FINALIZATION
// ============================================================
export const markCartCheckedOut = async (cartId, tx) => {
  return dbClient(tx).cart.update({
    where: { id: cartId },
    data: { status: "CHECKED_OUT" },
  });
};

// ============================================================
// ORDER READ (for response)
// ============================================================
export const findOrderById = async (id, tx) => {
  return dbClient(tx).order.findUnique({
    where: { id },
    include: {
      sellerOrders: {
        include: {
          seller: { select: { id: true, businessName: true, status: true } },
          items: true,
        },
      },
      items: true,
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback, { timeout: 15000 });
};
