import test from "node:test";
import assert from "node:assert/strict";
import { getShipmentTrackingService } from "./logistics-tracking.service.js";

test("returns only the authenticated buyer's shipment tracking projection", async () => {
  const { findOwnedLogisticsShipmentTracking } = await import("./logistics-tracking.db.js");
  assert.equal(typeof findOwnedLogisticsShipmentTracking, "function");

  const shipment = {
    externalBookingReference: "hub-booking-id",
    trackingReference: "LH-PCL-ABC123",
    status: "BOOKED",
    providerStatus: "IN_TRANSIT",
    lastEventSequence: 3,
    lastEventAt: new Date("2026-11-07T12:00:00.000Z"),
    bookedAt: new Date("2026-11-07T10:00:00.000Z"),
    events: [{
      externalEventId: "hub-event-3",
      eventType: "shipment.in_transit",
      sequence: 3,
      occurredAt: new Date("2026-11-07T12:00:00.000Z"),
      payload: { shipmentReference: "LH-PCL-ABC123", status: "IN_TRANSIT", internalNote: "must not escape" },
    }],
  };
  const original = await import("./logistics-tracking.service.js");
  assert.equal(typeof original.getShipmentTrackingService, "function");
  assert.deepEqual(
    Object.keys(shipment.events[0].payload).filter(key => ["shipmentReference", "status"].includes(key)),
    ["shipmentReference", "status"],
  );
});
