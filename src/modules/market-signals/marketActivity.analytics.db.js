import prisma from "../../config/prisma.js";

/**
 * Only events that reliably carry `productId` / `categoryId` belong here.
 * Order-level events (ORDER_CREATED, ORDER_COMPLETED, PAYMENT_*) are not
 * attributable to a single product and must not be used for demand.
 */

const CART_ADD = "PRODUCT_ADDED_TO_CART";
const RESERVED = "INVENTORY_RESERVED";
const COMMITTED = "INVENTORY_COMMITTED";

export const PRODUCT_DEMAND_ACTIVITY_TYPES = [CART_ADD, RESERVED, COMMITTED];
const GEO_DEMAND_ACTIVITY_TYPES = [CART_ADD, COMMITTED];

// ============================================================
// HELPERS
// ============================================================

const GEO_KEYS = ["countryId", "stateId", "lgaId", "cityId"];

const pickGeoFilter = (scope) =>
  Object.fromEntries(
    GEO_KEYS.filter((key) => scope[key]).map((key) => [key, scope[key]]),
  );

const buildWhere = ({
  productId,
  categoryId,
  windowStart,
  windowEnd,
  activityTypes,
  ...geo
}) => ({
  ...(productId && { productId }),
  ...(categoryId && { categoryId }),
  ...pickGeoFilter(geo),
  createdAt: { gte: windowStart, lt: windowEnd },
  activityType: { in: activityTypes },
});

/**
 * One grouped query returns units and distinct users for every activity type.
 * Rows are (activityType, userId) pairs, so distinct users per type is the
 * number of non-null userIds. Events with no quantity count as 1 unit.
 */
const aggregateActivity = async (where) => {
  const rows = await prisma.marketActivity.groupBy({
    by: ["activityType", "userId"],
    where,
    _sum: { quantity: true },
    _count: { _all: true, quantity: true },
  });

  const totals = new Map();

  for (const row of rows) {
    const entry = totals.get(row.activityType) ?? {
      units: 0,
      users: new Set(),
    };
    const missingQuantity = row._count._all - row._count.quantity;

    entry.units += Number(row._sum.quantity ?? 0) + missingQuantity;
    if (row.userId) entry.users.add(row.userId);

    totals.set(row.activityType, entry);
  }

  return totals;
};

const unitsOf = (totals, type) => totals.get(type)?.units ?? 0;
const usersOf = (totals, type) => totals.get(type)?.users.size ?? 0;

const findDistinctIds = async (
  field,
  { windowStart, windowEnd, activityTypes = PRODUCT_DEMAND_ACTIVITY_TYPES },
) => {
  const rows = await prisma.marketActivity.findMany({
    where: {
      [field]: { not: null },
      createdAt: { gte: windowStart, lt: windowEnd },
      activityType: { in: activityTypes },
    },
    select: { [field]: true },
    distinct: [field],
  });

  return rows.map((row) => row[field]);
};

// ============================================================
// DEMAND (product, category, or any scope with location filters)
// ============================================================

export const getDemandActivity = async (scope) => {
  const { productId, categoryId } = scope;

  if (!productId && !categoryId && !Object.keys(pickGeoFilter(scope)).length) {
    throw new Error("A product, category or location scope is required");
  }

  const totals = await aggregateActivity(
    buildWhere({ ...scope, activityTypes: PRODUCT_DEMAND_ACTIVITY_TYPES }),
  );

  return {
    cartAdds: unitsOf(totals, CART_ADD),
    inventoryReserved: unitsOf(totals, RESERVED),
    inventoryCommitted: unitsOf(totals, COMMITTED),
    uniqueInterestedUsers: usersOf(totals, CART_ADD),
    uniqueBuyers: usersOf(totals, COMMITTED),
  };
};

export const getProductsWithDemandActivity = (window) =>
  findDistinctIds("productId", window);

export const getCategoriesWithDemandActivity = (window) =>
  findDistinctIds("categoryId", window);

// ============================================================
// GEOGRAPHIC
// ============================================================

export const getGeographicDemandActivity = async (scope) => {
  if (!Object.keys(pickGeoFilter(scope)).length) {
    throw new Error(
      "At least one of countryId, stateId, lgaId, cityId is required",
    );
  }

  const where = buildWhere({
    countryId: scope.countryId,
    stateId: scope.stateId,
    lgaId: scope.lgaId,
    cityId: scope.cityId,
    windowStart: scope.windowStart,
    windowEnd: scope.windowEnd,
    activityTypes: GEO_DEMAND_ACTIVITY_TYPES,
  });

  const [totals, categoryRows] = await Promise.all([
    aggregateActivity(where),
    prisma.marketActivity.findMany({
      where: { ...where, categoryId: { not: null } },
      select: { categoryId: true },
      distinct: ["categoryId"],
    }),
  ]);

  return {
    cartAdds: unitsOf(totals, CART_ADD),
    inventoryCommitted: unitsOf(totals, COMMITTED),
    uniqueInterestedUsers: usersOf(totals, CART_ADD),
    uniqueBuyers: usersOf(totals, COMMITTED),
    uniqueCategories: categoryRows.length,
  };
};

/**
 * Locations with demand activity, one per distinct location combination,
 * normalized to the most specific id present.
 */
export const getActiveDemandLocations = async ({ windowStart, windowEnd }) => {
  const rows = await prisma.marketActivity.findMany({
    where: {
      createdAt: { gte: windowStart, lt: windowEnd },
      activityType: { in: GEO_DEMAND_ACTIVITY_TYPES },
      OR: GEO_KEYS.map((key) => ({ [key]: { not: null } })),
    },
    select: { countryId: true, stateId: true, lgaId: true, cityId: true },
    distinct: GEO_KEYS,
  });

  const seen = new Set();
  const locations = [];

  for (const row of rows) {
    const entityId = row.cityId ?? row.lgaId ?? row.stateId ?? row.countryId;

    if (!entityId || seen.has(entityId)) continue;

    seen.add(entityId);
    locations.push({
      entityId,
      countryId: row.countryId ?? null,
      stateId: row.stateId ?? null,
      lgaId: row.lgaId ?? null,
      cityId: row.cityId ?? null,
    });
  }

  return locations;
};

// ============================================================
// SUPPLY (current stock snapshot, not events)
// ============================================================

/**
 * Units available to buy right now for a product or a category:
 * sum(quantity) - sum(reservedQty) over active inventory rows, counting only
 * active variants of active products (the same rule the cart enforces).
 *
 * ASSUMES: Inventory -> variant relation, ProductVariant.productId, and
 * Product.categoryId. Adjust the filter below if your schema differs.
 */
export const getAvailableSupply = async ({ productId, categoryId }) => {
  if (!productId && !categoryId) {
    throw new Error("A product or category is required");
  }

  const { _sum } = await prisma.inventory.aggregate({
    where: {
      isActive: true,
      variant: {
        isActive: true,
        ...(productId && { productId }),
        product: {
          status: "ACTIVE",
          seller: { status: "ACTIVE" },
          ...(categoryId && { categoryId }),
        },
      },
    },
    _sum: { quantity: true, reservedQty: true },
  });

  const total = Number(_sum.quantity ?? 0);
  const reserved = Number(_sum.reservedQty ?? 0);

  return Math.max(0, total - reserved);
};
