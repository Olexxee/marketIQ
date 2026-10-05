import prisma from "../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const createOutboxEvent = async (
  { eventType, aggregateType, aggregateId, payload },
  tx,
) => {
  return dbClient(tx).outboxEvent.create({
    data: {
      eventType,
      aggregateType,
      aggregateId,
      payload,
    },
  });
};

export const findPendingOutboxEvents = async (limit = 25) => {
  return prisma.outboxEvent.findMany({
    where: {
      status: "PENDING",
      availableAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });
};

export const markEventProcessing = async (id) => {
  return prisma.outboxEvent.updateMany({
    where: {
      id,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      attempts: {
        increment: 1,
      },
    },
  });
};

export const markEventCompleted = async (id) => {
  return prisma.outboxEvent.update({
    where: { id },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
      lastError: null,
    },
  });
};

export const markEventFailed = async (id, error, retryAt) => {
  return prisma.outboxEvent.update({
    where: { id },
    data: {
      status: "PENDING",
      availableAt: retryAt,
      lastError: error?.message ?? String(error),
    },
  });
};
