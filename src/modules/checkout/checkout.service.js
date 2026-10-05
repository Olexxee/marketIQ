import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../classes/errorClasses.js";
import { recordMarketActivity } from "../market-activity/marketActivity.service.js";
import { reserveInventoryForOrderItem } from "../inventory/inventory.ledger.js";
import {
  createOrder,
  createOrderItem,
  createSellerOrder,
  findAddressByUser,
  findCartWithItems,
  findLocationSnapshot,
  findOrderById,
  lockActiveCartForUser,
  markCartCheckedOut,
  updateOrderItemReservation,
  withTransaction,
} from "./checkout.db.js";

// ============================================================
// HELPERS
// ============================================================

const generateOrderNumber = () => {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MQI-${date}-${random}`;
};

const assertItemIsCheckoutable = (item) => {
  const variant = item.variant;
  const product = variant.product;
  const seller = product.seller;

  if (!variant.isActive) {
    throw new BadRequestError(`Variant "${variant.sku}" is no longer active`);
  }
  if (product.status !== "ACTIVE") {
    throw new BadRequestError(`Product "${product.name}" is no longer available`);
  }
  if (seller.status !== "ACTIVE") {
    throw new BadRequestError(`Seller "${seller.businessName}" is not accepting orders`);
  }
};

const assertCartPriceIsCurrent = (item) => {
  const snapshotPrice = Number(item.unitPriceSnapshot);
  const currentPrice = Number(item.variant.price);

  if (snapshotPrice !== currentPrice) {
    throw new ConflictError(
      `Price changed for "${item.variant.product.name}". Please review your cart before checkout.`
    );
  }
};

const groupItemsBySeller = (items) => {
  const groups = new Map();
  for (const item of items) {
    const seller = item.variant.product.seller;
    if (!groups.has(seller.id)) {
      groups.set(seller.id, { seller, items: [] });
    }
    groups.get(seller.id).items.push(item);
  }
  return Array.from(groups.values());
};

const calculateSellerSubtotal = (items) => {
  return items.reduce(
    (sum, item) => sum + Number(item.unitPriceSnapshot) * item.quantity,
    0
  );
};

const resolveDelivery = async (userId, payload, tx) => {
  if (payload.addressId) {
    const address = await findAddressByUser(payload.addressId, userId, tx);
    if (!address) {
      throw new NotFoundError("Delivery address not found");
    }
    return {
      deliveryAddress: address.addressLine,
      deliveryCountryId: address.countryId,
      deliveryStateId: address.stateId,
      deliveryLgaId: address.lgaId,
      deliveryCityId: address.cityId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone ?? address.phone,
    };
  }

  return {
    deliveryAddress: payload.deliveryAddress,
    deliveryCountryId: payload.deliveryCountryId,
    deliveryStateId: payload.deliveryStateId,
    deliveryLgaId: payload.deliveryLgaId,
    deliveryCityId: payload.deliveryCityId ?? null,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone ?? null,
  };
};

// ============================================================
// ORDER CREATION
// ============================================================

const createMarketplaceOrder = async (userId, delivery, deliverySnapshot, orderSubtotal, payload, tx) => {
  return createOrder(
    {
      orderNumber: generateOrderNumber(),
      buyerId: userId,
      type: "RETAIL",
      customerName: delivery.customerName,
      customerPhone: delivery.customerPhone ?? null,
      deliveryAddress: delivery.deliveryAddress,
      deliveryCountryId: delivery.deliveryCountryId,
      deliveryStateId: delivery.deliveryStateId,
      deliveryLgaId: delivery.deliveryLgaId,
      deliveryCityId: delivery.deliveryCityId,
      deliveryCountryName: deliverySnapshot.countryName,
      deliveryStateName: deliverySnapshot.stateName,
      deliveryLgaName: deliverySnapshot.lgaName,
      deliveryCityName: deliverySnapshot.cityName,
      subtotal: orderSubtotal,
      shippingTotal: 0,
      tax: 0,
      total: orderSubtotal,
      status: "PENDING",
      paymentStatus: "PENDING",
      notes: payload.notes ?? null,
    },
    tx
  );
};

const createSellerMarketplaceOrder = async (orderId, group, subtotal, tx) => {
  const sellerLocationSnapshot =
    group.seller.stateId || group.seller.lgaId
      ? await findLocationSnapshot(
          {
            stateId: group.seller.stateId,
            lgaId: group.seller.lgaId,
          },
          tx
        )
      : { stateName: null, lgaName: null };

  return createSellerOrder(
    {
      orderId,
      sellerId: group.seller.id,
      subtotal,
      shippingTotal: 0,
      total: subtotal,
      status: "PENDING",
      sellerStateId: group.seller.stateId ?? null,
      sellerLgaId: group.seller.lgaId ?? null,
      sellerStateName: sellerLocationSnapshot.stateName ?? null,
      sellerLgaName: sellerLocationSnapshot.lgaName ?? null,
    },
    tx
  );
};

// ============================================================
// ORDER ITEMS
// ============================================================

const createMarketplaceOrderItems = async (order, sellerOrder, group, tx) => {
  const sortedItems = [...group.items].sort((a, b) =>
    a.variantId.localeCompare(b.variantId)
  );

  for (const cartItem of sortedItems) {
    const unitPrice = Number(cartItem.unitPriceSnapshot);
    const lineTotal = unitPrice * cartItem.quantity;

    const orderItem = await createOrderItem(
      {
        orderId: order.id,
        sellerOrderId: sellerOrder.id,
        variantId: cartItem.variantId,
        quantity: cartItem.quantity,
        unitPriceSnapshot: cartItem.unitPriceSnapshot,
        totalPrice: lineTotal,
        productName: cartItem.variant.product.name,
        variantName: cartItem.variant.name,
        sku: cartItem.variant.sku,
        sellerName: group.seller.businessName,
      },
      tx
    );

    // ✅ Delegate to the Inventory Ledger for secure, race-condition-proof reservation
    const { inventoryId, reservedLocationId } = await reserveInventoryForOrderItem(
      {
        orderItemId: orderItem.id,
        variantId: cartItem.variantId,
        sellerId: group.seller.id,
        quantity: cartItem.quantity,
        sku: cartItem.variant.sku,
        orderId: order.id,
      },
      tx
    );

    // Link the reserved inventory back to the order item
    await updateOrderItemReservation(
      orderItem.id,
      { inventoryId, reservedLocationId },
      tx
    );
  }
};

// ============================================================
// MARKET ACTIVITY
// ============================================================

const recordOrderCreatedActivity = async (userId, order, sellerGroups, itemCount, tx) => {
  await recordMarketActivity(
    {
      activityType: "ORDER_CREATED",
      userId,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        subtotal: Number(order.subtotal),
        sellerCount: sellerGroups.length,
        itemCount,
      },
    },
    tx
  );
};

// ============================================================
// MAIN CHECKOUT SERVICE
// ============================================================

export const checkoutService = async (userId, payload) => {
  return withTransaction(async (tx) => {
    // 1. Lock active cart
    const lockedCart = await lockActiveCartForUser(userId, tx);
    if (!lockedCart) {
      throw new NotFoundError("No active cart to check out");
    }

    const cart = await findCartWithItems(lockedCart.id, tx);
    if (!cart || cart.items.length === 0) {
      throw new BadRequestError("Cart is empty");
    }

    // 2. Validate cart items
    for (const item of cart.items) {
      assertItemIsCheckoutable(item);
      assertCartPriceIsCurrent(item);
    }

    // 3. Resolve delivery
    const delivery = await resolveDelivery(userId, payload, tx);
    const deliverySnapshot = await findLocationSnapshot(
      {
        countryId: delivery.deliveryCountryId,
        stateId: delivery.deliveryStateId,
        lgaId: delivery.deliveryLgaId,
        cityId: delivery.deliveryCityId,
      },
      tx
    );

    // 4. Group cart items by seller
    const sellerGroups = groupItemsBySeller(cart.items);

    // 5. Calculate order totals
    let orderSubtotal = 0;
    const sellerTotals = sellerGroups.map((group) => {
      const subtotal = calculateSellerSubtotal(group.items);
      orderSubtotal += subtotal;
      return { sellerId: group.seller.id, subtotal };
    });

    // 6. Create parent order
    const order = await createMarketplaceOrder(
      userId,
      delivery,
      deliverySnapshot,
      orderSubtotal,
      payload,
      tx
    );

    // 7. Create seller orders + order items (which handles inventory reservation)
    for (const group of sellerGroups) {
      const sellerTotal = sellerTotals.find(
        (item) => item.sellerId === group.seller.id
      );

      const sellerOrder = await createSellerMarketplaceOrder(
        order.id,
        group,
        sellerTotal.subtotal,
        tx
      );

      await createMarketplaceOrderItems(order, sellerOrder, group, tx);
    }

    // 8. Record market activity
    await recordOrderCreatedActivity(userId, order, sellerGroups, cart.items.length, tx);

    // 9. Finalize cart
    await markCartCheckedOut(cart.id, tx);

    // 10. Return complete order
    return findOrderById(order.id, tx);
  });
};