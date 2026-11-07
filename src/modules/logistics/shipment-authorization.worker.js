import { env } from "../../config/env.js";
import {
  claimShipmentAuthorizationEvent,
  completeShipmentAuthorizationEvent,
  failShipmentAuthorizationEvent,
  findPendingShipmentAuthorizationEvents,
  markLocalLogisticsShipmentFailure,
  recoverStaleShipmentAuthorizationEvents,
} from "./shipment-authorization.db.js";
import { createShipmentAuthorizationProcessor } from "./shipment-authorization.processor.js";
import * as repository from "./shipment-authorization.db.js";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 12;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000, 900_000, 3_600_000];

const retryDate = attempts => {
  const index = Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1);
  return new Date(Date.now() + RETRY_DELAYS_MS[index]);
};

const processor = createShipmentAuthorizationProcessor({
  repository,
  config: env.logisticHub,
});

const processOne = async event => {
  const claimed = await claimShipmentAuthorizationEvent(event.id);
  if (claimed.count !== 1) return;

  const attempt = event.attempts + 1;
  try {
    await processor(event);
    await completeShipmentAuthorizationEvent(event.id);
  } catch (error) {
    const terminal = error?.retryable !== true || attempt >= MAX_ATTEMPTS;
    await markLocalLogisticsShipmentFailure({
      sellerOrderId: event.payload?.sellerOrderId,
      error,
      terminal,
    });
    await failShipmentAuthorizationEvent(
      event.id,
      error,
      terminal ? new Date() : retryDate(attempt),
      terminal,
    );
    console.error("[LI-02E] Shipment authorization failed", {
      eventId: event.id,
      sellerOrderId: event.payload?.sellerOrderId,
      attempt,
      terminal,
      code: error?.code ?? "SHIPMENT_AUTHORIZATION_FAILED",
      message: error?.message ?? String(error),
    });
  }
};

export const processShipmentAuthorizationEvents = async () => {
  await recoverStaleShipmentAuthorizationEvents();
  const events = await findPendingShipmentAuthorizationEvents(BATCH_SIZE);
  for (const event of events) await processOne(event);
};

export const startShipmentAuthorizationWorker = ({
  pollIntervalMs = env.logisticHub.shipmentWorkerPollMs,
} = {}) => {
  if (!env.logisticHub.shipmentWorkerEnabled) {
    console.log("[LI-02E] Shipment authorization worker disabled by configuration");
    return () => {};
  }

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processShipmentAuthorizationEvents();
    } catch (error) {
      console.error("[LI-02E] Worker cycle failed", {
        code: error?.code ?? "WORKER_CYCLE_FAILED",
        message: error?.message ?? String(error),
      });
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(run, pollIntervalMs);
  return () => clearInterval(timer);
};
