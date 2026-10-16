import prisma from "../../config/prisma.js";

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

export const markEventFailed = async (id, error, retryAt, terminal = false) => {
  return prisma.outboxEvent.update({
    where: { id },
    data: {
      status: terminal ? "FAILED" : "PENDING",
      availableAt: retryAt,
      lastError: error?.message ?? String(error),
    },
  });
};


export const recoverStaleProcessingEvents = async (staleMinutes = 15) => {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  return prisma.outboxEvent.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: cutoff } },
    data: {
      status: "PENDING",
      availableAt: new Date(),
      lastError: "Recovered stale processing event after worker interruption",
    },
  });
};
