import { findSellerOrdersByOrderId, updateOrderStatus } from "./order.db.js";

export const deriveOrderStatus = (sellerOrders) => {
  if (!sellerOrders.length) return "PENDING";

  const statuses = sellerOrders.map((so) => so.status);

  if (statuses.every((s) => s === "CANCELLED")) return "CANCELLED";

  const active = statuses.filter((s) => s !== "CANCELLED");
  if (!active.length) return "CANCELLED";

  if (active.every((s) => s === "COMPLETED")) return "COMPLETED";

  if (active.every((s) => s === "DELIVERED" || s === "COMPLETED")) {
    return "DELIVERED";
  }

  if (
    active.every(
      (s) => s === "SHIPPED" || s === "DELIVERED" || s === "COMPLETED",
    )
  ) {
    return "SHIPPED";
  }

  if (active.some((s) => s === "PROCESSING")) return "PROCESSING";

  if (active.every((s) => s !== "PENDING")) return "CONFIRMED";

  return "PENDING";
};

export const recalculateOrderStatus = async (orderId, tx) => {
  const sellerOrders = await findSellerOrdersByOrderId(orderId, tx);
  const nextStatus = deriveOrderStatus(sellerOrders);
  await updateOrderStatus(orderId, nextStatus, tx);
  return nextStatus;
};
