import { randomUUID } from "node:crypto";

import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../classes/errorClasses.js";

import {
  initializeTransaction,
  verifyTransaction,
} from "../../config/paystack.js";

import {
  commitSaleForOrderItem,
  releaseReservationForOrderItem,
} from "../inventory/inventory.ledger.js";

import { recalculateOrderStatus } from "../orders/order.status.service.js";

import {
  createPayment,
  findBuyerEmail,
  findOrderItems,
  findOrderWithPaymentContext,
  findPaymentById,
  findPaymentByReference,
  findPaymentsByOrderId,
  findPendingPaymentForOrder,
  updateManySellerOrderStatusByOrder,
  updateOrderPaymentStatus,
  updatePayment,
  withTransaction,
} from "./payment.db.js";

// ============================================================
// HELPERS
// ============================================================

const generateReference = (orderId) => {
  const shortOrder = String(orderId).slice(-8);
  const random = randomUUID().replace(/-/g, "").slice(0, 10);
  return `MQI-${shortOrder}-${random}`;
};

const lockSort = (items) =>
  [...items].sort((a, b) =>
    String(a.inventoryId || "").localeCompare(String(b.inventoryId || "")),
  );

// ============================================================
// INITIATE
// ============================================================

export const initiatePaymentService = async (userId, orderId, options = {}) => {
  // Phase 1: validate + create payment row (short transaction)
  const prepared = await withTransaction(async (tx) => {
    const order = await findOrderWithPaymentContext(orderId, tx);

    if (!order || order.buyerId !== userId) {
      throw new NotFoundError("Order not found");
    }

    if (order.status === "CANCELLED") {
      throw new ConflictError("Order is cancelled");
    }

    if (order.paymentStatus === "SUCCESS") {
      throw new ConflictError("Order is already paid");
    }

    if (order.paymentStatus === "REVERSED") {
      throw new ConflictError("Order payment was reversed");
    }

    const existing = await findPendingPaymentForOrder(orderId, tx);

    if (existing?.authorizationUrl) {
      return { reuse: true, payment: existing };
    }

    const buyer = await findBuyerEmail(order.buyerId, tx);
    const email = order.customerEmail || buyer?.email;

    if (!email) {
      throw new BadRequestError("Buyer email is required for payment");
    }

    const reference = generateReference(orderId);

    const payment = await createPayment(
      {
        orderId,
        type: "ORDER_PAYMENT",
        provider: "PAYSTACK",
        reference,
        amount: order.total,
        currency: "NGN",
        status: "PENDING",
      },
      tx,
    );

    return {
      reuse: false,
      payment,
      email,
      orderNumber: order.orderNumber,
      total: Number(order.total),
    };
  });

  if (prepared.reuse) {
    const p = prepared.payment;
    return {
      reference: p.reference,
      authorizationUrl: p.authorizationUrl,
      accessCode: p.accessCode,
      amount: Number(p.amount),
      currency: p.currency,
      reused: true,
    };
  }

  // Phase 2: call Paystack outside any DB transaction
  const callbackUrl =
    options.callbackUrl || process.env.PAYSTACK_CALLBACK_URL || undefined;

  const paystack = await initializeTransaction({
    email: prepared.email,
    amountKobo: Math.round(prepared.total * 100),
    reference: prepared.payment.reference,
    callbackUrl,
    metadata: {
      orderId,
      orderNumber: prepared.orderNumber,
      paymentId: prepared.payment.id,
    },
  });

  // Phase 3: persist provider fields (short transaction)
  await withTransaction(async (tx) => {
    await updatePayment(
      prepared.payment.id,
      {
        authorizationUrl: paystack.authorization_url,
        accessCode: paystack.access_code,
        providerReference: paystack.reference,
      },
      tx,
    );
  });

  return {
    reference: prepared.payment.reference,
    authorizationUrl: paystack.authorization_url,
    accessCode: paystack.access_code,
    amount: prepared.total,
    currency: "NGN",
  };
};

// ============================================================
// VERIFY (client-driven, non-authoritative fallback)
// ============================================================

export const verifyPaymentService = async (userId, reference) => {
  const payment = await findPaymentByReference(reference);

  if (!payment) {
    throw new NotFoundError("Payment not found");
  }

  if (payment.orderId) {
    const order = await findOrderWithPaymentContext(payment.orderId);
    if (!order || order.buyerId !== userId) {
      throw new NotFoundError("Payment not found");
    }
  }

  if (
    payment.status === "SUCCESS" ||
    payment.status === "FAILED" ||
    payment.status === "REVERSED"
  ) {
    return payment;
  }

  const remote = await verifyTransaction(reference);

  if (remote.status === "success") {
    await applySuccessfulPayment(payment.id, remote);
  } else if (remote.status === "failed" || remote.status === "abandoned") {
    await applyFailedPayment(payment.id, remote);
  }

  return findPaymentByReference(reference);
};

// ============================================================
// LIST
// ============================================================

export const listPaymentsForOrderService = async (userId, orderId) => {
  const order = await findOrderWithPaymentContext(orderId);

  if (!order || order.buyerId !== userId) {
    throw new NotFoundError("Order not found");
  }

  return findPaymentsByOrderId(orderId);
};

// ============================================================
// WEBHOOK HANDLERS
// ============================================================

export const handleChargeSuccess = async (reference, event) => {
  const payment = await findPaymentByReference(reference);

  if (!payment) {
    return { handled: false, reason: "unknown-reference" };
  }

  if (payment.status === "SUCCESS") {
    return { handled: true, reason: "already-processed" };
  }

  const expectedKobo = Math.round(Number(payment.amount) * 100);
  const receivedKobo = Number(event?.data?.amount ?? 0);

  if (expectedKobo !== receivedKobo) {
    await markPaymentFailed(payment.id, "Amount mismatch");
    return { handled: false, reason: "amount-mismatch" };
  }

  const currency = event?.data?.currency;

  if (currency && currency !== payment.currency) {
    await markPaymentFailed(payment.id, "Currency mismatch");
    return { handled: false, reason: "currency-mismatch" };
  }

  await applySuccessfulPayment(payment.id, event);
  return { handled: true };
};

export const handleChargeFailed = async (reference, event) => {
  const payment = await findPaymentByReference(reference);

  if (!payment) return { handled: false, reason: "unknown-reference" };
  if (payment.status === "SUCCESS")
    return { handled: true, reason: "already-success" };
  if (payment.status === "FAILED")
    return { handled: true, reason: "already-processed" };

  await applyFailedPayment(payment.id, event);
  return { handled: true };
};

// ============================================================
// INTERNAL APPLY
// ============================================================

const applySuccessfulPayment = async (paymentId, rawEvent) => {
  return withTransaction(async (tx) => {
    const payment = await findPaymentById(paymentId, tx);

    if (!payment) return;
    if (payment.status === "SUCCESS") return;

    await updatePayment(
      payment.id,
      {
        status: "SUCCESS",
        providerReference:
          rawEvent?.data?.reference || payment.providerReference,
        providerPayload: rawEvent ?? undefined,
      },
      tx,
    );

    if (!payment.orderId) return;

    await updateOrderPaymentStatus(payment.orderId, "SUCCESS", tx);

    const items = await findOrderItems(payment.orderId, tx);

    for (const item of lockSort(items)) {
      await commitSaleForOrderItem(item, tx);
    }

    await updateManySellerOrderStatusByOrder(payment.orderId, "CONFIRMED", tx);
    await recalculateOrderStatus(payment.orderId, tx);
  });
};

const applyFailedPayment = async (paymentId, rawEvent) => {
  return withTransaction(async (tx) => {
    const payment = await findPaymentById(paymentId, tx);

    if (!payment) return;
    if (payment.status === "SUCCESS") return;

    await updatePayment(
      payment.id,
      {
        status: "FAILED",
        providerPayload: rawEvent ?? undefined,
      },
      tx,
    );

    if (!payment.orderId) return;

    await updateOrderPaymentStatus(payment.orderId, "FAILED", tx);

    const items = await findOrderItems(payment.orderId, tx);

    for (const item of lockSort(items)) {
      await releaseReservationForOrderItem(item, tx);
    }

    await updateManySellerOrderStatusByOrder(payment.orderId, "CANCELLED", tx);
    await recalculateOrderStatus(payment.orderId, tx);
  });
};

const markPaymentFailed = async (paymentId) => {
  return withTransaction(async (tx) => {
    const payment = await findPaymentById(paymentId, tx);
    if (!payment || payment.status === "SUCCESS") return;
    await updatePayment(paymentId, { status: "FAILED" }, tx);
  });
};
