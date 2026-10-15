import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const CART_ADD = "PRODUCT_ADDED_TO_CART";
const RESERVED = "INVENTORY_RESERVED";
const COMMITTED = "INVENTORY_COMMITTED";

const PRODUCT_DEMAND_ACTIVITY_TYPES = [CART_ADD, RESERVED, COMMITTED];

const GEO_DEMAND_ACTIVITY_TYPES = [CART_ADD, COMMITTED];

const aggregateActivity = async (
  {
    activityTypes,
    productId,
    categoryId,
    countryId,
    stateId,
    lgaId,
    cityId,
    windowStart,
    windowEnd,
  },
  tx,
) => {
  const client = dbClient(tx);

  const rows = await client.commercialActivity.groupBy({
    by: ["activityType", "userId"],
    where: {
      activityType: {
        in: activityTypes,
      },

      ...(productId && { productId }),
      ...(categoryId && { categoryId }),

      ...(countryId && { countryId }),
      ...(stateId && { stateId }),
      ...(lgaId && { lgaId }),
      ...(cityId && { cityId }),

      occurredAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },

    _sum: {
      quantity: true,
    },

    _count: {
      _all: true,
    },
  });

  return rows;
};

const getUnits = (row) => {
  const quantity = Number(row._sum.quantity ?? 0);

  if (quantity > 0) {
    return quantity;
  }

  return Number(row._count?._all ?? 0);
};

const getUniqueUsers = (rows, activityType) => {
  return new Set(
    rows
      .filter((row) => row.activityType === activityType)
      .map((row) => row.userId)
      .filter(Boolean),
  ).size;
};

const getActivityUnits = (rows, activityType) => {
  return rows
    .filter((row) => row.activityType === activityType)
    .reduce((sum, row) => sum + getUnits(row), 0);
};

export const getCommercialDemandActivity = async (
  {
    productId,
    categoryId,
    countryId,
    stateId,
    lgaId,
    cityId,
    windowStart,
    windowEnd,
  },
  tx,
) => {
  const rows = await aggregateActivity(
    {
      activityTypes: PRODUCT_DEMAND_ACTIVITY_TYPES,

      productId,
      categoryId,

      countryId,
      stateId,
      lgaId,
      cityId,

      windowStart,
      windowEnd,
    },
    tx,
  );

  return {
    cartAdds: getActivityUnits(rows, CART_ADD),

    inventoryReserved: getActivityUnits(rows, RESERVED),

    inventoryCommitted: getActivityUnits(rows, COMMITTED),

    uniqueInterestedUsers: getUniqueUsers(rows, CART_ADD),

    uniqueBuyers: getUniqueUsers(rows, COMMITTED),
  };
};

export const getCommercialGeographicDemandActivity = async (
  { countryId, stateId, lgaId, cityId, windowStart, windowEnd },
  tx,
) => {
  const rows = await aggregateActivity(
    {
      activityTypes: GEO_DEMAND_ACTIVITY_TYPES,

      countryId,
      stateId,
      lgaId,
      cityId,

      windowStart,
      windowEnd,
    },
    tx,
  );

  return {
    cartAdds: getActivityUnits(rows, CART_ADD),

    inventoryCommitted: getActivityUnits(rows, COMMITTED),

    uniqueInterestedUsers: getUniqueUsers(rows, CART_ADD),

    uniqueBuyers: getUniqueUsers(rows, COMMITTED),
  };
};

export const getCommercialGeographicUniqueCategories = async (
  { countryId, stateId, lgaId, cityId, windowStart, windowEnd },
  tx,
) => {
  const client = dbClient(tx);

  const rows = await client.commercialActivity.findMany({
    where: {
      activityType: {
        in: GEO_DEMAND_ACTIVITY_TYPES,
      },

      categoryId: {
        not: null,
      },

      ...(countryId && { countryId }),
      ...(stateId && { stateId }),
      ...(lgaId && { lgaId }),
      ...(cityId && { cityId }),

      occurredAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },

    select: {
      categoryId: true,
    },

    distinct: ["categoryId"],
  });

  return rows.length;
};