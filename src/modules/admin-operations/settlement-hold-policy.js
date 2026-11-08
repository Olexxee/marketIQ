const ACTIVE_DISPUTE_STATUSES = new Set(["OPEN", "UNDER_REVIEW"]);
const ACTIVE_RESOLUTION_STATUSES = new Set([
  "COMMAND_PENDING",
  "COMMAND_PROCESSING",
  "STOP_CONFIRMED",
  "RETURN_REQUESTED",
]);
const ACTIVE_SHIPMENT_REVIEW_STATUSES = new Set([
  "CANCELLATION_REQUESTED",
  "CANCELLATION_CONFIRMED",
  "RETURN_REQUESTED",
  "CANCELLATION_COMMAND_FAILED",
]);

export const getSellerSettlementHoldReason = ({
  orderDisputedAt,
  disputeStatus,
  resolutionStatus,
  shipmentReviewStatus,
} = {}) => {
  if (orderDisputedAt || ACTIVE_DISPUTE_STATUSES.has(disputeStatus)) {
    return "An active order dispute blocks seller settlement; manual review is required";
  }
  if (ACTIVE_RESOLUTION_STATUSES.has(resolutionStatus)) {
    return `A logistics resolution (${resolutionStatus}) blocks seller settlement; manual financial review is required`;
  }
  if (ACTIVE_SHIPMENT_REVIEW_STATUSES.has(shipmentReviewStatus)) {
    return `A shipment review (${shipmentReviewStatus}) blocks seller settlement; manual financial review is required`;
  }
  return null;
};
