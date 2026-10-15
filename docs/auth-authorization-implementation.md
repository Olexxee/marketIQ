# Authentication and authorization hardening

## Included in this branch

- CORS uses an explicit origin allowlist instead of reflecting every requesting origin.
- Requests with a browser `Origin` header are rejected unless the origin is in `CORS_ORIGINS`. Requests without an Origin header remain supported for native clients and server-to-server requests.
- Production startup fails when `CORS_ORIGINS` is not configured.
- Seller product, variant, and inventory endpoints require a seller profile in `ACTIVE` status. Seller context is still resolved from the authenticated user's ID, never from a caller-supplied seller ID.
- Refresh-token rotation conditionally revokes only an unrevoked token and verifies exactly one row was revoked. Concurrent reuse cannot issue multiple replacement tokens.
- Adds focused Node.js built-in tests for origin checks and authorization middleware.

## Required environment configuration

Set `CORS_ORIGINS` to a comma-separated list of exact trusted frontend origins, including scheme and port when applicable. Example:

```env
CORS_ORIGINS=https://marketiq-storefront.example,https://marketiq.example
```

Do not include paths or trailing slashes. Add local origins only in development or when they are genuinely trusted.

The refresh cookie remains HttpOnly and scoped to `/api/auth`. Production currently uses `Secure` and `SameSite=None` to support a cross-origin frontend; the strict origin allowlist is therefore required.

## Deliberately not enabled in this change

- Market activity, market signals, and market intelligence routes remain unmounted until their access policy is defined.
- Google OAuth, email verification, password recovery, and profile editing are not exposed as placeholder routes. They require schema migrations, provider configuration, and their own tests.
- This branch does not change existing user passwords or mark existing accounts as email-verified.

## Verification

Run `npm test`. These tests use Node's built-in test runner and do not require a live database. Run `npx prisma validate` and the project's integration tests in the repository environment before merging.
