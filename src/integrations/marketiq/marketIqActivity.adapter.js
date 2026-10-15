import {
  COMMERCIAL_ACTIVITY_SOURCES,
  COMMERCIAL_ACTIVITY_TYPES,
} from "../../commercial/activity/commercialActivity.types.js";


const EVENT_TO_ACTIVITY = {
  PRODUCT_ADDED_TO_CART: COMMERCIAL_ACTIVITY_TYPES.PRODUCT_ADDED_TO_CART,

  PRODUCT_REMOVED_FROM_CART:
    COMMERCIAL_ACTIVITY_TYPES.PRODUCT_REMOVED_FROM_CART,

  ORDER_CREATED: COMMERCIAL_ACTIVITY_TYPES.ORDER_CREATED,

  ORDER_CANCELLED: COMMERCIAL_ACTIVITY_TYPES.ORDER_CANCELLED,

  ORDER_COMPLETED: COMMERCIAL_ACTIVITY_TYPES.ORDER_COMPLETED,

  PAYMENT_COMPLETED: COMMERCIAL_ACTIVITY_TYPES.PAYMENT_COMPLETED,

  PAYMENT_FAILED: COMMERCIAL_ACTIVITY_TYPES.PAYMENT_FAILED,

  FULFILLMENT_CREATED: COMMERCIAL_ACTIVITY_TYPES.FULFILLMENT_CREATED,

  FULFILLMENT_SHIPPED: COMMERCIAL_ACTIVITY_TYPES.FULFILLMENT_SHIPPED,

  FULFILLMENT_DELIVERED: COMMERCIAL_ACTIVITY_TYPES.FULFILLMENT_DELIVERED,

  INVENTORY_STOCKED_IN: COMMERCIAL_ACTIVITY_TYPES.INVENTORY_STOCKED_IN,

  INVENTORY_ADJUSTED: COMMERCIAL_ACTIVITY_TYPES.INVENTORY_ADJUSTED,

  INVENTORY_RESERVED: COMMERCIAL_ACTIVITY_TYPES.INVENTORY_RESERVED,

  INVENTORY_RELEASED: COMMERCIAL_ACTIVITY_TYPES.INVENTORY_RELEASED,

  INVENTORY_COMMITTED: COMMERCIAL_ACTIVITY_TYPES.INVENTORY_COMMITTED,
};

export const mapMarketIqEventToCommercialActivity = (event) => {
  if (!event) {
    throw new Error("MarketIQ event is required");
  }

  const activityType = EVENT_TO_ACTIVITY[event.eventType];

  if (!activityType) {
    throw new Error(
      `No Commercial Activity mapping for MarketIQ event "${event.eventType}"`,
    );
  }

  const payload = event.payload ?? {};

  return {
    activityType,

    source: {
      integrationId: COMMERCIAL_ACTIVITY_SOURCES.MARKETIQ,
      externalEventId: event.id,
      externalAccountId: null,
    },

    actor: {
      userId: payload.userId ?? null,
    },

    entity: {
      productId: payload.productId ?? null,
      variantId: payload.variantId ?? null,
      sellerId: payload.sellerId ?? null,
      categoryId: payload.categoryId ?? null,
      brandId: payload.brandId ?? null,
      collectionId: payload.collectionId ?? null,
    },

    geography: {
      countryId: payload.countryId ?? null,
      stateId: payload.stateId ?? null,
      lgaId: payload.lgaId ?? null,
      cityId: payload.cityId ?? null,
    },

    quantity: payload.quantity ?? null,

    occurredAt: event.createdAt,

    metadata: {
      aggregateType: event.aggregateType ?? null,
      aggregateId: event.aggregateId ?? null,
      ...payload.metadata,
    },
  };
};
