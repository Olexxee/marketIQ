const DEFAULT_TIMEOUT_MS = 8_000;

export class LogisticHubApiError extends Error {
  constructor(message, { status = null, code = "LOGISTIC_HUB_REQUEST_FAILED", retryable = false } = {}) {
    super(message);
    this.name = "LogisticHubApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const resolveConfig = (config) => {
  const value = config ?? {
    baseUrl: process.env.LOGISTIC_HUB_BASE_URL,
    keyId: process.env.LOGISTIC_HUB_CLIENT_KEY_ID,
    secret: process.env.LOGISTIC_HUB_CLIENT_SECRET,
    timeoutMs: Number(process.env.LOGISTIC_HUB_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
  if (!value?.baseUrl || !value?.keyId || !value?.secret) {
    throw new LogisticHubApiError("Logistic Hub integration is not configured.", {
      code: "LOGISTIC_HUB_NOT_CONFIGURED",
    });
  }

  let base;
  try {
    base = new URL(value.baseUrl);
  } catch {
    throw new LogisticHubApiError("LOGISTIC_HUB_BASE_URL must be a valid absolute URL.", {
      code: "LOGISTIC_HUB_INVALID_CONFIGURATION",
    });
  }
  if (
    base.username || base.password || base.search || base.hash ||
    (process.env.NODE_ENV === "production" && base.protocol !== "https:") ||
    !["https:", "http:"].includes(base.protocol)
  ) {
    throw new LogisticHubApiError("Logistic Hub base URL is not permitted.", {
      code: "LOGISTIC_HUB_INVALID_CONFIGURATION",
    });
  }
  base.pathname = base.pathname.replace(/\/+$/, "");
  return {
    baseUrl: base.toString().replace(/\/$/, ""),
    keyId: value.keyId,
    secret: value.secret,
    timeoutMs: Number.isInteger(value.timeoutMs) && value.timeoutMs > 0
      ? value.timeoutMs
      : DEFAULT_TIMEOUT_MS,
  };
};

export function createLogisticHubClient({
  config,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new LogisticHubApiError("This runtime does not provide a Fetch implementation.", {
      code: "LOGISTIC_HUB_FETCH_UNAVAILABLE",
    });
  }

  const settings = resolveConfig(config);

  async function request(path, { method = "GET", body, idempotencyKey } = {}) {
    const headers = {
      Accept: "application/json",
      "X-Integration-Key-Id": settings.keyId,
      "X-Integration-Secret": settings.secret,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    let response;
    try {
      response = await fetchImpl(`${settings.baseUrl}/api/v1/integrations${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(settings.timeoutMs),
      });
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      throw new LogisticHubApiError(
        timedOut ? "Logistic Hub request timed out." : "Logistic Hub could not be reached.",
        {
          code: timedOut ? "LOGISTIC_HUB_TIMEOUT" : "LOGISTIC_HUB_UNAVAILABLE",
          retryable: true,
        },
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new LogisticHubApiError("Logistic Hub returned a non-JSON response.", {
        status: response.status,
        code: "LOGISTIC_HUB_INVALID_RESPONSE",
        retryable: response.status >= 500,
      });
    }

    if (!response.ok || payload?.success !== true) {
      const providerError = payload?.error ?? {};
      throw new LogisticHubApiError(
        typeof providerError.message === "string"
          ? providerError.message
          : "Logistic Hub rejected the request.",
        {
          status: response.status,
          code: typeof providerError.code === "string"
            ? providerError.code
            : "LOGISTIC_HUB_REQUEST_REJECTED",
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        },
      );
    }

    if (!payload.data || typeof payload.data !== "object") {
      throw new LogisticHubApiError("Logistic Hub response is missing its data payload.", {
        status: response.status,
        code: "LOGISTIC_HUB_INVALID_RESPONSE",
      });
    }
    return payload.data;
  }

  return Object.freeze({
    createQuote(input, idempotencyKey) {
      return request("/quotes", { method: "POST", body: input, idempotencyKey });
    },
    getQuote(quoteSessionId) {
      return request(`/quotes/${encodeURIComponent(quoteSessionId)}`);
    },
    acceptQuoteOption(quoteSessionId, optionId, idempotencyKey) {
      return request(
        `/quotes/${encodeURIComponent(quoteSessionId)}/options/${encodeURIComponent(optionId)}/accept`,
        { method: "POST", body: {}, idempotencyKey },
      );
    },
    createShipment(input, idempotencyKey) {
      return request("/shipments", { method: "POST", body: input, idempotencyKey });
    },

    async uploadPackingEvidence(externalFulfillmentReference, { buffer, mimeType, originalName, slot, actorReference }, idempotencyKey) {
      const headers = {
        Accept: "application/json",
        "Content-Type": "application/octet-stream",
        "X-Integration-Key-Id": settings.keyId,
        "X-Integration-Secret": settings.secret,
        "X-File-Content-Type": mimeType,
        "X-File-Name": originalName,
        "X-Evidence-Slot": slot,
        "X-Evidence-Actor-Reference": actorReference,
        "Idempotency-Key": idempotencyKey,
      };
      let response;
      try {
        response = await fetchImpl(`${settings.baseUrl}/api/v1/integrations/shipments/by-external-reference/${encodeURIComponent(externalFulfillmentReference)}/packing-evidence`, {
          method: "POST", headers, body: buffer, redirect: "error", signal: AbortSignal.timeout(settings.timeoutMs),
        });
      } catch (error) {
        const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
        throw new LogisticHubApiError(timedOut ? "Logistic Hub evidence upload timed out." : "Logistic Hub could not be reached.", {
          code: timedOut ? "LOGISTIC_HUB_TIMEOUT" : "LOGISTIC_HUB_UNAVAILABLE", retryable: true,
        });
      }
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !payload.data) {
        const providerError = payload?.error ?? {};
        throw new LogisticHubApiError(providerError.message || "Logistic Hub rejected the evidence upload.", {
          status: response.status, code: providerError.code || "LOGISTIC_HUB_EVIDENCE_UPLOAD_FAILED",
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        });
      }
      return payload.data;
    },
    async listPackingEvidence(externalFulfillmentReference) {
      return request(`/shipments/by-external-reference/${encodeURIComponent(externalFulfillmentReference)}/packing-evidence`);
    },
    async downloadPackingEvidence(evidenceId) {
      let response;
      try {
        response = await fetchImpl(`${settings.baseUrl}/api/v1/integrations/packing-evidence/${encodeURIComponent(evidenceId)}/download`, {
          method: "GET",
          headers: {
            Accept: "application/octet-stream",
            "X-Integration-Key-Id": settings.keyId,
            "X-Integration-Secret": settings.secret,
          },
          redirect: "error",
          signal: AbortSignal.timeout(settings.timeoutMs),
        });
      } catch (error) {
        const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
        throw new LogisticHubApiError(timedOut ? "Logistic Hub evidence download timed out." : "Logistic Hub could not be reached.", {
          code: timedOut ? "LOGISTIC_HUB_TIMEOUT" : "LOGISTIC_HUB_UNAVAILABLE", retryable: true,
        });
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new LogisticHubApiError(payload?.error?.message || "Logistic Hub rejected the evidence download.", {
          status: response.status, code: payload?.error?.code || "LOGISTIC_HUB_EVIDENCE_DOWNLOAD_FAILED",
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        });
      }
      return {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: response.headers.get("content-type")?.split(";")[0] || "application/octet-stream",
        contentDisposition: response.headers.get("content-disposition") || "",
      };
    },
    async getShipmentByExternalReference(externalFulfillmentReference) {
      try {
        return await request(
          `/shipments/by-external-reference/${encodeURIComponent(externalFulfillmentReference)}`,
        );
      } catch (error) {
        if (error instanceof LogisticHubApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}
