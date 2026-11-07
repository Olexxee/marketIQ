import test from "node:test";
import assert from "node:assert/strict";
import { createLogisticsTrackingService } from "./logistics-tracking.service.js";

test("returns a sanitized tracking timeline for the owning buyer", async () => {
  let captured;
  const getTracking = createLogisticsTrackingService({
    repository: {
      findOwnedLogisticsShipmentTracking: async (sellerOrderId, buyerId) => {
        captured = { sellerOrderId, buyerId };
        return {
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
            payload: {
              shipmentReference: "LH-PCL-ABC123",
              status: "IN_TRANSIT",
              recipientPhone: "+2348000000000",
            },
          }],
        };
      },
    },
  });

  const result = await getTracking("buyer-1", "seller-order-1");
  assert.deepEqual(captured, { sellerOrderId: "seller-order-1", buyerId: "buyer-1" });
  assert.equal(result.providerStatus, "IN_TRANSIT");
  assert.equal(result.events[0].sequence, 3);
  assert.equal(result.events[0].shipmentReference, "LH-PCL-ABC123");
  assert.equal("recipientPhone" in result.events[0], false);
});

test("does not reveal shipments not owned by the buyer", async () => {
  const getTracking = createLogisticsTrackingService({
    repository: { findOwnedLogisticsShipmentTracking: async () => null },
  });
  await assert.rejects(
    getTracking("buyer-2", "seller-order-1"),
    error => error.statusCode === 404,
  );
});
