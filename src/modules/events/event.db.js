import prisma from "../../config/prisma.js";
import { EVENT_TYPES } from "./event.types.js";

const dbClient = (tx) => tx || prisma;

export const createOutboxEvent = async (
  { eventType, aggregateType, aggregateId, payload, dedupeKey = null },
  tx,
) => {
  return dbClient(tx).outboxEvent.create({
    data: {
      eventType,
      aggregateType,
      aggregateId,
      payload,
      dedupeKey,
    },
  });
};

export const findPendingOutboxEvents = async (limit = 25) => {
  return prisma.outboxEvent.findMany({
    where: {
      // Dedicated LI-02E and LI-02G-C3 workers own their logistics command events.
      eventType: { notIn: [EVENT_TYPES.LOGISTICS_SHIPMENT_AUTHORIZATION_REQUESTED, "LOGISTICS_SHIPMENT_RESOLUTION_REQUESTED"] },
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
