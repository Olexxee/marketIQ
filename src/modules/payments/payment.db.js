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

export const claimOrderPaymentSuccess = async (orderId, tx) => {
  return dbClient(tx).order.updateMany({
    where: {
      id: orderId,
      paymentStatus: { in: ["PENDING", "FAILED", "ABANDONED"] },
      status: { not: "CANCELLED" },
    },
    data: { paymentStatus: "SUCCESS" },
  });
};

export const updatePaymentStatusIfPending = async (id, status, tx, extra = {}) => {
  return dbClient(tx).payment.updateMany({
    where: { id, status: "PENDING" },
    data: { status, ...extra },
  });
};

export const hasPendingPaymentForOrder = async (orderId, tx) => {
  return dbClient(tx).payment.count({ where: { orderId, status: "PENDING" } }) > 0;
};

export const createRefundRecord = async (data, tx) => {
  return dbClient(tx).refund.create({ data });
};

export const findRefundById = async (id, tx) => {
  return dbClient(tx).refund.findUnique({ where: { id } });
};

export const findRefundByProviderReference = async (providerReference, tx) => {
  return dbClient(tx).refund.findFirst({ where: { providerReference } });
};

export const updateRefund = async (id, data, tx) => {
  return dbClient(tx).refund.update({ where: { id }, data });
};

export const updateRefundStatusIfProcessing = async (id, status, data = {}, tx) => {
  return dbClient(tx).refund.updateMany({
    where: { id, status: "PROCESSING" },
    data: { status, ...data },
  });
};

export const listRefunds = async ({ status, skip, take } = {}, tx) => {
  return dbClient(tx).refund.findMany({
    where: status ? { status } : {},
    include: {
      order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true } },
      payment: { select: { id: true, reference: true, providerReference: true, amount: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    ...(skip !== undefined ? { skip } : {}),
    ...(take !== undefined ? { take } : {}),
  });
};

export const getRefundExposureForPayment = async (paymentId, tx) => {
  return dbClient(tx).refund.aggregate({
    where: { paymentId, status: { in: ["REQUESTED", "APPROVED", "PROCESSING", "NEEDS_ATTENTION", "SUCCEEDED"] } },
    _sum: { amount: true },
  });
};

export const updatePaymentStatusIfUnsettled = async (id, status, tx, extra = {}) => {
  return dbClient(tx).payment.updateMany({
    where: { id, status: { in: ["PENDING", "FAILED", "ABANDONED"] } },
    data: { status, ...extra },
  });
};

export const extendOrderPaymentExpiry = async (orderId, expiresAt, tx) => {
  return dbClient(tx).order.updateMany({
    where: { id: orderId, status: { not: "CANCELLED" }, paymentStatus: { in: ["PENDING", "FAILED", "ABANDONED"] } },
    data: { paymentExpiresAt: expiresAt },
  });
};


export const findProcessingRefundsForPayment = async (paymentId, tx) => {
  return dbClient(tx).refund.findMany({
    where: { paymentId, status: "PROCESSING" },
    orderBy: { createdAt: "asc" },
  });
};
