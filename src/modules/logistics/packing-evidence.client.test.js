import test from "node:test";
import assert from "node:assert/strict";
import { createLogisticHubClient } from "./logistic-hub.client.js";

const config = {
  baseUrl: "https://hub.example.test",
  keyId: "market-key-id",
  secret: "market-secret",
  timeoutMs: 2500,
};

test("uploads packing evidence as authenticated binary with immutable slot metadata", async () => {
  let captured;
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
  const client = createLogisticHubClient({
    config,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        status: 201,
        json: async () => ({ success: true, data: { id: "evidence-1", slot: "CONTENTS_OVERVIEW", version: 1 } }),
      };
    },
  });
  const result = await client.uploadPackingEvidence("mqi/ref 1", {
    buffer, mimeType: "image/jpeg", originalName: "contents.jpg",
    slot: "CONTENTS_OVERVIEW", actorReference: "seller-1",
  }, "packing-upload-0001");

  assert.equal(result.id, "evidence-1");
  assert.equal(captured.url, "https://hub.example.test/api/v1/integrations/shipments/by-external-reference/mqi%2Fref%201/packing-evidence");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.body, buffer);
  assert.equal(captured.options.headers["Content-Type"], "application/octet-stream");
  assert.equal(captured.options.headers["X-File-Content-Type"], "image/jpeg");
  assert.equal(captured.options.headers["X-Evidence-Slot"], "CONTENTS_OVERVIEW");
  assert.equal(captured.options.headers["Idempotency-Key"], "packing-upload-0001");
});

test("lists evidence and downloads only through the shipment-scoped private endpoint", async () => {
  const calls = [];
  const bytes = Buffer.from([0xff, 0xd8, 0xff]);
  const client = createLogisticHubClient({
    config,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET" && url.endsWith("/packing-evidence")) {
        return { ok: true, status: 200, json: async () => ({ success: true, data: { evidence: [{ id: "evidence-1" }] } }) };
      }
      return {
        ok: true,
        status: 200,
        headers: {
          get: name => name === "content-type" ? "image/jpeg" : "inline",
        },
        arrayBuffer: async () => bytes,
      };
    },
  });

  const list = await client.listPackingEvidence("mqi-ref-1");
  const file = await client.downloadPackingEvidence("mqi-ref-1", "evidence-1");

  assert.equal(list.evidence[0].id, "evidence-1");
  assert.equal(calls[1].url, "https://hub.example.test/api/v1/integrations/shipments/by-external-reference/mqi-ref-1/packing-evidence/evidence-1/download");
  assert.deepEqual(file.buffer, bytes);
  assert.equal(file.mimeType, "image/jpeg");
});
