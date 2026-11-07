import prisma from "../../config/prisma.js";
import { EVENT_TYPES } from "../events/event.types.js";

const SHIPMENT_EVENT = EVENT_TYPES.LOGISTICS_SHIPMENT_AUTHORIZATION_REQUESTED;

export const findPendingShipmentAuthorizationEvents = (limit = 10) =>
  prisma.outboxEvent.findMany({
    where: {
      eventType: SHIPMENT_EVENT,
      status: "PENDING",
      availableAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

export const claimShipmentAuthorizationEvent = id =>
  prisma.outboxEvent.updateMany({
    where: {
      id,
      eventType: SHIPMENT_EVENT,
      status: "PENDING",
      availableAt: { lte: new Date() },
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
    },
  });

export const recoverStaleShipmentAuthorizationEvents = (staleMinutes = 15) =>
  prisma.outboxEvent.updateMany({
    where: {
      eventType: SHIPMENT_EVENT,
      status: "PROCESSING",
      updatedAt: { lt: new Date(Date.now() - staleMinutes * 60 * 1000) },
    },
    data: {
      status: "PENDING",
      availableAt: new Date(),
      lastError: "Recovered stale shipment authorization after worker interruption",
    },
  });

export const completeShipmentAuthorizationEvent = id =>
  prisma.outboxEvent.updateMany({
    where: { id, eventType: SHIPMENT_EVENT, status: "PROCESSING" },
    data: { status: "COMPLETED", processedAt: new Date(), lastError: null },
  });

export const failShipmentAuthorizationEvent = (id, error, retryAt, terminal) =>
  prisma.outboxEvent.updateMany({
    where: { id, eventType: SHIPMENT_EVENT, status: "PROCESSING" },
    data: {
      status: terminal ? "FAILED" : "PENDING",
      availableAt: retryAt,
      lastError: error?.message ?? String(error),
    },
  });

export const findShipmentAuthorizationContext = sellerOrderId =>
  prisma.sellerOrder.findUnique({
    where: { id: sellerOrderId },
    include: {
      logisticsQuote: {
        include: {
          provider: true,
          selectedOption: true,
        },
      },
      logisticsShipment: true,
    },
  });

export const ensureLocalLogisticsShipment = async ({
  providerId,
  sellerOrderId,
  externalReference,
  idempotencyKey,
  customerDeliveryChargeMinor,
  agreedLogisticsCostMinor,
  currency,
  billingAgreementReference,
  requestSnapshot,
}) => prisma.$transaction(async tx => {
  const existing = await tx.logisticsShipment.findUnique({ where: { sellerOrderId } });
  if (existing) {
    const matches =
      existing.providerId === providerId &&
      existing.externalReference === externalReference &&
      existing.idempotencyKey === idempotencyKey &&
      existing.customerDeliveryChargeMinor === BigInt(customerDeliveryChargeMinor) &&
      existing.currency === currency;
    if (!matches) {
      const error = new Error("Local shipment record conflicts with the immutable authorization snapshot.");
      error.code = "LOCAL_SHIPMENT_SNAPSHOT_CONFLICT";
      error.retryable = false;
      throw error;
    }
    if (existing.status === "BOOKED") return existing;
    return tx.logisticsShipment.update({
      where: { id: existing.id },
      data: {
        status: "BOOKING",
        lastErrorCode: null,
        lastErrorMessage: null,
        failedAt: null,
      },
    });
  }

  return tx.logisticsShipment.create({
    data: {
      providerId,
      sellerOrderId,
      externalReference,
      idempotencyKey,
      status: "BOOKING",
      customerDeliveryChargeMinor: BigInt(customerDeliveryChargeMinor),
      agreedLogisticsCostMinor: BigInt(agreedLogisticsCostMinor),
      currency,
      billingAgreementReference,
      requestSnapshot,
    },
  });
});

export const markLocalLogisticsShipmentBooked = ({
  sellerOrderId,
  providerShipment,
  responseSnapshot,
}) => prisma.logisticsShipment.updateMany({
  where: { sellerOrderId, status: { not: "BOOKED" } },
  data: {
    externalBookingReference: providerShipment.id ?? null,
    trackingReference: providerShipment.reference ?? providerShipment.trackingReference ?? null,
    status: "BOOKED",
    responseSnapshot,
    bookedAt: new Date(),
    lastErrorCode: null,
    lastErrorMessage: null,
    failedAt: null,
  },
});

export const markLocalLogisticsShipmentFailure = ({
  sellerOrderId,
  error,
  terminal,
}) => {
  if (!sellerOrderId) return Promise.resolve({ count: 0 });
  return prisma.logisticsShipment.updateMany({
  where: { sellerOrderId, status: { not: "BOOKED" } },
  data: {
    status: terminal ? "FAILED" : "RETRY_PENDING",
    lastErrorCode: error?.code ?? "SHIPMENT_AUTHORIZATION_FAILED",
    lastErrorMessage: String(error?.message ?? error).slice(0, 1000),
    failedAt: terminal ? new Date() : null,
  },
  });
};
