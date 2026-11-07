import { NotFoundError } from "../../classes/errorClasses.js";
import { findOwnedLogisticsShipmentTracking } from "./logistics-tracking.db.js";

export const createLogisticsTrackingService = ({ repository } = {}) => {
  if (!repository) throw new Error("A logistics tracking repository is required.");

  return async (buyerId, sellerOrderId) => {
    const shipment = await repository.findOwnedLogisticsShipmentTracking(sellerOrderId, buyerId);
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
};

export const getShipmentTrackingService = createLogisticsTrackingService({
  repository: { findOwnedLogisticsShipmentTracking },
});
