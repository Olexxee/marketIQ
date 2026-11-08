import test from "node:test";
import assert from "node:assert/strict";
import { LogisticHubApiError } from "./logistic-hub.client.js";
import { sendCustodyAwareShipmentResolution } from "./shipment-resolution.processor.js";

const input = {
  externalReference: "mqi-fulfilment-1",
  reason: "Buyer cancellation request",
  requestId: "resolution-1",
};

test("confirms a stop without issuing a return command when Hub accepts the stop", async () => {
  const calls = [];
  const result = await sendCustodyAwareShipmentResolution({
    ...input,
    client: {
      stopShipment: async (...args) => { calls.push(["stop", ...args]); return { status: "STOPPED" }; },
      requestShipmentReturn: async (...args) => { calls.push(["return", ...args]); },
    },
  });
  assert.equal(result.status, "STOP_CONFIRMED");
  assert.deepEqual(calls, [["stop", input.externalReference, input.reason, "mqi-stop-resolution-1-v1"]]);
});

test("falls back to a return request only when Hub explicitly reports custody", async () => {
  const calls = [];
  const result = await sendCustodyAwareShipmentResolution({
    ...input,
    client: {
      stopShipment: async (...args) => {
        calls.push(["stop", ...args]);
        throw new LogisticHubApiError("Parcel is in custody", {
          status: 409,
          code: "INTEGRATION_SHIPMENT_IN_CUSTODY_USE_RETURN",
        });
      },
      requestShipmentReturn: async (...args) => {
        calls.push(["return", ...args]);
        return { status: "RETURN_REQUESTED", physicalReturnConfirmed: false };
      },
    },
  });
  assert.equal(result.status, "RETURN_REQUESTED");
  assert.equal(result.response.physicalReturnConfirmed, false);
  assert.deepEqual(calls, [
    ["stop", input.externalReference, input.reason, "mqi-stop-resolution-1-v1"],
    ["return", input.externalReference, input.reason, "mqi-return-resolution-1-v1"],
  ]);
});

test("does not convert unrelated Hub conflicts into return requests", async () => {
  let returnCalls = 0;
  await assert.rejects(
    sendCustodyAwareShipmentResolution({
      ...input,
      client: {
        stopShipment: async () => {
          throw new LogisticHubApiError("Shipment terminal", {
            status: 409,
            code: "INTEGRATION_SHIPMENT_TERMINAL",
          });
        },
        requestShipmentReturn: async () => { returnCalls += 1; },
      },
    }),
    error => error.code === "INTEGRATION_SHIPMENT_TERMINAL",
  );
  assert.equal(returnCalls, 0);
});

test("rejects a return acknowledgement that implies physical return", async () => {
  await assert.rejects(
    sendCustodyAwareShipmentResolution({
      ...input,
      client: {
        stopShipment: async () => {
          throw new LogisticHubApiError("Parcel is in custody", {
            status: 409,
            code: "INTEGRATION_SHIPMENT_STOP_WINDOW_CLOSED",
          });
        },
        requestShipmentReturn: async () => ({ status: "RETURN_REQUESTED", physicalReturnConfirmed: true }),
      },
    }),
    error => error.code === "INVALID_SHIPMENT_RETURN_RESPONSE",
  );
});
