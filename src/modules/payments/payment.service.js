import { randomUUID } from "node:crypto";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../classes/errorClasses.js";
import {
  initializeTransaction,
  initiateRefund,
  retryRefundWithCustomerDetails,
  verifyTransaction,
} from "../../config/paystack.js";
import {
  commitSaleForOrderItem,
  releaseReservationForOrderItem,
} from "../inventory/inventory.ledger.js";
import { publishEvent } from "../events/event.publisher.js";
import { EVENT_TYPES } from "../events/event.types.js";
import { recordPaymentCaptureLedger, recordRefundLedger } from "./payment.ledger.js";
import { calculatePaymentExpiresAt } from "../orders/order.payment-policy.js";
import {
  createPayment,
  createRefundRecord,
  findRefundById,
  findRefundByProviderReference,
  findProcessingRefundsForPayment,
  getRefundExposureForPayment,
  listRefunds,
  updateRefund,
  updateRefundStatusIfProcessing,
  claimOrderPaymentSuccess,
  hasPendingPaymentForOrder,
  updatePaymentStatusIfPending,
  updatePaymentStatusIfUnsettled,
  extendOrderPaymentExpiry,
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
    if (order.paymentExpiresAt && order.paymentExpiresAt <= new Date()) {
      throw new ConflictError("Order payment window has expired; create a new order");
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

    await extendOrderPaymentExpiry(orderId, calculatePaymentExpiresAt(), tx);

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

  if (payment.status === "SUCCESS" || payment.status === "REVERSED") {
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

  if (payment.status === "SUCCESS" || payment.status === "REVERSED") {
    return { handled: true, reason: "already-processed" };
  }

  const expectedKobo = Math.round(Number(payment.amount) * 100);
  const receivedKobo = Number(event?.data?.amount ?? 0);

  if (expectedKobo !== receivedKobo) {
    await markPaymentFailed(payment.id, "Paystack charge amount did not match the expected order payment amount");
    return { handled: false, reason: "amount-mismatch" };
  }

  const currency = event?.data?.currency;

  if (currency && currency !== payment.currency) {
    await markPaymentFailed(payment.id, "Paystack charge currency did not match the expected payment currency");
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
    if (!payment || payment.status === "SUCCESS") return;

    const updated = await updatePaymentStatusIfUnsettled(
      payment.id,
      "SUCCESS",
      tx,
      {
        providerReference: rawEvent?.data?.reference || payment.providerReference,
        providerPayload: rawEvent ?? undefined,
      },
    );
    if (updated.count !== 1) return;

    if (!payment.orderId) {
      await recordPaymentCaptureLedger({ payment, orderId: null, refundLiability: true }, tx);
      return;
    }

    const claimedOrder = await claimOrderPaymentSuccess(payment.orderId, tx);
    if (claimedOrder.count !== 1) {
      const order = await tx.order.findUnique({
        where: { id: payment.orderId },
        select: { id: true, status: true },
      });
      const reason = order?.status === "CANCELLED"
        ? "Late successful payment for cancelled order"
        : "Duplicate successful payment requiring refund";
      const refund = await createRefundRecord({
        orderId: payment.orderId,
        paymentId: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        reason,
        status: "REQUESTED",
        idempotencyKey: `late-charge:${payment.id}`,
      }, tx);
      await recordPaymentCaptureLedger({ payment, orderId: payment.orderId, refundLiability: true }, tx);
      await tx.auditLog.create({
        data: {
          action: "PAYMENT_CAPTURE_REQUIRES_REFUND",
          resource: "Payment",
          resourceId: payment.id,
          metadata: { orderId: payment.orderId, refundId: refund.id, reason },
        },
      });
      await publishEvent({
        eventType: EVENT_TYPES.REFUND_REQUESTED,
        aggregateType: "REFUND",
        aggregateId: refund.id,
        payload: { refundId: refund.id, orderId: payment.orderId, paymentId: payment.id, reason },
      }, tx);
      return;
    }

    await recordPaymentCaptureLedger({ payment, orderId: payment.orderId }, tx);
    await tx.auditLog.create({
      data: {
        action: "PAYMENT_CAPTURED",
        resource: "Payment",
        resourceId: payment.id,
        metadata: { orderId: payment.orderId, amount: Number(payment.amount), currency: payment.currency, reference: payment.reference },
      },
    });

    const items = await findOrderItems(payment.orderId, tx);
    for (const item of lockSort(items)) {
      await commitSaleForOrderItem(item, tx);
    }

    await updateManySellerOrderStatusByOrder(payment.orderId, "CONFIRMED", tx);
    await recalculateOrderStatus(payment.orderId, tx);

    await publishEvent({
      eventType: EVENT_TYPES.PAYMENT_COMPLETED,
      aggregateType: "PAYMENT",
      aggregateId: payment.id,
      payload: {
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: Number(payment.amount),
        currency: payment.currency,
        provider: payment.provider,
        reference: payment.reference,
      },
    }, tx);
  });
};

const applyFailedPayment = async (paymentId, rawEvent) => {
  return withTransaction(async (tx) => {
    const payment = await findPaymentById(paymentId, tx);
    if (!payment || payment.status === "SUCCESS") return;

    const updated = await updatePaymentStatusIfPending(
      payment.id,
      "FAILED",
      tx,
      { providerPayload: rawEvent ?? undefined },
    );
    if (updated.count !== 1) return;

    await tx.auditLog.create({
      data: {
        action: "PAYMENT_ATTEMPT_FAILED",
        resource: "Payment",
        resourceId: payment.id,
        metadata: { orderId: payment.orderId, reference: payment.reference, reason: rawEvent?.data?.gateway_response || "Payment failed" },
      },
    });

    if (payment.orderId) {
      const anotherPendingPayment = await hasPendingPaymentForOrder(payment.orderId, tx);
      if (!anotherPendingPayment) {
        await tx.order.updateMany({
          where: {
            id: payment.orderId,
            paymentStatus: { in: ["PENDING", "FAILED", "ABANDONED"] },
            status: { not: "CANCELLED" },
          },
          data: { paymentStatus: "FAILED" },
        });
      }

      // A failed attempt is not proof the buyer abandoned the order. Keep its
      // reservations and seller orders intact so another payment attempt can succeed.
    }

    await publishEvent({
      eventType: EVENT_TYPES.PAYMENT_FAILED,
      aggregateType: "PAYMENT",
      aggregateId: payment.id,
      payload: {
        paymentId: payment.id,
        orderId: payment.orderId,
        reference: payment.reference,
        reason: rawEvent?.data?.gateway_response || "Payment failed",
      },
    }, tx);
  });
};

const markPaymentFailed = async (paymentId, reason = "Payment verification mismatch") => {
  return withTransaction(async (tx) => {
    const payment = await findPaymentById(paymentId, tx);
    if (!payment || payment.status === "SUCCESS" || payment.status === "REVERSED") return;
    const changed = await updatePaymentStatusIfPending(paymentId, "FAILED", tx, {
      providerPayload: { reconciliationRequired: true, reason },
    });
    if (changed.count !== 1) return;
    await tx.auditLog.create({
      data: {
        action: "PAYMENT_RECONCILIATION_REQUIRED",
        resource: "Payment",
        resourceId: paymentId,
        metadata: { orderId: payment.orderId, reference: payment.reference, reason },
      },
    });
    await publishEvent({
      eventType: EVENT_TYPES.PAYMENT_RECONCILIATION_REQUIRED,
      aggregateType: "PAYMENT",
      aggregateId: paymentId,
      payload: { paymentId, orderId: payment.orderId, reference: payment.reference, reason },
    }, tx);
  });
};


// ============================================================
// REFUNDS (admin-controlled; provider calls never run inside DB transactions)
// ============================================================

export const requestRefundService = async (actorId, {
  orderId,
  paymentId,
  amount,
  reason,
  idempotencyKey,
}) => {
  return withTransaction(async (tx) => {
    const existing = await tx.refund.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (
        existing.orderId !== orderId ||
        (paymentId && existing.paymentId !== paymentId) ||
        (amount !== undefined && amount !== null && Number(existing.amount) !== Number(amount))
      ) {
        throw new ConflictError("Idempotency key was already used for a different refund request");
      }
      return existing;
    }

    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order not found");

    const payment = paymentId
      ? await tx.payment.findFirst({ where: { id: paymentId, orderId, status: "SUCCESS" } })
      : await tx.payment.findFirst({
          where: { orderId, status: "SUCCESS" },
          orderBy: { createdAt: "desc" },
        });
    if (!payment) throw new ConflictError("No successful payment is available to refund");

    // Serialize refundable-balance checks for this payment to prevent concurrent over-refunds.
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;
    const exposure = await getRefundExposureForPayment(payment.id, tx);
    const reserved = Number(exposure._sum.amount ?? 0);
    const available = Math.max(0, Number(payment.amount) - reserved);
    const refundAmount = amount === undefined || amount === null ? available : Number(amount);

    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      throw new BadRequestError("Refund amount must be greater than zero");
    }
    if (refundAmount > available + 0.000001) {
      throw new ConflictError("Refund amount exceeds the remaining refundable balance");
    }

    const refund = await createRefundRecord({
      orderId,
      paymentId: payment.id,
      requestedById: actorId,
      amount: refundAmount,
      currency: payment.currency,
      reason,
      status: "REQUESTED",
      idempotencyKey,
    }, tx);

    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "REFUND_REQUESTED",
        resource: "Refund",
        resourceId: refund.id,
        metadata: { orderId, paymentId: payment.id, amount: refundAmount, currency: payment.currency },
      },
    });
    await publishEvent({
      eventType: EVENT_TYPES.REFUND_REQUESTED,
      aggregateType: "REFUND",
      aggregateId: refund.id,
      payload: { refundId: refund.id, orderId, paymentId: payment.id, amount: refundAmount, currency: payment.currency },
    }, tx);
    return refund;
  });
};

export const listRefundsService = async ({ status, page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    listRefunds({ status, skip, take: limit }),
    prisma.refund.count({ where: status ? { status } : {} }),
  ]);
  return { items, total, page, limit };
};

const finalizeRefundSuccess = async (refundId, rawEvent) => {
  return withTransaction(async (tx) => {
    const before = await findRefundById(refundId, tx);
    if (!before || before.status === "SUCCEEDED") return before;

    const updated = await updateRefundStatusIfProcessing(refundId, "SUCCEEDED", {
      processedAt: new Date(),
      failureReason: null,
      ...(rawEvent ? { providerPayload: rawEvent } : {}),
    }, tx);
    if (updated.count !== 1) return findRefundById(refundId, tx);

    const refund = await findRefundById(refundId, tx);
    await recordRefundLedger(refund, tx);

    const payment = await findPaymentById(refund.paymentId, tx);
    const paymentRefunds = await tx.refund.aggregate({
      where: { paymentId: refund.paymentId, status: "SUCCEEDED" },
      _sum: { amount: true },
    });
    if (payment && Number(paymentRefunds._sum.amount ?? 0) >= Number(payment.amount)) {
      await tx.payment.updateMany({
        where: { id: payment.id, status: "SUCCESS" },
        data: { status: "REVERSED" },
      });
    }

    const grossPayments = await tx.payment.aggregate({
      where: { orderId: refund.orderId, status: { in: ["SUCCESS", "REVERSED"] } },
      _sum: { amount: true },
    });
    const allRefunds = await tx.refund.aggregate({
      where: { orderId: refund.orderId, status: "SUCCEEDED" },
      _sum: { amount: true },
    });
    const netPaid = Number(grossPayments._sum.amount ?? 0) - Number(allRefunds._sum.amount ?? 0);
    await tx.order.updateMany({
      where: { id: refund.orderId },
      data: { paymentStatus: netPaid <= 0.000001 ? "REVERSED" : "SUCCESS" },
    });

    const dispute = await tx.dispute.findFirst({
      where: {
        orderId: refund.orderId,
        status: "UNDER_REVIEW",
        resolution: { in: ["REFUND_FULL", "REFUND_PARTIAL"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (dispute) {
      await tx.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "RESOLVED",
          resolvedById: refund.reviewedById ?? dispute.assignedToId,
          resolvedAt: new Date(),
        },
      });
      await tx.order.updateMany({
        where: { id: refund.orderId, status: "DELIVERED" },
        data: { disputedAt: null, disputeNotes: null, completionDueAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: refund.reviewedById ?? undefined,
          action: "DISPUTE_RESOLVED_BY_REFUND",
          resource: "Dispute",
          resourceId: dispute.id,
          metadata: { refundId: refund.id, orderId: refund.orderId, resolution: dispute.resolution },
        },
      });
      await publishEvent({
        eventType: EVENT_TYPES.DISPUTE_RESOLVED,
        aggregateType: "DISPUTE",
        aggregateId: dispute.id,
        payload: { disputeId: dispute.id, orderId: refund.orderId, resolution: dispute.resolution, refundId: refund.id },
      }, tx);
    }

    await tx.auditLog.create({
      data: {
        userId: refund.reviewedById ?? undefined,
        action: "REFUND_PROCESSED",
        resource: "Refund",
        resourceId: refund.id,
        metadata: { orderId: refund.orderId, paymentId: refund.paymentId, amount: Number(refund.amount), providerReference: refund.providerReference },
      },
    });
    await publishEvent({
      eventType: EVENT_TYPES.REFUND_PROCESSED,
      aggregateType: "REFUND",
      aggregateId: refund.id,
      payload: { refundId: refund.id, orderId: refund.orderId, paymentId: refund.paymentId, amount: Number(refund.amount), currency: refund.currency },
    }, tx);
    return refund;
  });
};

const finalizeRefundFailure = async (refundId, rawEvent, reason) => {
  return withTransaction(async (tx) => {
    const refund = await findRefundById(refundId, tx);
    if (!refund || refund.status === "SUCCEEDED" || refund.status === "FAILED") return refund;
    const changed = await updateRefundStatusIfProcessing(refundId, "FAILED", {
      failureReason: reason || rawEvent?.message || "Provider reported refund failure",
      ...(rawEvent ? { providerPayload: rawEvent } : {}),
    }, tx);
    if (changed.count !== 1) return findRefundById(refundId, tx);
    await tx.auditLog.create({
      data: {
        userId: refund.reviewedById ?? undefined,
        action: "REFUND_FAILED",
        resource: "Refund",
        resourceId: refund.id,
        metadata: { orderId: refund.orderId, paymentId: refund.paymentId, reason: reason || rawEvent?.message || "Provider reported refund failure" },
      },
    });
    await publishEvent({
      eventType: EVENT_TYPES.REFUND_FAILED,
      aggregateType: "REFUND",
      aggregateId: refund.id,
      payload: { refundId: refund.id, orderId: refund.orderId, paymentId: refund.paymentId, reason: reason || "Provider reported refund failure" },
    }, tx);
    return findRefundById(refund.id, tx);
  });
};

export const processRefundService = async (actorId, refundId) => {
  const prepared = await withTransaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: refundId },
      include: { payment: true },
    });
    if (!refund) throw new NotFoundError("Refund not found");
    if (refund.status === "SUCCEEDED") return { alreadyProcessed: true, refund };
    if (!["REQUESTED", "FAILED"].includes(refund.status)) {
      throw new ConflictError(`Refund cannot be processed in status ${refund.status}`);
    }
    const changed = await tx.refund.updateMany({
      where: { id: refund.id, status: refund.status },
      data: { status: "PROCESSING", reviewedById: actorId, reviewedAt: new Date(), failureReason: null },
    });
    if (changed.count !== 1) throw new ConflictError("Refund status changed before processing");
    await tx.auditLog.create({
      data: { userId: actorId, action: "REFUND_PROCESSING_STARTED", resource: "Refund", resourceId: refund.id, metadata: { orderId: refund.orderId, amount: Number(refund.amount) } },
    });
    return { alreadyProcessed: false, refund: { ...refund, status: "PROCESSING", reviewedById: actorId } };
  });

  if (prepared.alreadyProcessed) return prepared.refund;

  let providerResult;
  try {
    providerResult = await initiateRefund({
      transaction: prepared.refund.payment.reference,
      amountKobo: Math.round(Number(prepared.refund.amount) * 100),
      reason: prepared.refund.reason,
      merchantNote: `MarketIQ refund ${prepared.refund.id}`,
    });
  } catch (error) {
    // Keep PROCESSING: a timeout can occur after the provider accepted the refund.
    await withTransaction(async (tx) => {
      await updateRefund(prepared.refund.id, {
        failureReason: `Provider response uncertain; reconcile before retrying: ${error.message}`,
      }, tx);
      await tx.auditLog.create({
        data: { userId: actorId, action: "REFUND_PROVIDER_RESPONSE_UNCERTAIN", resource: "Refund", resourceId: prepared.refund.id, metadata: { message: error.message } },
      });
    });
    throw new ConflictError("Refund request was sent but provider confirmation is uncertain; reconcile the refund before retrying");
  }

  const providerReference = providerResult?.id != null ? String(providerResult.id) : null;
  await withTransaction(async (tx) => {
    await updateRefund(prepared.refund.id, {
      ...(providerReference ? { providerReference } : {}),
      providerPayload: providerResult,
    }, tx);
  });

  const providerStatus = String(providerResult?.status ?? "").toLowerCase();
  if (["processed", "success", "succeeded"].includes(providerStatus)) {
    await finalizeRefundSuccess(prepared.refund.id, { data: providerResult });
  } else if (["failed", "rejected"].includes(providerStatus)) {
    await finalizeRefundFailure(prepared.refund.id, { data: providerResult }, "Paystack reported refund failure");
  } else if (providerStatus === "needs-attention") {
    await handleRefundNeedsAttention(providerReference, { data: providerResult });
  }
  return findRefundById(prepared.refund.id);
};


const findRefundForWebhook = async (providerReference, event) => {
  if (providerReference != null) {
    const byProviderReference = await findRefundByProviderReference(String(providerReference));
    if (byProviderReference) return byProviderReference;
  }

  const transactionReference = event?.data?.transaction_reference;
  if (!transactionReference) return null;
  const payment = await findPaymentByReference(transactionReference);
  if (!payment) return null;
  const candidates = await findProcessingRefundsForPayment(payment.id);
  const amountKobo = Number(event?.data?.amount);
  const matches = candidates.filter((candidate) =>
    Number.isFinite(amountKobo) && Math.round(Number(candidate.amount) * 100) === amountKobo,
  );
  return matches.length === 1 ? matches[0] : null;
};

export const handleRefundProcessed = async (providerReference, event) => {
  const refund = await findRefundForWebhook(providerReference, event);
  if (!refund) return { handled: false, reason: "unknown-refund-reference" };
  await finalizeRefundSuccess(refund.id, event);
  return { handled: true };
};

export const handleRefundFailed = async (providerReference, event) => {
  const refund = await findRefundForWebhook(providerReference, event);
  if (!refund) return { handled: false, reason: "unknown-refund-reference" };
  await finalizeRefundFailure(refund.id, event, event?.data?.failure_reason || event?.message);
  return { handled: true };
};

export const handleRefundNeedsAttention = async (providerReference, event) => {
  const refund = await findRefundForWebhook(providerReference, event);
  if (!refund) return { handled: false, reason: "unknown-refund-reference" };
  return withTransaction(async (tx) => {
    const changed = await updateRefundStatusIfProcessing(refund.id, "NEEDS_ATTENTION", {
      failureReason: "Paystack requires customer bank details to continue this refund",
      providerPayload: event,
    }, tx);
    if (changed.count === 1) {
      await tx.auditLog.create({
        data: {
          userId: refund.reviewedById ?? undefined,
          action: "REFUND_NEEDS_ATTENTION",
          resource: "Refund",
          resourceId: refund.id,
          metadata: { orderId: refund.orderId, paymentId: refund.paymentId, providerReference: refund.providerReference },
        },
      });
    }
    return { handled: true };
  });
};

export const retryRefundWithDetailsService = async (actorId, refundId, details) => {
  const prepared = await withTransaction(async (tx) => {
    const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { payment: true } });
    if (!refund) throw new NotFoundError("Refund not found");
    if (refund.status !== "NEEDS_ATTENTION" || !refund.providerReference) {
      throw new ConflictError("Only refunds requiring attention with a provider reference can be retried");
    }
    const changed = await tx.refund.updateMany({
      where: { id: refundId, status: "NEEDS_ATTENTION" },
      data: { status: "PROCESSING", reviewedById: actorId, reviewedAt: new Date(), failureReason: null },
    });
    if (changed.count !== 1) throw new ConflictError("Refund status changed before retry");
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "REFUND_RETRY_STARTED",
        resource: "Refund",
        resourceId: refundId,
        metadata: { orderId: refund.orderId, currency: details.currency, bankId: details.bankId },
      },
    });
    return refund;
  });

  let providerResult;
  try {
    providerResult = await retryRefundWithCustomerDetails(prepared.providerReference, details);
  } catch (error) {
    await withTransaction(async (tx) => {
      await updateRefund(refundId, {
        failureReason: `Provider response uncertain; reconcile before retrying: ${error.message}`,
      }, tx);
    });
    throw new ConflictError("Refund retry was submitted but provider confirmation is uncertain; reconcile before retrying");
  }

  await withTransaction(async (tx) => {
    await updateRefund(refundId, { providerPayload: providerResult }, tx);
  });
  const status = String(providerResult?.status ?? "").toLowerCase();
  if (status === "processed") await finalizeRefundSuccess(refundId, { data: providerResult });
  else if (status === "failed") await finalizeRefundFailure(refundId, { data: providerResult }, "Paystack reported refund failure");
  else if (status === "needs-attention") await handleRefundNeedsAttention(prepared.providerReference, { data: providerResult });
  return findRefundById(refundId);
};
