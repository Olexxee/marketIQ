import prisma from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { createLogisticHubClient, LogisticHubApiError } from "./logistic-hub.client.js";

const EVENT_TYPE = "LOGISTICS_SHIPMENT_RESOLUTION_REQUESTED";
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 12;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000, 900_000, 3_600_000];

const retryDate = attempts => {
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_MS[index]);
};

const setReviewOutcome = async (tx, request, status) => {
  await tx.shipmentReview.updateMany({
    where: { sellerOrderId: request.sellerOrderId },
    data: {
      status,
      ...(status === "CANCELLATION_CONFIRMED" ? { closedAt: new Date() } : {}),
    },
  });
};

const processEvent = async event => {
  const claimed = await prisma.outboxEvent.updateMany({
    where: { id: event.id, eventType: EVENT_TYPE, status: "PENDING", availableAt: { lte: new Date() } },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return;

  const attempt = event.attempts + 1;
  const requestId = event.payload?.shipmentResolutionRequestId;
  await prisma.shipmentResolutionRequest.updateMany({
    where: { id: requestId, status: "COMMAND_PENDING" },
    data: { status: "COMMAND_PROCESSING" },
  });
  try {
    const request = await prisma.shipmentResolutionRequest.findUnique({
      where: { id: requestId },
      include: { shipment: { include: { provider: true } } },
    });
    if (!request) throw Object.assign(new Error("Shipment resolution request was not found."), { retryable: false });
    if (request.status === "STOP_CONFIRMED" || request.status === "RETURN_REQUESTED") {
      await prisma.outboxEvent.update({ where: { id: event.id }, data: { status: "COMPLETED", processedAt: new Date(), lastError: null } });
      return;
    }
    if (request.shipment.status !== "BOOKED" || request.shipment.provider.code !== "LOGISTIC_HUB" || !request.shipment.provider.isActive) {
      throw Object.assign(new Error("The booked Logistic Hub shipment or active provider could not be resolved."), { retryable: true });
    }

    const client = createLogisticHubClient({
      config: { ...env.logisticHub, baseUrl: env.logisticHub.baseUrl || request.shipment.provider.baseUrl },
    });
    const idempotencyKey = `mqi-stop-${request.id}-v1`;
    let response;
    let finalStatus = "STOP_CONFIRMED";
    try {
      response = await client.stopShipment(request.shipment.externalReference, request.reason, idempotencyKey);
    } catch (error) {
      const requiresReturn = error instanceof LogisticHubApiError && [
        "INTEGRATION_SHIPMENT_IN_CUSTODY_USE_RETURN",
        "INTEGRATION_SHIPMENT_STOP_WINDOW_CLOSED",
      ].includes(error.code);
      if (!requiresReturn) throw error;
      response = await client.requestShipmentReturn(
        request.shipment.externalReference,
        request.reason,
        `mqi-return-${request.id}-v1`,
      );
      finalStatus = "RETURN_REQUESTED";
    }

    await prisma.$transaction(async tx => {
      await tx.shipmentResolutionRequest.update({
        where: { id: request.id },
        data: {
          status: finalStatus,
          hubResponse: response,
          physicalReturnConfirmed: false,
          commandAcceptedAt: new Date(),
          resolvedAt: finalStatus === "STOP_CONFIRMED" ? new Date() : null,
        },
      });
      if (finalStatus === "STOP_CONFIRMED") {
        await tx.logisticsShipment.updateMany({
          where: { id: request.shipmentId, status: "BOOKED" },
          data: { status: "CANCELLED", providerStatus: "CANCELLED" },
        });
        await setReviewOutcome(tx, request, "CANCELLATION_CONFIRMED");
      } else {
        await setReviewOutcome(tx, request, "RETURN_REQUESTED");
      }
      await tx.outboxEvent.updateMany({
        where: { id: event.id, status: "PROCESSING" },
        data: { status: "COMPLETED", processedAt: new Date(), lastError: null },
      });
    });
  } catch (error) {
    const retryable = error?.retryable !== false && (
      error?.retryable === true || !(error instanceof LogisticHubApiError) ||
      error.status === 408 || error.status === 429 || error.status >= 500
    );
    const exhausted = retryable && attempt >= MAX_ATTEMPTS;
    const terminal = !retryable || exhausted;
    await prisma.$transaction(async tx => {
      if (terminal && requestId) {
        const request = await tx.shipmentResolutionRequest.findUnique({ where: { id: requestId } });
        if (request) {
          await tx.shipmentResolutionRequest.update({
            where: { id: requestId },
            data: {
              status: exhausted ? "FAILED" : "REJECTED",
              hubResponse: { code: error?.code ?? "SHIPMENT_RESOLUTION_REJECTED", message: String(error?.message ?? error).slice(0, 500) },
              resolvedAt: new Date(),
            },
          });
          await setReviewOutcome(tx, request, exhausted ? "CANCELLATION_COMMAND_FAILED" : "CANCELLATION_REJECTED");
        }
      } else if (requestId) {
        await tx.shipmentResolutionRequest.updateMany({
          where: { id: requestId, status: "COMMAND_PROCESSING" },
          data: { status: "COMMAND_PENDING" },
        });
      }
      await tx.outboxEvent.updateMany({
        where: { id: event.id, status: "PROCESSING" },
        data: {
          status: terminal ? "FAILED" : "PENDING",
          availableAt: terminal ? new Date() : retryDate(attempt),
          lastError: String(error?.message ?? error).slice(0, 1000),
        },
      });
    });
    console.error("[LI-02G-C3] Shipment resolution command failed", {
      eventId: event.id,
      shipmentResolutionRequestId: requestId,
      attempt,
      terminal,
      code: error?.code ?? "SHIPMENT_RESOLUTION_FAILED",
      message: error?.message ?? String(error),
    });
  }
};

const recoverStaleEvents = () => prisma.outboxEvent.updateMany({
  where: {
    eventType: EVENT_TYPE,
    status: "PROCESSING",
    updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
  },
  data: { status: "PENDING", availableAt: new Date(), lastError: "Recovered stale LI-02G-C3 resolution command" },
});

export const processShipmentResolutionWork = async () => {
  await recoverStaleEvents();
  const events = await prisma.outboxEvent.findMany({
    where: { eventType: EVENT_TYPE, status: "PENDING", availableAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });
  for (const event of events) await processEvent(event);
};

export const startShipmentResolutionWorker = ({ pollIntervalMs = env.logisticHub.shipmentWorkerPollMs } = {}) => {
  if (!env.logisticHub.shipmentWorkerEnabled) {
    console.log("[LI-02G-C3] Shipment resolution worker disabled by configuration");
    return () => {};
  }
  let running = false;
  let activeRun = Promise.resolve();
  const run = () => {
    if (running) return activeRun;
    running = true;
    activeRun = (async () => {
      try { await processShipmentResolutionWork(); }
      catch (error) {
        console.error("[LI-02G-C3] Worker cycle failed", {
          code: error?.code ?? "SHIPMENT_RESOLUTION_WORKER_FAILED",
          message: error?.message ?? String(error),
        });
      } finally { running = false; }
    })();
    return activeRun;
  };
  void run();
  const timer = setInterval(() => { void run(); }, pollIntervalMs);
  return async () => { clearInterval(timer); await activeRun; };
};
