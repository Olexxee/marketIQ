import test from "node:test";
import assert from "node:assert/strict";
import { recordPublicMarketActivitySchema } from "./marketActivity.validation.js";

const cuid = "c123456789012345678901234";

test("accepts a product view with a product reference", () => {
  const result = recordPublicMarketActivitySchema.safeParse({
    activityType: "PRODUCT_VIEW",
    productId: cuid,
  });

  assert.equal(result.success, true);
});

test("requires the target field for each discovery event", () => {
  assert.equal(
    recordPublicMarketActivitySchema.safeParse({ activityType: "PRODUCT_VIEW" }).success,
    false,
  );
  assert.equal(
    recordPublicMarketActivitySchema.safeParse({ activityType: "CATEGORY_VIEW" }).success,
    false,
  );
  assert.equal(
    recordPublicMarketActivitySchema.safeParse({ activityType: "SELLER_VIEW" }).success,
    false,
  );
  assert.equal(
    recordPublicMarketActivitySchema.safeParse({ activityType: "PRODUCT_SEARCH" }).success,
    false,
  );
});

test("rejects commerce event types on the public discovery endpoint", () => {
  const result = recordPublicMarketActivitySchema.safeParse({
    activityType: "ORDER_COMPLETED",
  });

  assert.equal(result.success, false);
});

test("rejects client-supplied actor IDs and arbitrary metadata", () => {
  const result = recordPublicMarketActivitySchema.safeParse({
    activityType: "PRODUCT_VIEW",
    productId: cuid,
    userId: cuid,
    metadata: { email: "buyer@example.com" },
  });

  assert.equal(result.success, false);
});

test("normalizes and bounds search terms", () => {
  const result = recordPublicMarketActivitySchema.safeParse({
    activityType: "PRODUCT_SEARCH",
    searchTerm: "  cotton   fabric  ",
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.searchTerm, "cotton fabric");
});
