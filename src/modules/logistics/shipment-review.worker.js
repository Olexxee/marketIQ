import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { createLogisticHubClient } from "./logistic-hub.client.js";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 12;
const EVENT_TYPE = "LOGISTICS_DISPATCH_RELEASE_REQUESTED";
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000, 900_000, 3_600_000];

const retryDate = attempts => {
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_MS[index]);
};

const initializeExpiredReviewDecisions = async () => {
  const now = new Date();
  const expired = await prisma.shipmentReview.findMany({
    where: { status: "PENDING_BUYER_REVIEW", reviewExpiresAt: { lte: now } },
    orderBy: { reviewExpiresAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, sellerOrderId: true, shipmentId: true, shipment: { select: { externalReference: true } } },
  });
  for (const review of expired) {
    await prisma.$transaction(async tx => {
      const changed = await tx.shipmentReview.updateMany({
        where: { id: review.id, status: "PENDING_BUYER_REVIEW", reviewExpiresAt: { lte: now } },
        data: { status: "AUTO_AUTHORIZED" },
      });
      if (changed.count !== 1) return;
      await tx.outboxEvent.createMany({
        data: [{
          eventType: EVENT_TYPE,
          aggregateType: "SHIPMENT_REVIEW",
          aggregateId: review.id,
          dedupeKey: `li02gb-dispatch-release:${review.id}:timeout`,
          payload: {
            shipmentReviewId: review.id,
            sellerOrderId: review.sellerOrderId,
            externalReference: review.shipment.externalReference,
            reason: "REVIEW_TIMEOUT",
          },
        }],
        skipDuplicates: true,
      });
    });
  }
};

const flagOverdueEvidence = async () => {
  const now = new Date();
  const overdue = await prisma.shipmentReview.findMany({
    where: { status: "WAITING_FOR_EVIDENCE", evidenceDeadlineAt: { lte: now } },
    orderBy: { evidenceDeadlineAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, sellerOrderId: true, shipmentId: true },
  });
  for (const review of overdue) {
    await prisma.$transaction(async tx => {
      const changed = await tx.shipmentReview.updateMany({
        where: { id: review.id, status: "WAITING_FOR_EVIDENCE", evidenceDeadlineAt: { lte: now } },
        data: { status: "EVIDENCE_OVERDUE" },
      });
      if (changed.count !== 1) return;
      await tx.outboxEvent.createMany({
        data: [{
          eventType: "LOGISTICS_PACKING_EVIDENCE_OVERDUE",
          aggregateType: "SHIPMENT_REVIEW",
          aggregateId: review.id,
          dedupeKey: `li02gb-evidence-overdue:${review.id}`,
          payload: { shipmentReviewId: review.id, sellerOrderId: review.sellerOrderId, shipmentId: review.shipmentId },
        }],
        skipDuplicates: true,
      });
    });
  }
};

const processDispatchReleaseEvent = async event => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: { id: event.id, eventType: EVENT_TYPE, status: "PENDING", availableAt: { lte: new Date() } },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return;

  const attempt = event.attempts + 1;
  try {
    const shipment = await prisma.logisticsShipment.findUnique({
      where: { sellerOrderId: event.payload.sellerOrderId },
      include: { provider: true },
    });
    if (!shipment || shipment.provider.code !== "LOGISTIC_HUB" || !shipment.provider.isActive) {
      const error = new Error("The booked Logistic Hub shipment or active provider could not be resolved.");
      error.code = "LOGISTIC_HUB_SHIPMENT_NOT_READY";
      error.retryable = true;
      throw error;
    }
    const client = createLogisticHubClient({
      config: { ...env.logisticHub, baseUrl: env.logisticHub.baseUrl || shipment.provider.baseUrl },
    });
    await client.authorizeShipmentDispatch(
      event.payload.externalReference,
      event.payload.reason,
      `mqi-dispatch-release-${event.payload.shipmentReviewId}-v1`,
    );
    await prisma.$transaction(async tx => {
      await tx.shipmentReview.updateMany({
        where: { id: event.payload.shipmentReviewId, dispatchAuthorizedAt: null },
        data: { dispatchAuthorizedAt: new Date() },
      });
      await tx.outboxEvent.updateMany({
        where: { id: event.id, status: "PROCESSING" },
        data: { status: "COMPLETED", processedAt: new Date(), lastError: null },
      });
    });
  } catch (error) {
    const terminal = attempt >= MAX_ATTEMPTS || error?.retryable === false;
    await prisma.outboxEvent.updateMany({
      where: { id: event.id, status: "PROCESSING" },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        availableAt: terminal ? new Date() : retryDate(attempt),
        lastError: String(error?.message ?? error).slice(0, 1000),
      },
    });
    console.error("[LI-02G-B] Dispatch release failed", {
      eventId: event.id,
      shipmentReviewId: event.payload?.shipmentReviewId,
      attempt,
      terminal,
      code: error?.code ?? "DISPATCH_RELEASE_FAILED",
      message: error?.message ?? String(error),
    });
  }
};

const recoverStaleDispatchReleaseEvents = () =>
  prisma.outboxEvent.updateMany({
    where: {
      eventType: EVENT_TYPE,
      status: "PROCESSING",
      updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
    },
    data: {
      status: "PENDING",
      availableAt: new Date(),
      lastError: "Recovered stale LI-02G-B dispatch-release event after worker interruption",
    },
  });

const processPendingDispatchReleaseEvents = async () => {
  const events = await prisma.outboxEvent.findMany({
    where: { eventType: EVENT_TYPE, status: "PENDING", availableAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });
  for (const event of events) await processDispatchReleaseEvent(event);
};

export const processShipmentReviewWork = async () => {
  await recoverStaleDispatchReleaseEvents();
  await initializeExpiredReviewDecisions();
  await flagOverdueEvidence();
  await processPendingDispatchReleaseEvents();
};

export const startShipmentReviewWorker = ({ pollIntervalMs = env.logisticHub.shipmentWorkerPollMs } = {}) => {
  if (!env.logisticHub.shipmentWorkerEnabled) {
    console.log("[LI-02G-B] Packing review worker disabled by configuration");
    return () => {};
  }
  let running = false;
  let activeRun = Promise.resolve();
  const run = () => {
    if (running) return activeRun;
    running = true;
    activeRun = (async () => {
      try {
        await processShipmentReviewWork();
      } catch (error) {
        console.error("[LI-02G-B] Worker cycle failed", {
          code: error?.code ?? "SHIPMENT_REVIEW_WORKER_FAILED",
          message: error?.message ?? String(error),
        });
      } finally {
        running = false;
      }
    })();
    return activeRun;
  };
  void run();
  const timer = setInterval(() => { void run(); }, pollIntervalMs);
  return async () => {
    clearInterval(timer);
    await activeRun;
  };
};
