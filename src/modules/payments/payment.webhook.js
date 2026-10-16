import { verifyWebhookSignature } from "../../config/paystack.js";
import {
  handleChargeFailed,
  handleChargeSuccess,
  handleRefundFailed,
  handleRefundNeedsAttention,
  handleRefundProcessed,
} from "./payment.service.js";

/**
 * Paystack webhook receiver.
 * Expects req.body to be a raw Buffer, mounted BEFORE express.json().
 */
export const paystackWebhook = async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const rawBody = req.body;

  if (!signature || !Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid signature" });
  }

  let event;

  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  const eventType = event?.event;
  const reference = event?.data?.reference;

  if (!eventType) {
    return res.status(200).json({ success: true, ignored: true });
  }
  const isRefundEvent = ["refund.pending", "refund.processing", "refund.needs-attention", "refund.processed", "refund.failed"].includes(eventType);
  if (isRefundEvent ? (event?.data?.id == null && event?.data?.refund_reference == null && !event?.data?.transaction_reference) : !reference) {
    return res.status(200).json({ success: true, ignored: true });
  }

  try {
    if (eventType === "charge.success") {
      await handleChargeSuccess(reference, event);
    } else if (eventType === "charge.failed") {
      await handleChargeFailed(reference, event);
    } else if (eventType === "refund.processed" || eventType === "refund.failed" || eventType === "refund.needs-attention") {
      const refundReference = event?.data?.refund_reference ?? event?.data?.id;
      const result = eventType === "refund.processed"
        ? await handleRefundProcessed(refundReference, event)
        : eventType === "refund.failed"
          ? await handleRefundFailed(refundReference, event)
          : await handleRefundNeedsAttention(refundReference, event);
      if (!result.handled) return res.status(500).json({ success: false });
    }
  } catch (err) {
    // Real infra failure → 5xx so Paystack retries
    console.error("[paystack-webhook] processing error:", err?.message);
    return res.status(500).json({ success: false });
  }

  return res.status(200).json({ success: true });
};
