import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const createMarketIntelligence = async (data, tx) => {
  return dbClient(tx).marketIntelligence.create({
    data,
  });
};

export const upsertMarketIntelligence = async (
  { intelligenceType, entityType, entityId, windowStart, windowEnd, data },
  tx,
) => {
  return dbClient(tx).marketIntelligence.upsert({
    where: {
      intelligenceType_entityType_entityId_windowStart_windowEnd: {
        intelligenceType,
        entityType,
        entityId,
        windowStart,
        windowEnd,
      },
    },

    update: data,

    create: {
      intelligenceType,
      entityType,
      entityId,
      windowStart,
      windowEnd,
      ...data,
    },
  });
};

export const findMarketIntelligence = async (
  { intelligenceType, entityType, entityId, severity, windowStart, windowEnd },
  { skip = 0, take = 50 } = {},
) => {
  return prisma.marketIntelligence.findMany({
    where: {
      ...(intelligenceType && {
        intelligenceType,
      }),

      ...(entityType && {
        entityType,
      }),

      ...(entityId && {
        entityId,
      }),

      ...(severity && {
        severity,
      }),

      ...(windowStart || windowEnd
        ? {
            windowStart: {
              ...(windowStart && {
                gte: windowStart,
              }),

              ...(windowEnd && {
                lte: windowEnd,
              }),
            },
          }
        : {}),
    },

    orderBy: [
      {
        severity: "desc",
      },
      {
        confidence: "desc",
      },
      {
        createdAt: "desc",
      },
    ],

    skip,
    take,
  });
};
