export class LogisticHubWebhookRepositoryError extends Error {
  constructor(message, { statusCode = 503, code = "LOGISTIC_HUB_WEBHOOK_PERSISTENCE_FAILED" } = {}) {
    super(message);
    this.name = "LogisticHubWebhookRepositoryError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function createLogisticHubWebhookRepository({ prismaClient } = {}) {
  if (!prismaClient) throw new Error("A Prisma client is required.");

  return Object.freeze({
    async persistVerifiedEvent({ envelope, rawBodySha256, signatureTimestamp, signatureVersion }) {
      return prismaClient.$transaction(async tx => {
        const provider = await tx.logisticsProvider.findUnique({
          where: { code: "LOGISTIC_HUB" },
          select: { id: true },
        });
        if (!provider) {
          throw new LogisticHubWebhookRepositoryError("Logistic Hub provider is not configured in MarketIQ.", {
            code: "LOGISTIC_HUB_PROVIDER_NOT_CONFIGURED",
          });
        }

        const existingReceipt = await tx.logisticsWebhookReceipt.findUnique({
          where: {
            providerId_externalEventId: {
              providerId: provider.id,
              externalEventId: envelope.id,
            },
          },
          select: { id: true, status: true },
        });
        if (existingReceipt) {
          return { duplicate: true, receiptStatus: existingReceipt.status, projected: existingReceipt.status === "PROCESSED" };
        }

        const shipment = await tx.logisticsShipment.findFirst({
          where: {
            providerId: provider.id,
            trackingReference: envelope.data.shipmentReference,
          },
          select: { id: true, lastEventSequence: true },
        });
        if (!shipment) {
          // Do not acknowledge an event that raced ahead of LI-02E's local
          // booking persistence. Logistic Hub will retry this 503 delivery.
          throw new LogisticHubWebhookRepositoryError("The referenced MarketIQ shipment is not persisted yet.", {
            code: "LOGISTIC_HUB_SHIPMENT_NOT_READY",
          });
        }

        // Serialize events for this shipment before checking the receipt and
        // sequence constraints. The event and receipt writes remain atomic.
        await tx.$queryRaw`SELECT "id" FROM "LogisticsShipment" WHERE "id" = ${shipment.id} FOR UPDATE`;

        const racedReceipt = await tx.logisticsWebhookReceipt.findUnique({
          where: {
            providerId_externalEventId: {
              providerId: provider.id,
              externalEventId: envelope.id,
            },
          },
          select: { id: true, status: true },
        });
        if (racedReceipt) {
          return { duplicate: true, receiptStatus: racedReceipt.status, projected: racedReceipt.status === "PROCESSED" };
        }

        const receipt = await tx.logisticsWebhookReceipt.create({
          data: {
            providerId: provider.id,
            externalEventId: envelope.id,
            signatureVerified: true,
            rawBodySha256,
            signatureTimestamp,
            signatureVersion,
            status: "RECEIVED",
            payload: envelope,
          },
          select: { id: true },
        });

        const sequenceConflict = await tx.logisticsEvent.findFirst({
          where: { shipmentId: shipment.id, sequence: envelope.sequence },
          select: { id: true, externalEventId: true },
        });
        if (sequenceConflict && sequenceConflict.externalEventId !== envelope.id) {
          await tx.logisticsWebhookReceipt.update({
            where: { id: receipt.id },
            data: {
              status: "FAILED",
              processedAt: new Date(),
              lastError: "A different signed event already occupies this shipment sequence.",
            },
          });
          return { duplicate: false, projected: false, sequenceConflict: true };
        }

        if (!sequenceConflict) {
          await tx.logisticsEvent.create({
            data: {
              providerId: provider.id,
              shipmentId: shipment.id,
              externalEventId: envelope.id,
              eventType: envelope.type,
              sequence: envelope.sequence,
              occurredAt: new Date(envelope.occurredAt),
              payload: {
                shipmentReference: envelope.data.shipmentReference,
                status: envelope.data.status,
              },
            },
          });
        }

        const currentShipment = await tx.logisticsShipment.findUnique({
          where: { id: shipment.id },
          select: { lastEventSequence: true },
        });
        const advancesProjection =
          currentShipment.lastEventSequence == null || envelope.sequence > currentShipment.lastEventSequence;
        if (advancesProjection) {
          await tx.logisticsShipment.updateMany({
            where: { id: shipment.id, providerId: provider.id },
            data: {
              providerStatus: envelope.data.status,
              lastEventSequence: envelope.sequence,
              lastEventAt: new Date(envelope.occurredAt),
            },
          });
        }

        // Resolution state is reconciled only from a newer, signed Hub event.
        // A command HTTP response is not a substitute for this source event.
        if (advancesProjection && ["shipment.cancelled", "shipment.return_requested"].includes(envelope.type)) {
          const resolution = await tx.shipmentResolutionRequest.findUnique({
            where: { shipmentId: shipment.id },
            select: { id: true, sellerOrderId: true, status: true },
          });

          if (resolution) {
            if (envelope.type === "shipment.cancelled") {
              await tx.shipmentResolutionRequest.updateMany({
                where: {
                  id: resolution.id,
                  status: { in: ["COMMAND_PENDING", "COMMAND_PROCESSING", "STOP_CONFIRMED"] },
                },
                data: {
                  status: "STOP_CONFIRMED",
                  physicalReturnConfirmed: false,
                  commandAcceptedAt: new Date(envelope.occurredAt),
                  resolvedAt: new Date(envelope.occurredAt),
                },
              });
              await tx.logisticsShipment.updateMany({
                where: { id: shipment.id, status: "BOOKED" },
                data: { status: "CANCELLED" },
              });
              await tx.shipmentReview.updateMany({
                where: { sellerOrderId: resolution.sellerOrderId, status: "CANCELLATION_REQUESTED" },
                data: { status: "CANCELLATION_CONFIRMED", closedAt: new Date(envelope.occurredAt) },
              });
            } else {
              await tx.shipmentResolutionRequest.updateMany({
                where: {
                  id: resolution.id,
                  status: { in: ["COMMAND_PENDING", "COMMAND_PROCESSING", "RETURN_REQUESTED"] },
                },
                data: {
                  status: "RETURN_REQUESTED",
                  physicalReturnConfirmed: false,
                  commandAcceptedAt: new Date(envelope.occurredAt),
                  resolvedAt: null,
                },
              });
              await tx.shipmentReview.updateMany({
                where: { sellerOrderId: resolution.sellerOrderId, status: "CANCELLATION_REQUESTED" },
                data: { status: "RETURN_REQUESTED", returnRequestedAt: new Date(envelope.occurredAt) },
              });
            }
          }
        }

        await tx.logisticsWebhookReceipt.update({
          where: { id: receipt.id },
          data: { status: "PROCESSED", processedAt: new Date(), lastError: null },
        });

        return {
          duplicate: Boolean(sequenceConflict),
          projected: advancesProjection,
          stale: !advancesProjection,
          sequence: envelope.sequence,
        };
      });
    },
  });
}
