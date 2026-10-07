import { createMarketActivity } from "./marketActivity.db.js";

const EVENT_TO_ACTIVITY = {
  PRODUCT_ADDED_TO_CART: "PRODUCT_ADDED_TO_CART",
  PRODUCT_REMOVED_FROM_CART: "PRODUCT_REMOVED_FROM_CART",

  ORDER_CREATED: "ORDER_CREATED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_COMPLETED: "ORDER_COMPLETED",

  PAYMENT_COMPLETED: "PAYMENT_COMPLETED",
  PAYMENT_FAILED: "PAYMENT_FAILED",

  FULFILLMENT_CREATED: "FULFILLMENT_CREATED",
  FULFILLMENT_SHIPPED: "FULFILLMENT_SHIPPED",
  FULFILLMENT_DELIVERED: "FULFILLMENT_DELIVERED",

  INVENTORY_STOCKED_IN: "INVENTORY_STOCKED_IN",
  INVENTORY_ADJUSTED: "INVENTORY_ADJUSTED",
  INVENTORY_RESERVED: "INVENTORY_RESERVED",
  INVENTORY_RELEASED: "INVENTORY_RELEASED",
  INVENTORY_COMMITTED: "INVENTORY_COMMITTED",
};

export const handleMarketActivityEvent = async (event) => {
  const activityType = EVENT_TO_ACTIVITY[event.eventType];

  if (!activityType) {
    throw new Error(
      `No Market Activity mapping for event "${event.eventType}"`,
    );
  }

  const payload = event.payload ?? {};

  await createMarketActivity({
    activityType,

    userId: payload.userId ?? null,

    productId: payload.productId ?? null,
    variantId: payload.variantId ?? null,

    sellerId: payload.sellerId ?? null,

    categoryId: payload.categoryId ?? null,
    brandId: payload.brandId ?? null,
    collectionId: payload.collectionId ?? null,

    countryId: payload.countryId ?? null,
    stateId: payload.stateId ?? null,
    lgaId: payload.lgaId ?? null,
    cityId: payload.cityId ?? null,

    quantity: payload.quantity ?? null,

    metadata: {
      eventId: event.id,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,

      ...payload.metadata,
    },
  });
};
