import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createLogisticHubWebhookService,
  verifyLogisticHubWebhookSignature,
} from "./logistic-hub.webhook.service.js";

const secret = "hub-webhook-signing-secret";
const now = new Date("2026-11-07T12:00:00.000Z");
const envelope = {
  id: "hub-event-1",
  type: "shipment.partner_assigned",
  schemaVersion: 1,
  occurredAt: "2026-11-07T11:59:00.000Z",
  sequence: 2,
  data: { shipmentReference: "LH-PCL-ABC123", status: "DRIVER_ASSIGNED" },
};

const signedRequest = (body = JSON.stringify(envelope), timestamp = "1794052800") => {
  const rawBody = Buffer.from(body);
  const signature = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
    .digest("hex");
  return {
    rawBody,
    headers: {
      "x-logistic-hub-signature": `t=${timestamp},v1=${signature}`,
      "x-logistic-hub-timestamp": timestamp,
      "x-logistic-hub-event-id": envelope.id,
      "x-logistic-hub-event-type": envelope.type,
      "x-logistic-hub-event-sequence": String(envelope.sequence),
    },
  };
};

test("verifies the exact raw bytes and normalizes the Hub event envelope", () => {
  const request = signedRequest();
  const verified = verifyLogisticHubWebhookSignature({
    ...request, secret, toleranceSeconds: 300, now,
  });
  assert.equal(verified.envelope.id, envelope.id);
  assert.equal(verified.envelope.type, envelope.type);
  assert.equal(verified.envelope.sequence, 2);
  assert.deepEqual(verified.envelope.data, envelope.data);
  assert.equal(verified.signatureVersion, "v1");
  assert.equal(verified.rawBodySha256.length, 64);
});

test("rejects a body changed after signing", () => {
  const request = signedRequest();
  request.rawBody = Buffer.from(request.rawBody.toString("utf8") + " ");
  assert.throws(
    () => verifyLogisticHubWebhookSignature({ ...request, secret, now }),
    error => error.statusCode === 401 && error.code === "INVALID_LOGISTIC_HUB_SIGNATURE",
  );
});

test("rejects stale signatures and mismatched event headers", () => {
  const stale = signedRequest(JSON.stringify(envelope), "1794050000");
  assert.throws(
    () => verifyLogisticHubWebhookSignature({ ...stale, secret, toleranceSeconds: 300, now }),
    error => error.code === "LOGISTIC_HUB_WEBHOOK_TIMESTAMP_EXPIRED",
  );

  const mismatched = signedRequest();
  mismatched.headers["x-logistic-hub-event-sequence"] = "3";
  assert.throws(
    () => verifyLogisticHubWebhookSignature({ ...mismatched, secret, now }),
    error => error.code === "LOGISTIC_HUB_WEBHOOK_HEADER_MISMATCH",
  );
});

test("passes only verified and sanitized event data to persistence", async () => {
  let captured;
  const service = createLogisticHubWebhookService({
    repository: {
      persistVerifiedEvent: async value => { captured = value; return { projected: true }; },
    },
    secret,
    toleranceSeconds: 300,
    clock: () => now,
  });
  const result = await service.receive(signedRequest());
  assert.deepEqual(result, { projected: true });
  assert.equal(captured.envelope.data.shipmentReference, "LH-PCL-ABC123");
  assert.equal("recipientPhone" in captured.envelope.data, false);
});


test("accepts signed shipment cancellation and return-request event types", () => {
  for (const [index, type, status] of [
    [1, "shipment.cancelled", "CANCELLED"],
    [2, "shipment.return_requested", "IN_TRANSIT"],
  ]) {
    const event = {
      ...envelope,
      id: `hub-resolution-event-${index}`,
      type,
      sequence: index + 10,
      data: { shipmentReference: "LH-PCL-ABC123", status },
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const timestamp = "1794052800";
    const signature = createHmac("sha256", secret)
      .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
      .digest("hex");
    const verified = verifyLogisticHubWebhookSignature({
      rawBody,
      headers: {
        "x-logistic-hub-signature": `t=${timestamp},v1=${signature}`,
        "x-logistic-hub-timestamp": timestamp,
        "x-logistic-hub-event-id": event.id,
        "x-logistic-hub-event-type": event.type,
        "x-logistic-hub-event-sequence": String(event.sequence),
      },
      secret,
      toleranceSeconds: 300,
      now,
    });
    assert.equal(verified.envelope.type, type);
    assert.equal(verified.envelope.data.status, status);
  }
});
