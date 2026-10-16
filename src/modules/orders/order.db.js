import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

// ============================================================
// INCLUDES
// ============================================================

const BUYER_LIST_INCLUDE = {
  sellerOrders: {
    select: {
      id: true,
      sellerId: true,
      status: true,
      total: true,
      seller: { select: { id: true, businessName: true } },
      _count: { select: { items: true } },
    },
  },
  payments: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: {
      id: true,
      status: true,
      reference: true,
      amount: true,
      currency: true,
    },
  },
  _count: { select: { sellerOrders: true, items: true } },
};

const BUYER_DETAIL_INCLUDE = {
  buyer: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  sellerOrders: {
    include: {
      seller: {
        select: {
          id: true,
          businessName: true,
          businessPhone: true,
          businessEmail: true,
        },
      },
      items: true,
      fulfillments: {
        select: {
          id: true,
          type: true,
          status: true,
          trackingNumber: true,
          carrier: true,
          trackingUrl: true,
          shippingMethod: true,
          estimatedDelivery: true,
          deliveredAt: true,
        },
      },
    },
  },
  items: true,
  payments: {
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      providerReference: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
    },
  },
};

const SELLER_ORDER_LIST_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      customerName: true,
      customerPhone: true,
      deliveryAddress: true,
      deliveryStateName: true,
      deliveryLgaName: true,
      deliveryCityName: true,
      createdAt: true,
    },
  },
  _count: { select: { items: true, fulfillments: true } },
};

const SELLER_ORDER_DETAIL_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      deliveryAddress: true,
      deliveryCountryName: true,
      deliveryStateName: true,
      deliveryLgaName: true,
      deliveryCityName: true,
      notes: true,
      createdAt: true,
    },
  },
  items: true,
  fulfillments: true,
};

// ============================================================
// BUYER READS
// ============================================================

export const findBuyerOrders = async (
  { buyerId, status, skip, take } = {},
  tx,
) => {
  return dbClient(tx).order.findMany({
    where: { buyerId, ...(status && { status }) },
    include: BUYER_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countBuyerOrders = async ({ buyerId, status } = {}, tx) => {
  return dbClient(tx).order.count({
    where: { buyerId, ...(status && { status }) },
  });
};

export const findBuyerOrderById = async (orderId, buyerId, tx) => {
  return dbClient(tx).order.findFirst({
    where: { id: orderId, buyerId },
    include: BUYER_DETAIL_INCLUDE,
  });
};

// ============================================================
// SELLER READS
// ============================================================

export const findSellerOrders = async (
  { sellerId, status, skip, take } = {},
  tx,
) => {
  return dbClient(tx).sellerOrder.findMany({
    where: { sellerId, ...(status && { status }) },
    include: SELLER_ORDER_LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    ...(skip !== undefined && { skip }),
    ...(take !== undefined && { take }),
  });
};

export const countSellerOrders = async ({ sellerId, status } = {}, tx) => {
  return dbClient(tx).sellerOrder.count({
    where: { sellerId, ...(status && { status }) },
  });
};

export const findSellerOrderById = async (id, sellerId, tx) => {
  return dbClient(tx).sellerOrder.findFirst({
    where: { id, sellerId },
    include: SELLER_ORDER_DETAIL_INCLUDE,
  });
};

// ============================================================
// INTERNAL
// ============================================================

export const findOrderById = async (id, tx) => {
  return dbClient(tx).order.findUnique({ where: { id } });
};

export const findOrderItems = async (orderId, tx) => {
  return dbClient(tx).orderItem.findMany({ where: { orderId } });
};

export const findSellerOrdersByOrderId = async (orderId, tx) => {
  return dbClient(tx).sellerOrder.findMany({
    where: { orderId },
    select: { id: true, sellerId: true, status: true },
  });
};

export const updateSellerOrderStatus = async (id, status, tx) => {
  return dbClient(tx).sellerOrder.update({ where: { id }, data: { status } });
};

export const updateManySellerOrderStatus = async (orderId, status, tx) => {
  return dbClient(tx).sellerOrder.updateMany({
    where: { orderId },
    data: { status },
  });
};

export const updateOrderStatus = async (id, status, tx) => {
  return dbClient(tx).order.update({ where: { id }, data: { status } });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback, { timeout: 15000 });
};

export const completeDeliveredSellerOrders = async (orderId, tx) => {
  return dbClient(tx).sellerOrder.updateMany({
    where: { orderId, status: "DELIVERED" },
    data: { status: "COMPLETED" },
  });
};
