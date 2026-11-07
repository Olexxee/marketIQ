import test from "node:test";
import assert from "node:assert/strict";
import { createLogisticsTrackingRepository } from "./logistics-tracking.db.js";

test("tracking lookup is scoped to the authenticated buyer and Logistic Hub provider", async () => {
  let captured;
  const repository = createLogisticsTrackingRepository({
    prismaClient: {
      logisticsShipment: {
        findFirst: async args => { captured = args; return null; },
      },
    },
  });

  await repository.findOwnedLogisticsShipmentTracking("seller-order-1", "buyer-1");
  assert.deepEqual(captured.where, {
    sellerOrderId: "seller-order-1",
    provider: { code: "LOGISTIC_HUB" },
    sellerOrder: { order: { buyerId: "buyer-1" } },
  });
  assert.deepEqual(captured.events.orderBy, { sequence: "asc" });
});
