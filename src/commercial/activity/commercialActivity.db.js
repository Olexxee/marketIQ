import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const createCommercialActivity = async (data, tx) => {
  return dbClient(tx).commercialActivity.create({
    data,
  });
};

export const findCommercialActivityBySourceEvent = async (
  { sourceId, externalEventId },
  tx,
) => {
  return dbClient(tx).commercialActivity.findUnique({
    where: {
      sourceId_externalEventId: {
        sourceId,
        externalEventId,
      },
    },
  });
};
