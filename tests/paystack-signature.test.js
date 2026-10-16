import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "../src/config/paystack.js";

const secret = "test-paystack-secret";
const originalSecret = process.env.PAYSTACK_SECRET_KEY;

test("accepts a valid HMAC SHA-512 webhook signature", () => {
  process.env.PAYSTACK_SECRET_KEY = secret;
  const body = Buffer.from(JSON.stringify({ event: "charge.success", data: { reference: "MQI-test" } }));
  const signature = createHmac("sha512", secret).update(body).digest("hex");
  assert.equal(verifyWebhookSignature(body, signature), true);
});

test("rejects a modified body and an invalid signature", () => {
  process.env.PAYSTACK_SECRET_KEY = secret;
  const originalBody = Buffer.from('{"event":"charge.success"}');
  const signature = createHmac("sha512", secret).update(originalBody).digest("hex");
  assert.equal(verifyWebhookSignature(Buffer.from('{"event":"charge.failed"}'), signature), false);
  assert.equal(verifyWebhookSignature(originalBody, "invalid"), false);
  assert.equal(verifyWebhookSignature(originalBody, ""), false);
});

after(() => {
  if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = originalSecret;
});
