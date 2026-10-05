import { createMarketActivity } from "./marketActivity.db.js";

export const handleOrderCreated = async (event) => {
  const { buyerId, orderId, orderNumber, subtotal, sellerCount, itemCount } =
    event.payload;

  await createMarketActivity({
    activityType: "ORDER_CREATED",

    userId: buyerId,

    metadata: {
      orderId,
      orderNumber,
      subtotal,
      sellerCount,
      itemCount,
    },
  });
};
