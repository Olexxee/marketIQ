import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../classes/errorClasses.js";
import { recalculateOrderStatus } from "../orders/order.status.service.js";
import { publishEvent } from "../events/event.publisher.js";
import { EVENT_TYPES } from "../events/event.types.js";
import {
  createFulfillment,
  createFulfillmentItems,
  findFulfillmentById,
  findFulfillmentsBySellerOrder,
  findSellerOrderByIdOnly,
  findSellerOrderForFulfillment,
  findWarehouseById,
  updateFulfillment,
  updateSellerOrderStatus,
  withTransaction,
} from "./fulfillment.db.js";

// ============================================================
// STATE MACHINE
// ============================================================

const FULFILLMENT_TRANSITIONS = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

const SELLER_ORDER_STATUS_FROM_FULFILLMENTS = (fulfillments) => {
  const active = fulfillments.filter((f) => f.status !== "CANCELLED");

  if (!active.length) return "CONFIRMED";

  if (active.every((f) => f.status === "DELIVERED")) return "DELIVERED";

  if (active.every((f) => f.status === "SHIPPED" || f.status === "DELIVERED")) {
    return "SHIPPED";
  }

  if (active.some((f) => f.status === "PROCESSING")) return "PROCESSING";

  // All PENDING (or mix of PENDING and cancelled) → CONFIRMED
  return "CONFIRMED";
};

// ============================================================
// HELPERS
// ============================================================

const assertSellerOrderOwned = (sellerOrder, sellerId) => {
  if (!sellerOrder || sellerOrder.sellerId !== sellerId) {
    throw new NotFoundError("Seller order not found");
  }
};

const assertFulfillmentOwned = (fulfillment, sellerId) => {
  if (!fulfillment || fulfillment.sellerOrder.sellerId !== sellerId) {
    throw new NotFoundError("Fulfillment not found");
  }
};

const assertSellerOrderReadyForFulfillment = (sellerOrder) => {
  if (sellerOrder.status === "CANCELLED") {
    throw new ConflictError("Seller order is cancelled");
  }

  if (
    sellerOrder.status === "DELIVERED" ||
    sellerOrder.status === "COMPLETED"
  ) {
    throw new ConflictError("Seller order is already delivered");
  }

  if (!["CONFIRMED", "PROCESSING"].includes(sellerOrder.status)) {
    throw new ConflictError(
      `Seller order cannot be fulfilled in status ${sellerOrder.status}`,
    );
  }

  if (sellerOrder.order.paymentStatus !== "SUCCESS") {
    throw new ConflictError("Order has not been paid");
  }
};

const validateWarehouseOwnership = async (warehouseId, sellerId, tx) => {
  if (!warehouseId) return null;

  const warehouse = await findWarehouseById(warehouseId, tx);

  if (!warehouse) {
    throw new NotFoundError("Warehouse not found");
  }

  if (warehouse.sellerId && warehouse.sellerId !== sellerId) {
    throw new NotFoundError("Warehouse not found");
  }

  return warehouse;
};

const syncSellerOrderStatusFromFulfillments = async (sellerOrderId, tx) => {
  const fulfillments = await findFulfillmentsBySellerOrder(sellerOrderId, tx);
  const nextStatus = SELLER_ORDER_STATUS_FROM_FULFILLMENTS(fulfillments);

  await updateSellerOrderStatus(sellerOrderId, nextStatus, tx);

  return nextStatus;
};

// ============================================================
// CREATE
// ============================================================

export const createFulfillmentService = async (
  sellerId,
  sellerOrderId,
  payload,
) => {
  const {
    type,
    warehouseId,
    shippingMethod,
    estimatedDelivery,
    shippingCost,
    trackingNumber,
    carrier,
    trackingUrl,
  } = payload;

  return withTransaction(async (tx) => {
    const sellerOrder = await findSellerOrderForFulfillment(sellerOrderId, tx);

    assertSellerOrderOwned(sellerOrder, sellerId);
    assertSellerOrderReadyForFulfillment(sellerOrder);

    if (!sellerOrder.items.length) {
      throw new BadRequestError("Seller order has no items to fulfill");
    }

    await validateWarehouseOwnership(warehouseId, sellerId, tx);

    const fulfillment = await createFulfillment(
      {
        sellerOrderId,
        warehouseId: warehouseId ?? null,
        type,
        status: "PENDING",
        shippingMethod: shippingMethod ?? null,
        estimatedDelivery: estimatedDelivery ?? null,
        shippingCost: shippingCost ?? 0,
        trackingNumber: trackingNumber ?? null,
        carrier: carrier ?? null,
        trackingUrl: trackingUrl ?? null,
      },
      tx,
    );

    const itemRows = sellerOrder.items.map((item) => ({
      fulfillmentId: fulfillment.id,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: item.unitPriceSnapshot,
    }));

    await createFulfillmentItems(itemRows, tx);

    await syncSellerOrderStatusFromFulfillments(sellerOrderId, tx);
    await recalculateOrderStatus(sellerOrder.orderId, tx);
        await syncSellerOrderStatusFromFulfillments(sellerOrderId, tx);
        await recalculateOrderStatus(sellerOrder.orderId, tx);

        await publishEvent(
          {
            eventType: EVENT_TYPES.FULFILLMENT_CREATED,
            aggregateType: "FULFILLMENT",
            aggregateId: fulfillment.id,
            payload: {
              fulfillmentId: fulfillment.id,
              sellerOrderId,
              orderId: sellerOrder.orderId,
              trackingNumber: fulfillment.trackingNumber,
              carrier: fulfillment.carrier,
            },
          },
          tx,
        );

        return findFulfillmentById(fulfillment.id, tx);
  });
};

// ============================================================
// READ
// ============================================================

export const listFulfillmentsService = async (sellerId, sellerOrderId) => {
  const sellerOrder = await findSellerOrderByIdOnly(sellerOrderId);

  assertSellerOrderOwned(sellerOrder, sellerId);

  return findFulfillmentsBySellerOrder(sellerOrderId);
};

export const getFulfillmentService = async (sellerId, id) => {
  const fulfillment = await findFulfillmentById(id);

  assertFulfillmentOwned(fulfillment, sellerId);

  return fulfillment;
};

// ============================================================
// UPDATE
// ============================================================

export const updateFulfillmentService = async (sellerId, id, payload) => {
  const {
    status,
    trackingNumber,
    carrier,
    trackingUrl,
    shippingMethod,
    estimatedDelivery,
    shippingCost,
  } = payload;

  return withTransaction(async (tx) => {
    const existing = await findFulfillmentById(id, tx);

    assertFulfillmentOwned(existing, sellerId);

    const data = {};

    if (status !== undefined) {
      const allowed = FULFILLMENT_TRANSITIONS[existing.status] || [];

      if (status !== existing.status && !allowed.includes(status)) {
        throw new ConflictError(
          `Cannot move fulfillment from ${existing.status} to ${status}`,
        );
      }

      if (status === "SHIPPED" && !trackingNumber && !existing.trackingNumber) {
        if (!shippingMethod && !existing.shippingMethod) {
          throw new BadRequestError(
            "trackingNumber or shippingMethod is required when shipping",
          );
        }
      }

      data.status = status;

      if (status === "DELIVERED" && !existing.deliveredAt) {
        data.deliveredAt = new Date();
      }
    }

    if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
    if (carrier !== undefined) data.carrier = carrier;
    if (trackingUrl !== undefined) data.trackingUrl = trackingUrl;
    if (shippingMethod !== undefined) data.shippingMethod = shippingMethod;
    if (estimatedDelivery !== undefined)
      data.estimatedDelivery = estimatedDelivery;
    if (shippingCost !== undefined) data.shippingCost = shippingCost;

    if (!Object.keys(data).length) {
      throw new BadRequestError("No fields to update");
    }

    await updateFulfillment(id, data, tx);

    const sellerOrderId = existing.sellerOrder.id;

    await syncSellerOrderStatusFromFulfillments(sellerOrderId, tx);
    await recalculateOrderStatus(existing.sellerOrder.orderId, tx);

        await syncSellerOrderStatusFromFulfillments(sellerOrderId, tx);
        await recalculateOrderStatus(existing.sellerOrder.orderId, tx);

        // ✅ Publish status change event (Shipped or Delivered)
        if (status === "SHIPPED" || status === "DELIVERED") {
          const eventType =
            status === "SHIPPED"
              ? EVENT_TYPES.FULFILLMENT_SHIPPED
              : EVENT_TYPES.FULFILLMENT_DELIVERED;

          await publishEvent(
            {
              eventType,
              aggregateType: "FULFILLMENT",
              aggregateId: id,
              payload: {
                fulfillmentId: id,
                sellerOrderId,
                orderId: existing.sellerOrder.orderId,
                trackingNumber: data.trackingNumber || existing.trackingNumber,
                deliveredAt: data.deliveredAt || null,
              },
            },
            tx,
          );
        }

        return findFulfillmentById(id, tx);
  });
};
