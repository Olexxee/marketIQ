import { NotFoundError } from "../../classes/errorClasses.js";
import { findOwnedLogisticsShipmentTracking } from "./logistics-tracking.db.js";

export const getShipmentTrackingService = async (buyerId, sellerOrderId) => {
  const shipment = await findOwnedLogisticsShipmentTracking(sellerOrderId, buyerId);
  if (!shipment) throw new NotFoundError("Shipment tracking not found.");

  return {
    bookingReference: shipment.externalBookingReference,
    trackingReference: shipment.trackingReference,
    bookingStatus: shipment.status,
    providerStatus: shipment.providerStatus,
    lastEventSequence: shipment.lastEventSequence,
    lastEventAt: shipment.lastEventAt,
    bookedAt: shipment.bookedAt,
    events: shipment.events.map(event => ({
      id: event.externalEventId,
      type: event.eventType,
      sequence: event.sequence,
      occurredAt: event.occurredAt,
      shipmentReference: event.payload?.shipmentReference ?? shipment.trackingReference,
      status: event.payload?.status ?? null,
    })),
  };
};
