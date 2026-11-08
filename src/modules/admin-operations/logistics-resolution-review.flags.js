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
    flags.push("STOP_CONFIRMED_IS_NOT_RETURN_CONFIRMATION");
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
