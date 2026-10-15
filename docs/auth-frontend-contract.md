# MarketIQ authentication contract for frontend integration

Base path: `/api/auth`. JSON responses use `{ success, message, data }`. Access tokens are returned as `data.accessToken` and must be held in memory, not localStorage or sessionStorage. The refresh token is an HttpOnly cookie and must never be read by JavaScript. Use credentialed requests (`credentials: "include"` or Axios `withCredentials: true`).

## Endpoints

| Method | Path | Auth | Request | Result |
|---|---|---|---|---|
| POST | `/register` | Public | `{ fullName, email, phone?, password }` | `data.user`, `data.accessToken`; sets refresh cookie and sends verification email |
| POST | `/login` | Public | `{ email, password }` | User + access token; sets refresh cookie |
| POST | `/google` | Public | `{ idToken }` | Google sign-in; new Google-only users are created with verified email |
| POST | `/refresh` | Cookie | No body | Rotates cookie and returns fresh access token/user |
| POST | `/logout` | Cookie | No body | Revokes current refresh token and clears cookie |
| POST | `/logout-all` | Bearer | No body | Revokes all refresh sessions and clears current cookie |
| GET | `/me` | Bearer | No body | Current sanitized user |
| POST | `/verify-email` | Public | `{ token }` | Consumes one-time verification token |
| POST | `/resend-verification` | Public | `{ email }` | Generic success response |
| POST | `/forgot-password` | Public | `{ email }` | Generic success response |
| POST | `/reset-password` | Public | `{ token, password }` | Consumes token and revokes all refresh sessions |
| POST | `/change-password` | Bearer | `{ currentPassword, newPassword }` | Changes password, revokes refresh sessions; user signs in again |
| PATCH | `/profile` | Bearer | `{ fullName?, phone? }` | Updated sanitized user |
| POST | `/google/link` | Bearer | `{ idToken }` | Links only if verified Google email matches signed-in account |
| DELETE | `/google/link` | Bearer | No body | Unlinks Google if a local password exists |

## Session lifecycle

1. On app startup, call `POST /api/auth/refresh` with credentials. If it succeeds, store `data.accessToken` in memory and set the user from `data.user`. If it fails with 401, set the session to signed out.
2. Attach `Authorization: Bearer <accessToken>` to protected API requests.
3. On a 401, coordinate a single refresh request across concurrent requests. Retry the original request no more than once. Do not refresh on 403.
4. On sign-in/register/Google success, set the in-memory access token and user from `data`.
5. On logout or password change/reset, clear the in-memory access token and user immediately.
6. On a 403 with the message to verify email, route to the verification notice and offer resend verification.

## User fields

`id`, `fullName`, `email`, `phone`, `role` (`USER | STAFF | ADMIN`), `status`, `emailVerifiedAt` (nullable), `createdAt`, `updatedAt`, and nullable limited `sellerProfile: { id, businessName, status }`. Passwords, OAuth subjects, token hashes and refresh tokens are never returned.

## Environment required for production

- `CORS_ORIGINS`: comma-separated exact browser origins (scheme + host + optional port, no path).
- `FRONTEND_URL`: HTTPS origin used to build verification/reset links.
- `RESEND_API_KEY` and `EMAIL_FROM`: transactional email delivery.
- `GOOGLE_CLIENT_ID`: Google ID-token audience for Google sign-in/linking.
- Keep JWT secrets server-side. Configure Google OAuth's authorized JavaScript origin to match the frontend.

## Verification and access rules

- Email verification and password-reset tokens are cryptographically random, hashed in the database, expiring, and single-use.
- Existing accounts are not automatically marked verified by the migration.
- Checkout, seller onboarding/account changes, product/variant publishing, and inventory mutations require a verified email.
- Google identity is keyed by provider + provider subject. Existing accounts are not silently linked by matching email.
- Frontend route guards improve UX only; backend middleware remains authoritative.
