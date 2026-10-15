import test from "node:test";
import assert from "node:assert/strict";

const { productIdParamSchema } = await import("../../../src/modules/wishlist/wishlist.validation.js");

test("wishlist product parameter accepts a CUID", () => {
  const result = productIdParamSchema.safeParse({ productId: "clh7k2x9a0000qwerty123456" });
  assert.equal(result.success, true);
});

test("wishlist product parameter rejects missing or malformed identifiers", () => {
  assert.equal(productIdParamSchema.safeParse({}).success, false);
  assert.equal(productIdParamSchema.safeParse({ productId: "not-an-id" }).success, false);
  assert.equal(productIdParamSchema.safeParse({ productId: "clh7k2x9a0000qwerty123456", extra: true }).success, false);
});
