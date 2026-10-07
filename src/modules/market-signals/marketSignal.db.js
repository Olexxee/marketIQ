import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

const signalWhereUnique = ({
  signalType,
  entityType,
  entityId,
  scopeKey,
  windowStart,
  windowEnd,
}) => ({
  signalType_entityType_entityId_scopeKey_windowStart_windowEnd: {
    signalType,
    entityType,
    entityId,
    scopeKey,
    windowStart,
    windowEnd,
  },
});

export const createMarketSignal = async (data, tx) => {
  return dbClient(tx).marketSignal.create({ data });
};

export const upsertMarketSignal = async (
  { signalType, entityType, entityId, scopeKey, windowStart, windowEnd, data },
  tx,
) => {
  return dbClient(tx).marketSignal.upsert({
    where: signalWhereUnique({
      signalType,
      entityType,
      entityId,
      scopeKey,
      windowStart,
      windowEnd,
    }),
    update: data,
    create: {
      signalType,
      entityType,
      entityId,
      scopeKey,
      windowStart,
      windowEnd,
      ...data,
    },
  });
};

export const findMarketSignalById = async (id, tx) => {
  return dbClient(tx).marketSignal.findUnique({ where: { id } });
};

const buildSignalWhere = ({
  signalType,
  entityType,
  entityId,
  scopeKey,
  countryId,
  stateId,
  lgaId,
  cityId,
  windowStart,
  windowEnd,
} = {}) => {
  const where = {};

  if (signalType) where.signalType = signalType;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (scopeKey) where.scopeKey = scopeKey;

  if (countryId) where.countryId = countryId;
  if (stateId) where.stateId = stateId;
  if (lgaId) where.lgaId = lgaId;
  if (cityId) where.cityId = cityId;

  if (windowStart || windowEnd) {
    where.AND = [];
    if (windowStart) where.AND.push({ windowEnd: { gte: windowStart } });
    if (windowEnd) where.AND.push({ windowStart: { lte: windowEnd } });
  }

  return where;
};

export const findMarketSignals = async (
  filters,
  { skip = 0, take = 50 } = {},
  tx,
) => {
  return dbClient(tx).marketSignal.findMany({
    where: buildSignalWhere(filters),
    orderBy: [{ windowEnd: "desc" }, { score: "desc" }],
    skip,
    take,
  });
};

export const countMarketSignals = async (filters, tx) => {
  return dbClient(tx).marketSignal.count({ where: buildSignalWhere(filters) });
};
