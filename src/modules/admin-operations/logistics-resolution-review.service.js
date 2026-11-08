import { NotFoundError } from "../../classes/errorClasses.js";
import {
  findLogisticsResolutionReviewById,
  listLogisticsResolutionReviews,
} from "./logistics-resolution-review.db.js";

const pendingRefundStatuses = new Set(["REQUESTED", "APPROVED", "PROCESSING", "NEEDS_ATTENTION"]);

export const buildLogisticsResolutionReviewFlags = (record) => {
  const flags = [];
  const order = record.sellerOrder?.order;
  const settlement = record.sellerOrder?.settlement;
  const refunds = order?.refunds ?? [];
  const payments = order?.payments ?? [];
  const events = record.shipment?.events ?? [];

  if (record.status === "RETURN_REQUESTED" && record.physicalReturnConfirmed !== true) {
    flags.push("RETURN_NOT_PHYSICALLY_CONFIRMED");
  }
  if (record.status === "STOP_CONFIRMED" && record.physicalReturnConfirmed !== true) {
    flags.push("STOP_CONFIRMED_NO_RETURN_RECEIPT");
  }
  if (settlement?.status === "PAID") {
    flags.push("SELLER_SETTLEMENT_PAID_RECOVERY_REVIEW_REQUIRED");
  }
  if (refunds.some((refund) => pendingRefundStatuses.has(refund.status))) {
    flags.push("REFUND_ALREADY_PENDING_OR_PROCESSING");
  }
  if (!payments.some((payment) => payment.status === "SUCCESS" || payment.status === "REVERSED")) {
    flags.push("NO_SUCCESSFUL_PAYMENT_RECORD");
  }
  if (events.length === 0) {
    flags.push("NO_HUB_EVENT_EVIDENCE");
  }
  if (record.physicalReturnConfirmed === true && record.status !== "RETURN_REQUESTED") {
    flags.push("PHYSICAL_RETURN_FLAG_REQUIRES_STATE_RECONCILIATION");
  }

  return flags;
};

const serializeShipmentMoney = (shipment) => ({
  ...shipment,
  customerDeliveryChargeMinor: shipment.customerDeliveryChargeMinor?.toString() ?? null,
  agreedLogisticsCostMinor: shipment.agreedLogisticsCostMinor?.toString() ?? null,
});

const toReviewRecord = (record) => ({
  ...record,
  shipment: serializeShipmentMoney(record.shipment),
  reviewFlags: buildLogisticsResolutionReviewFlags(record),
  financialActionsEnabled: false,
});

export const listLogisticsResolutionReviewsService = async ({ status, page = 1, limit = 20 } = {}) => {
  const { items, total } = await listLogisticsResolutionReviews({
    status,
    skip: (page - 1) * limit,
    take: limit,
  });
  return { items: items.map(toReviewRecord), total, page, limit };
};

export const getLogisticsResolutionReviewService = async (id) => {
  const record = await findLogisticsResolutionReviewById(id);
  if (!record) throw new NotFoundError("Logistics resolution review not found");
  return toReviewRecord(record);
};
