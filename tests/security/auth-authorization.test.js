import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/marketiq_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-with-sufficient-length";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-with-sufficient-length";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGINS = "https://storefront.example.test,http://localhost:5173";

const [{ enforceTrustedOrigin }, { requireActiveSeller }, { authorize }, { requireVerifiedEmail }] =
  await Promise.all([
    import("../src/middlewares/trustedOrigin.js"),
    import("../src/middlewares/seller.middleware.js"),
    import("../src/middlewares/authorize.js"),
    import("../src/middlewares/requireVerifiedEmail.js"),
  ]);

const invoke = (middleware, req) => {
  let error = null;
  let continued = false;
  middleware(req, {}, (nextError) => {
    error = nextError || null;
    continued = !nextError;
  });
  return { error, continued };
};

test("trusted origin middleware allows a configured frontend", () => {
  const result = invoke(enforceTrustedOrigin, {
    get: (header) => (header === "Origin" ? "https://storefront.example.test" : undefined),
  });
  assert.equal(result.error, null);
  assert.equal(result.continued, true);
});

test("trusted origin middleware rejects an unconfigured browser origin", () => {
  const result = invoke(enforceTrustedOrigin, {
    get: (header) => (header === "Origin" ? "https://attacker.example" : undefined),
  });
  assert.equal(result.continued, false);
  assert.equal(result.error.statusCode, 403);
});

test("trusted origin middleware permits requests without Origin for native clients", () => {
  const result = invoke(enforceTrustedOrigin, { get: () => undefined });
  assert.equal(result.error, null);
  assert.equal(result.continued, true);
});

test("seller operations reject profiles that are not active", () => {
  const result = invoke(requireActiveSeller, { seller: { id: "seller-1", status: "PENDING" } });
  assert.equal(result.continued, false);
  assert.equal(result.error.statusCode, 403);
});

test("seller operations accept active seller profiles", () => {
  const result = invoke(requireActiveSeller, { seller: { id: "seller-1", status: "ACTIVE" } });
  assert.equal(result.error, null);
  assert.equal(result.continued, true);
});

test("role authorization rejects missing user context", () => {
  const result = invoke(authorize("ADMIN"), {});
  assert.equal(result.continued, false);
  assert.equal(result.error.statusCode, 403);
});

test("role authorization rejects users outside the allowed roles", () => {
  const result = invoke(authorize("ADMIN"), { user: { id: "user-1", role: "USER" } });
  assert.equal(result.continued, false);
  assert.equal(result.error.statusCode, 403);
});

test("verified-email middleware rejects users who have not verified their email", () => {
  const result = invoke(requireVerifiedEmail, { auth: { user: { emailVerifiedAt: null } } });
  assert.equal(result.continued, false);
  assert.equal(result.error.statusCode, 403);
});

test("verified-email middleware allows verified users", () => {
  const result = invoke(requireVerifiedEmail, { auth: { user: { emailVerifiedAt: new Date() } } });
  assert.equal(result.error, null);
  assert.equal(result.continued, true);
});
