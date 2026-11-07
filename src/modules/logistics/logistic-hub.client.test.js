import test from "node:test";
import assert from "node:assert/strict";
import {
  createLogisticHubClient,
  LogisticHubApiError,
} from "./logistic-hub.client.js";

const config = {
  baseUrl: "https://hub.example.test/",
  keyId: "market-key-id",
  secret: "market-secret",
  timeoutMs: 2500,
};

test("creates quote requests with service credentials and idempotency", async () => {
  let captured;
  const client = createLogisticHubClient({
    config,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { quoteSession: { id: "quote_1" }, options: [] } }),
      };
    },
  });

  const result = await client.createQuote({ externalReference: "cart-seller-1" }, "quote-create-0001");

  assert.equal(result.quoteSession.id, "quote_1");
  assert.equal(captured.url, "https://hub.example.test/api/v1/integrations/quotes");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["X-Integration-Key-Id"], config.keyId);
  assert.equal(captured.options.headers["X-Integration-Secret"], config.secret);
  assert.equal(captured.options.headers["Idempotency-Key"], "quote-create-0001");
  assert.deepEqual(JSON.parse(captured.options.body), { externalReference: "cart-seller-1" });
  assert.equal(captured.options.redirect, "error");
});

test("reads and accepts quote options through the documented paths", async () => {
  const urls = [];
  const client = createLogisticHubClient({
    config,
    fetchImpl: async (url, options) => {
      urls.push({ url, method: options.method, body: options.body });
      return { ok: true, status: 200, json: async () => ({ success: true, data: { id: "quote_1" } }) };
    },
  });

  await client.getQuote("quote/session");
  await client.acceptQuoteOption("quote_1", "option_2", "quote-accept-0001");

  assert.equal(urls[0].url, "https://hub.example.test/api/v1/integrations/quotes/quote%2Fsession");
  assert.equal(urls[0].method, "GET");
  assert.equal(urls[1].url, "https://hub.example.test/api/v1/integrations/quotes/quote_1/options/option_2/accept");
  assert.equal(urls[1].method, "POST");
  assert.equal(urls[1].body, "{}");
});

test("surfaces provider error codes without leaking request credentials", async () => {
  const client = createLogisticHubClient({
    config,
    fetchImpl: async () => ({
      ok: false,
      status: 409,
      json: async () => ({ success: false, error: { code: "QUOTE_EXPIRED", message: "Quote expired" } }),
    }),
  });

  await assert.rejects(
    client.getQuote("quote_1"),
    error => error instanceof LogisticHubApiError &&
      error.code === "QUOTE_EXPIRED" &&
      error.status === 409 &&
      error.message === "Quote expired",
  );
});

test("marks transport failures retryable without exposing low-level details", async () => {
  const client = createLogisticHubClient({
    config,
    fetchImpl: async () => { throw new Error("socket details should not escape"); },
  });

  await assert.rejects(
    client.getQuote("quote_1"),
    error => error.code === "LOGISTIC_HUB_UNAVAILABLE" &&
      error.retryable === true &&
      !error.message.includes("socket details"),
  );
});

test("creates integration shipments with the exact idempotency key", async () => {
  let captured;
  const client = createLogisticHubClient({
    config,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { shipment: { id: "hub-id", reference: "HUB-REF-1" } } }),
      };
    },
  });
  const body = {
    quoteSessionId: "quote_1",
    quoteOptionId: "option_1",
    externalFulfillmentReference: "mqi-fulfilment-1",
    paymentAttestation: {
      paymentProvider: "PAYSTACK",
      externalPaymentReference: "paystack-ref",
      verifiedAt: "2026-11-07T12:00:00.000Z",
      currency: "NGN",
      deliveryChargeMinor: "1000",
      orderPaymentAmountMinor: "11000",
    },
  };
  const result = await client.createShipment(body, "stable-shipment-key");
  assert.equal(result.shipment.id, "hub-id");
  assert.equal(captured.url, "https://hub.example.test/api/v1/integrations/shipments");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["Idempotency-Key"], "stable-shipment-key");
  assert.deepEqual(JSON.parse(captured.options.body), body);
});

test("recovers a shipment by external fulfilment reference and treats only 404 as absent", async () => {
  let capturedUrl;
  const foundClient = createLogisticHubClient({
    config,
    fetchImpl: async url => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ success: true, data: { shipment: { id: "hub-id" } } }) };
    },
  });
  const found = await foundClient.getShipmentByExternalReference("mqi/ref 1");
  assert.equal(found.shipment.id, "hub-id");
  assert.equal(
    capturedUrl,
    "https://hub.example.test/api/v1/integrations/shipments/by-external-reference/mqi%2Fref%201",
  );

  const missingClient = createLogisticHubClient({
    config,
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }),
    }),
  });
  assert.equal(await missingClient.getShipmentByExternalReference("missing"), null);
});

test("rejects missing credentials and insecure production URLs", () => {
  assert.throws(
    () => createLogisticHubClient({ config: { baseUrl: config.baseUrl } }),
    error => error.code === "LOGISTIC_HUB_NOT_CONFIGURED",
  );

  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(
      () => createLogisticHubClient({ config: { ...config, baseUrl: "http://hub.example.test" } }),
      error => error.code === "LOGISTIC_HUB_INVALID_CONFIGURATION",
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});


test("allows a timed-out quote creation to be replayed with the identical idempotency key and payload", async () => {
  const attempts = [];
  const client = createLogisticHubClient({
    config,
    fetchImpl: async (url, options) => {
      attempts.push({
        url,
        idempotencyKey: options.headers["Idempotency-Key"],
        body: options.body,
      });
      if (attempts.length === 1) throw new Error("simulated response timeout after provider commit");
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { quoteSession: { id: "quote-recovered" }, options: [] } }),
      };
    },
  });
  const payload = { externalFulfillmentReference: "mqi-stable-ref", packages: [{ weightGrams: 1000 }] };
  await assert.rejects(client.createQuote(payload, "same-quote-idempotency-key"), error =>
    error.code === "LOGISTIC_HUB_UNAVAILABLE" && error.retryable === true,
  );
  const recovered = await client.createQuote(payload, "same-quote-idempotency-key");

  assert.equal(recovered.quoteSession.id, "quote-recovered");
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].idempotencyKey, attempts[1].idempotencyKey);
  assert.equal(attempts[0].body, attempts[1].body);
});
