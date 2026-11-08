import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const SUPPORTED_EVENT_TYPES = new Set([
  "shipment.created",
  "shipment.partner_assigned",
  "shipment.in_transit",
  "shipment.custody_handover_confirmed",
  "shipment.delivery_leg_completed",
  "shipment.cancelled",
  "shipment.return_requested",
]);

export class LogisticHubWebhookError extends Error {
  constructor(message, { statusCode = 400, code = "INVALID_LOGISTIC_HUB_WEBHOOK" } = {}) {
    super(message);
    this.name = "LogisticHubWebhookError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const header = (headers, name) => {
  const value = headers?.[name.toLowerCase()];
  return typeof value === "string" ? value.trim() : "";
};

const invalid = (message, code = "INVALID_LOGISTIC_HUB_WEBHOOK") => {
  throw new LogisticHubWebhookError(message, { statusCode: 400, code });
};

export function verifyLogisticHubWebhookSignature({
  rawBody,
  headers,
  secret,
  toleranceSeconds = 300,
  now = new Date(),
}) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) invalid("A raw JSON request body is required.");
  if (!secret) {
    throw new LogisticHubWebhookError("Logistic Hub webhook signing secret is not configured.", {
      statusCode: 503,
      code: "LOGISTIC_HUB_WEBHOOK_NOT_CONFIGURED",
    });
  }

  const signatureHeader = header(headers, "x-logistic-hub-signature");
  const timestampHeader = header(headers, "x-logistic-hub-timestamp");
  const eventIdHeader = header(headers, "x-logistic-hub-event-id");
  const eventTypeHeader = header(headers, "x-logistic-hub-event-type");
  const sequenceHeader = header(headers, "x-logistic-hub-event-sequence");

  const parts = signatureHeader.split(",").map(part => part.trim());
  const timestampParts = parts.filter(part => part.startsWith("t="));
  const signatures = parts.filter(part => part.startsWith("v1=")).map(part => part.slice(3));
  if (
    timestampParts.length !== 1 ||
    signatures.length === 0 ||
    !/^t=\d{1,12}$/.test(timestampParts[0]) ||
    !signatures.every(value => /^[a-f0-9]{64}$/i.test(value))
  ) invalid("The Logistic Hub signature header is malformed.", "INVALID_LOGISTIC_HUB_SIGNATURE");

  const timestamp = timestampParts[0].slice(2);
  if (!/^\d{1,12}$/.test(timestampHeader) || timestampHeader !== timestamp) {
    invalid("The webhook timestamp headers do not match.", "LOGISTIC_HUB_WEBHOOK_TIMESTAMP_MISMATCH");
  }

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    throw new LogisticHubWebhookError("The Logistic Hub webhook timestamp is outside the accepted tolerance.", {
      statusCode: 401,
      code: "LOGISTIC_HUB_WEBHOOK_TIMESTAMP_EXPIRED",
    });
  }

  const expected = createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), rawBody]))
    .digest();
  const valid = signatures.some(value => {
    const candidate = Buffer.from(value, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
  if (!valid) {
    throw new LogisticHubWebhookError("The Logistic Hub webhook signature is invalid.", {
      statusCode: 401,
      code: "INVALID_LOGISTIC_HUB_SIGNATURE",
    });
  }

  let envelope;
  try {
    envelope = JSON.parse(rawBody.toString("utf8"));
  } catch {
    invalid("The signed webhook body is not valid JSON.", "INVALID_LOGISTIC_HUB_WEBHOOK_JSON");
  }

  if (
    !envelope ||
    typeof envelope !== "object" ||
    Array.isArray(envelope) ||
    typeof envelope.id !== "string" ||
    typeof envelope.type !== "string" ||
    envelope.schemaVersion !== 1 ||
    !Number.isSafeInteger(envelope.sequence) ||
    envelope.sequence < 1 ||
    typeof envelope.occurredAt !== "string" ||
    !Number.isFinite(new Date(envelope.occurredAt).getTime()) ||
    !envelope.data ||
    typeof envelope.data !== "object" ||
    Array.isArray(envelope.data) ||
    typeof envelope.data.shipmentReference !== "string" ||
    envelope.data.shipmentReference.trim().length < 3 ||
    envelope.data.shipmentReference.length > 120 ||
    typeof envelope.data.status !== "string" ||
    envelope.data.status.trim().length < 1 ||
    envelope.data.status.length > 64
  ) invalid("The signed webhook envelope does not match schema version 1.");

  if (
    envelope.id !== eventIdHeader ||
    envelope.type !== eventTypeHeader ||
    String(envelope.sequence) !== sequenceHeader
  ) invalid("The event headers do not match the signed webhook envelope.", "LOGISTIC_HUB_WEBHOOK_HEADER_MISMATCH");

  if (!SUPPORTED_EVENT_TYPES.has(envelope.type)) {
    invalid("The Logistic Hub event type is not supported by this integration version.", "UNSUPPORTED_LOGISTIC_HUB_EVENT");
  }

  return {
    envelope: {
      id: envelope.id,
      type: envelope.type,
      schemaVersion: envelope.schemaVersion,
      occurredAt: new Date(envelope.occurredAt).toISOString(),
      sequence: envelope.sequence,
      data: {
        shipmentReference: envelope.data.shipmentReference,
        status: envelope.data.status,
      },
    },
    signatureTimestamp: BigInt(timestamp),
    signatureVersion: "v1",
    rawBodySha256: createHash("sha256").update(rawBody).digest("hex"),
  };
}

export function createLogisticHubWebhookService({
  repository,
  secret,
  toleranceSeconds = 300,
  clock = () => new Date(),
} = {}) {
  if (!repository) throw new Error("A Logistic Hub webhook repository is required.");

  return Object.freeze({
    async receive({ rawBody, headers }) {
      const verified = verifyLogisticHubWebhookSignature({
        rawBody,
        headers,
        secret,
        toleranceSeconds,
        now: clock(),
      });
      return repository.persistVerifiedEvent(verified);
    },
  });
}
