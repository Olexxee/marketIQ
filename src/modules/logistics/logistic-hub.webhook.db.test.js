import test from "node:test";
import assert from "node:assert/strict";
import { createLogisticHubWebhookRepository } from "./logistic-hub.webhook.db.js";

function makeRepository() {
  const state = {
    provider: { id: "provider-1" },
    shipment: { id: "shipment-1", trackingReference: "LH-PCL-ABC123", lastEventSequence: null },
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

const makeVerified = (id, sequence, status) => ({
  envelope: {
    id,
    type: "shipment.partner_assigned",
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
  const { repository } = makeRepository();
  const { state } = makeRepository();
  state.shipment = null;
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
  assert.ok(repository);
});
