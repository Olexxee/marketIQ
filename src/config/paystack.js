import crypto from "node:crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

const getSecretKey = () => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
};

const paystackRequest = async (path, { method = "GET", body } = {}) => {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json.status) {
    const message = json?.message || `Paystack request failed (${res.status})`;
    const error = new Error(message);
    error.providerResponse = json;
    throw error;
  }

  return json.data;
};

export const initializeTransaction = async ({
  email,
  amountKobo,
  reference,
  callbackUrl,
  metadata,
}) => {
  return paystackRequest("/transaction/initialize", {
    method: "POST",
    body: {
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl,
      metadata,
    },
  });
};

export const verifyTransaction = async (reference) => {
  return paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
};

export const verifyWebhookSignature = (rawBody, signature) => {
  if (!rawBody || !signature) return false;

  const hash = crypto
    .createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex");

  // Constant-time compare to avoid timing leaks
  const a = Buffer.from(hash, "utf8");
  const b = Buffer.from(String(signature), "utf8");

  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
};

export const initiateRefund = async ({ transaction, amountKobo, reason, merchantNote }) => {
  return paystackRequest("/refund", {
    method: "POST",
    body: {
      transaction,
      amount: amountKobo,
      customer_note: reason,
      merchant_note: merchantNote,
    },
  });
};


export const retryRefundWithCustomerDetails = async (refundId, details) => {
  return paystackRequest(`/refund/retry_with_customer_details/${encodeURIComponent(refundId)}`, {
    method: "POST",
    body: {
      refund_account_details: {
        currency: details.currency,
        account_number: details.accountNumber,
        bank_id: details.bankId,
      },
    },
  });
};
