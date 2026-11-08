import { LogisticHubApiError } from "./logistic-hub.client.js";

const RETURN_FALLBACK_CODES = new Set([
  "INTEGRATION_SHIPMENT_IN_CUSTODY_USE_RETURN",
  "INTEGRATION_SHIPMENT_STOP_WINDOW_CLOSED",
]);

export const sendCustodyAwareShipmentResolution = async ({
  client,
  externalReference,
  reason,
  requestId,
}) => {
  try {
    const response = await client.stopShipment(
      externalReference,
      reason,
      `mqi-stop-${requestId}-v1`,
    );
    if (response?.status !== "STOPPED") {
      throw new LogisticHubApiError("Logistic Hub did not confirm the shipment stop.", {
        code: "INVALID_SHIPMENT_STOP_RESPONSE",
      });
    }
    return { status: "STOP_CONFIRMED", response };
  } catch (error) {
    if (!(error instanceof LogisticHubApiError) || !RETURN_FALLBACK_CODES.has(error.code)) {
      throw error;
    }
    const response = await client.requestShipmentReturn(
      externalReference,
      reason,
      `mqi-return-${requestId}-v1`,
    );
    if (response?.status !== "RETURN_REQUESTED" || response.physicalReturnConfirmed !== false) {
      throw new LogisticHubApiError("Logistic Hub returned an invalid return-request acknowledgement.", {
        code: "INVALID_SHIPMENT_RETURN_RESPONSE",
      });
    }
    return { status: "RETURN_REQUESTED", response };
  }
};
