import test from "node:test";
import assert from "node:assert/strict";
import { createLogisticHubWebhookRepository } from "./logistic-hub.webhook.db.js";

function makeRepository() {
  const state = {
    provider: { id: "provider-1" },
    shipment: { id: "shipment-1", trackingReference: "LH-PCL-ABC123", lastEventSequence: null, status: "BOOKED" },
    resolution: { id: "resolution-1", shipmentId: "shipment-1", sellerOrderId: "seller-order-1", status: "COMMAND_PROCESSING", physicalReturnConfirmed: false },
    review: { sellerOrderId: "seller-order-1", status: "CANCELLATION_REQUESTED" },
    receipts: [],
    events: [],
    nextId: 1,
  };
  const tx = {
    logisticsProvider: {
      findUnique: async () => state.provider,
    },
    logisticsWebhookReceipt: {
      findUnique: async ({ where }) => state.receipts.find(item =>
        item.providerId === where.providerId_externalEventId.providerId &&
        item.externalEventId === where.providerId_externalEventId.externalEventId
      ) ?? null,
      create: async ({ data }) => {
        const row = { id: `receipt-${state.nextId++}`, ...data };
        state.receipts.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = state.receipts.find(item => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    logisticsShipment: {
      findFirst: async () => state.shipment,
      findUnique: async () => ({ lastEventSequence: state.shipment.lastEventSequence }),
      updateMany: async ({ data }) => {
        Object.assign(state.shipment, data);
        return { count: 1 };
      },
    },
    shipmentResolutionRequest: {
      findUnique: async () => state.resolution,
      updateMany: async ({ where, data }) => {
        if (where.id !== state.resolution.id || !where.status.in.includes(state.resolution.status)) return { count: 0 };
        Object.assign(state.resolution, data);
        return { count: 1 };
      },
    },
    shipmentReview: {
      updateMany: async ({ where, data }) => {
        if (where.sellerOrderId !== state.review.sellerOrderId || where.status !== state.review.status) return { count: 0 };
        Object.assign(state.review, data);
        return { count: 1 };
      },
    },
    logisticsEvent: {
      findFirst: async ({ where }) => state.events.find(item =>
        item.shipmentId === where.shipmentId && item.sequence === where.sequence
      ) ?? null,
      create: async ({ data }) => {
        const row = { id: `event-${state.nextId++}`, ...data };
        state.events.push(row);
        return row;
      },
    },
    $queryRaw: async () => [],
  };
  const prismaClient = { $transaction: work => work(tx) };
  return { state, repository: createLogisticHubWebhookRepository({ prismaClient }) };
}

const makeVerified = (id, sequence, status, type = "shipment.partner_assigned") => ({
  envelope: {
    id,
    type,
    schemaVersion: 1,
    occurredAt: "2026-11-07T12:00:00.000Z",
    sequence,
    data: { shipmentReference: "LH-PCL-ABC123", status },
  },
  rawBodySha256: "a".repeat(64),
  signatureTimestamp: 1794052800n,
  signatureVersion: "v1",
});

test("persists a verified receipt and event and advances the shipment projection", async () => {
  const { state, repository } = makeRepository();
  const result = await repository.persistVerifiedEvent(makeVerified("hub-event-2", 2, "DRIVER_ASSIGNED"));

  assert.equal(result.projected, true);
  assert.equal(state.receipts[0].status, "PROCESSED");
  assert.equal(state.receipts[0].signatureVerified, true);
  assert.equal(state.events.length, 1);
  assert.deepEqual(state.events[0].payload, {
    shipmentReference: "LH-PCL-ABC123",
    status: "DRIVER_ASSIGNED",
  });
  assert.equal(state.shipment.providerStatus, "DRIVER_ASSIGNED");
  assert.equal(state.shipment.lastEventSequence, 2);
});

test("deduplicates an event ID and does not regress a newer provider status", async () => {
  const { state, repository } = makeRepository();
  await repository.persistVerifiedEvent(makeVerified("hub-event-2", 2, "DRIVER_ASSIGNED"));
  const duplicate = await repository.persistVerifiedEvent(makeVerified("hub-event-2", 2, "DRIVER_ASSIGNED"));
  const stale = await repository.persistVerifiedEvent(makeVerified("hub-event-1", 1, "AWAITING_PARTNER_ASSIGNMENT"));

  assert.equal(duplicate.duplicate, true);
  assert.equal(stale.stale, true);
  assert.equal(state.events.length, 2);
  assert.equal(state.shipment.providerStatus, "DRIVER_ASSIGNED");
  assert.equal(state.shipment.lastEventSequence, 2);
});

test("records a sequence collision as a failed receipt without overwriting tracking state", async () => {
  const { state, repository } = makeRepository();
  await repository.persistVerifiedEvent(makeVerified("hub-event-2", 2, "DRIVER_ASSIGNED"));
  const collision = await repository.persistVerifiedEvent(makeVerified("different-event", 2, "IN_TRANSIT"));

  assert.equal(collision.sequenceConflict, true);
  assert.equal(state.receipts[1].status, "FAILED");
  assert.equal(state.events.length, 1);
  assert.equal(state.shipment.providerStatus, "DRIVER_ASSIGNED");
});

test("does not acknowledge an event before its shipment booking is locally persisted", async () => {
  const failing = createLogisticHubWebhookRepository({
    prismaClient: {
      $transaction: work => work({
        logisticsProvider: { findUnique: async () => ({ id: "provider-1" }) },
        logisticsWebhookReceipt: { findUnique: async () => null },
        logisticsShipment: { findFirst: async () => null },
      }),
    },
  });
  await assert.rejects(
    failing.persistVerifiedEvent(makeVerified("hub-event-1", 1, "AWAITING_PARTNER_ASSIGNMENT")),
    error => error.statusCode === 503 && error.code === "LOGISTIC_HUB_SHIPMENT_NOT_READY",
  );
});


test("reconciles a newer signed cancellation event into shipment and buyer resolution state", async () => {
  const { state, repository } = makeRepository();
  const result = await repository.persistVerifiedEvent(
    makeVerified("hub-cancelled-3", 3, "CANCELLED", "shipment.cancelled"),
  );
  assert.equal(result.projected, true);
  assert.equal(state.shipment.providerStatus, "CANCELLED");
  assert.equal(state.shipment.status, "CANCELLED");
  assert.equal(state.resolution.status, "STOP_CONFIRMED");
  assert.equal(state.resolution.physicalReturnConfirmed, false);
  assert.equal(state.review.status, "CANCELLATION_CONFIRMED");
  assert.equal(state.review.closedAt.toISOString(), "2026-11-07T12:00:00.000Z");
});

test("reconciles a signed return-request event without claiming physical return", async () => {
  const { state, repository } = makeRepository();
  const result = await repository.persistVerifiedEvent(
    makeVerified("hub-return-3", 3, "IN_TRANSIT", "shipment.return_requested"),
  );
  assert.equal(result.projected, true);
  assert.equal(state.shipment.providerStatus, "IN_TRANSIT");
  assert.equal(state.shipment.status, "BOOKED");
  assert.equal(state.resolution.status, "RETURN_REQUESTED");
  assert.equal(state.resolution.physicalReturnConfirmed, false);
  assert.equal(state.review.status, "RETURN_REQUESTED");
  assert.equal(state.review.returnRequestedAt.toISOString(), "2026-11-07T12:00:00.000Z");
});

test("does not let a stale cancellation event overwrite newer resolution state", async () => {
  const { state, repository } = makeRepository();
  await repository.persistVerifiedEvent(makeVerified("hub-newer-4", 4, "IN_TRANSIT"));
  state.resolution.status = "RETURN_REQUESTED";
  state.review.status = "RETURN_REQUESTED";
  const result = await repository.persistVerifiedEvent(
    makeVerified("hub-old-cancel-3", 3, "CANCELLED", "shipment.cancelled"),
  );
  assert.equal(result.stale, true);
  assert.equal(state.resolution.status, "RETURN_REQUESTED");
  assert.equal(state.shipment.status, "BOOKED");
  assert.equal(state.review.status, "RETURN_REQUESTED");
});
