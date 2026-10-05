import prisma from "../../config/prisma.js";

const dbClient = (tx) => tx || prisma;

export const findOrderWithPaymentContext = async (orderId, tx) => {
  return dbClient(tx).order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      sellerOrders: { select: { id: true, sellerId: true, status: true } },
    },
  });
};

export const findBuyerEmail = async (userId, tx) => {
  return dbClient(tx).user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
};

export const createPayment = async (data, tx) => {
  return dbClient(tx).payment.create({ data });
};

export const findPaymentById = async (id, tx) => {
  return dbClient(tx).payment.findUnique({ where: { id } });
};

export const findPaymentByReference = async (reference, tx) => {
  return dbClient(tx).payment.findUnique({ where: { reference } });
};

export const findPaymentsByOrderId = async (orderId, tx) => {
  return dbClient(tx).payment.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
};

export const findPendingPaymentForOrder = async (orderId, tx) => {
  return dbClient(tx).payment.findFirst({
    where: { orderId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
};

export const updatePayment = async (id, data, tx) => {
  return dbClient(tx).payment.update({ where: { id }, data });
};

export const updateOrderPaymentStatus = async (orderId, paymentStatus, tx) => {
  return dbClient(tx).order.update({
    where: { id: orderId },
    data: { paymentStatus },
  });
};

export const findOrderItems = async (orderId, tx) => {
  return dbClient(tx).orderItem.findMany({ where: { orderId } });
};

export const updateManySellerOrderStatusByOrder = async (
  orderId,
  status,
  tx,
) => {
  return dbClient(tx).sellerOrder.updateMany({
    where: { orderId },
    data: { status },
  });
};

export const withTransaction = async (callback) => {
  return prisma.$transaction(callback, { timeout: 15000 });
};
