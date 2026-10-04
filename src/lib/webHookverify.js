import crypto from "crypto";
import { env } from "../config/env.js";

export const verifyWebhookSignature = (rawBody, signature) => {
  if (!Buffer.isBuffer(rawBody) || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha512", env.paystack.secretKey)
    .update(rawBody)
    .digest("hex");

  const received = String(signature).trim();

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(received, "utf8"),
  );
};
