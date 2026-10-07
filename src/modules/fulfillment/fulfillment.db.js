import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

// ============================================================
// SELLER ORDER LOOKUP
// ============================================================

export const findSellerOrderForFulfillment = async (id, tx) => {
  return dbClient(tx).sellerOrder.findUnique({
    where: { id },
    include: {
      items: true,
      fulfillments: {
        include: { items: true },
        orderBy: { createdAt: "asc" },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          paymentStatus: true,
          status: true,
        },
      },
    },
  });
};

export const findSellerOrderByIdOnly = async (id, tx) => {
  return dbClient(tx).sellerOrder.findUnique({
    where: { id },
    select: {
      id: true,
      sellerId: true,
      status: true,
      orderId: true,
    },
  });
};

// ============================================================
// WAREHOUSE
// ============================================================

export const findWarehouseById = async (id, tx) => {
  return dbClient(tx).warehouse.findUnique({ where: { id } });
};

// ============================================================
// FULFILLMENT
// ============================================================

export const createFulfillment = async (data, tx) => {
  return dbClient(tx).fulfillment.create({ data });
};

export const findFulfillmentById = async (id, tx) => {
  return dbClient(tx).fulfillment.findUnique({
    where: { id },
    include: {
      items: true,
      sellerOrder: {
        select: {
          id: true,
          sellerId: true,
          orderId: true,
          status: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
            },
          },
        },
      },
      warehouse: {
        select: { id: true, name: true, code: true, address: true },
      },
    },
  });
};

export const updateFulfillment = async (id, data, tx) => {
  return dbClient(tx).fulfillment.update({ where: { id }, data });
};

export const findFulfillmentsBySellerOrder = async (sellerOrderId, tx) => {
  return dbClient(tx).fulfillment.findMany({
    where: { sellerOrderId },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
};

// ============================================================
// FULFILLMENT ITEM
// ============================================================

export const createFulfillmentItems = async (rows, tx) => {
  if (!rows.length) return { count: 0 };
  return dbClient(tx).fulfillmentItem.createMany({ data: rows });
};

// ============================================================
// SELLER ORDER STATUS
// ============================================================

export const updateSellerOrderStatus = async (id, status, tx) => {
  return dbClient(tx).sellerOrder.update({
    where: { id },
    data: { status },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback, { timeout: 15000 });
};
