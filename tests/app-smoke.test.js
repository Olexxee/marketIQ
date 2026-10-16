import test from "node:test";
import assert from "node:assert/strict";

test("API application and all mounted routers import successfully", async () => {
  process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/marketiq_ci";
  process.env.JWT_ACCESS_SECRET ??= "test-access-secret-for-ci";
  process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-for-ci";

  const { default: app } = await import("../src/app.js");
  assert.equal(typeof app, "function");
  assert.equal(typeof app.listen, "function");
});
