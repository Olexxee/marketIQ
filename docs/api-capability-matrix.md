# MarketIQ API Capability Matrix

**Status:** Phase 0 — repository audit baseline  
**Audited:** 2026-10-15  
**Backend:** `Olexxee/marketIQ` (Express 5, JavaScript ESM, Prisma/PostgreSQL)  
**Frontend:** `Olexxee/marketIQ-storefront` (React/Vite)

This document records capabilities visible in the repository's route registration and route handlers. “Implemented in module” does **not** mean the endpoint is reachable: the router must also be mounted in `src/app.js`. Verify all contracts against a running backend and integration tests before treating them as production-ready.

## Status key

- **Available:** router is mounted and a corresponding route is present in source.
- **Partial:** a route exists, but the complete product flow or a required capability is missing/unverified.
- **Blocked:** a module exists but is not mounted, or the required endpoint/capability was not found in the audited routes.
- **Needs verification:** route exists, but response shape, access policy, production behavior, or test coverage must be confirmed.

## Capability matrix

| Product capability | Current backend surface | Access / policy found in routes | Frontend status | Assessment / action |
|---|---|---|---|---|
| API health | `GET /api/` | Public | Not used as an explicit health check | Available. Use for deployment smoke test. |
| Register | `POST /api/auth/register` | Public; Zod body validation | No registration screen/API method | Partial. Implement UI after auth contract and token handling are confirmed. |
| Email/password login | `POST /api/auth/login` | Public; Zod body validation | No sign-in screen/API method | Partial. Confirm access-token delivery and refresh behavior. |
| Refresh session | `POST /api/auth/refresh` | Refresh cookie read by controller | API helper sends credentials, but no refresh flow | Partial. Add centralized refresh/session restoration and failure handling. |
| Logout | `POST /api/auth/logout` | Refresh cookie | No UI integration | Partial. |
| Logout all devices | `POST /api/auth/logout-all` | Authenticated | No UI integration | Partial. |
| Current user | `GET /api/auth/me` | Authenticated | No session state/provider | Partial. |
| Google sign-in | No route found in auth router | — | Not implemented | Blocked. Requires OAuth design, server-side token validation, account-linking policy, and tests. |
| Email verification | No route found in auth router | — | Not implemented | Blocked. |
| Forgot/reset password | No route found in auth router | — | Not implemented | Blocked. |
| Account profile editing | No user profile update route found in audited auth router | — | Not implemented | Blocked; decide fields and ownership policy. |
| Public product listing | `GET /api/products` | Public; validated query | Used by home/product discovery | Available. Query supports `sellerId`, `search`, `categoryId`, `brandId`, `collectionId`, `page`, `limit`. Confirm response and price/media shape. |
| Product details | `GET /api/products/:id` | Public; validated ID | Product detail route exists in frontend | Available; verify all displayed fields and not-found behavior. |
| Public variants | `GET /api/products/:productId/variants` | Public; validated product ID | Not yet integrated | Available; verify stock/price exposure. |
| Categories list/tree/detail | `GET /api/categories`, `GET /api/categories/tree`, `GET /api/categories/:id` | Public reads | Used for home category tiles; category filtering is wired | Available. Ensure category query parameters match the validation schema. |
| Category administration | `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` | ADMIN/STAFF create/update; ADMIN delete | No admin UI | Backend capability available; admin experience not implemented. |
| Brands / collections | Public list/detail; ADMIN/STAFF writes; ADMIN deletes | Public reads, privileged writes | No dedicated UI | Partial. Verify filtering and product associations. |
| Public seller directory | `GET /api/sellers/directory` | Public; supports search, trade capability, pagination | Used on home page; directory route exists | Available. Verify pagination metadata and card field mapping. |
| Public seller storefront | `GET /api/sellers/:id/storefront` | Public | Storefront route exists | Available. Verify returned product collection and seller location fields. |
| Seller onboarding | `POST /api/sellers/onboard` | Authenticated; validated body | No onboarding UI | Partial. Define pending/active/suspended states and empty/error states. |
| Seller profile / locations | `GET/PATCH /api/sellers/me`; `GET/POST /api/sellers/locations`; `GET/PATCH/DELETE /api/sellers/locations/:id` | Authenticated; seller guard on seller routes | No seller workspace | Partial. Test that seller ownership is enforced for every location ID. |
| Seller product management | `/api/seller/products` GET/POST; `/api/seller/products/:id` GET/PATCH/DELETE | Authenticated seller; media upload processing | No seller catalog UI | Partial. Test ownership, active seller requirement, upload failure, and draft/active status. |
| Seller variants | `/api/seller/products/:productId/variants`; `/api/seller/variants/:id` | Authenticated seller | No seller variant UI | Partial. Verify seller ownership and inventory coupling. |
| Cart | `GET/POST /api/cart`; `PATCH/DELETE /api/cart/items/:id`; `DELETE /api/cart` | Authenticated | Cart is a placeholder; Add-to-cart currently does not persist | Backend routes available. Wire UI and test current price vs snapshot, inactive products/sellers, and available inventory. |
| Checkout / order creation | `POST /api/checkout` | Authenticated; validated body | No working checkout | Partial. Test transaction boundaries, stock reservation, price changes, seller splitting, and idempotency. |
| Buyer orders | `GET /api/order`, `GET /api/order/:id`, `POST /api/order/:id/cancel`, `POST /api/order/:id/confirm` | Authenticated | No orders UI | Partial. Verify buyer ownership and allowed state transitions. |
| Seller order management | Router source: `src/modules/orders/order.seller.routes.js` | Authenticated seller in router | No seller orders UI | **Blocked at app registration:** router is not imported/mounted in audited `src/app.js`. Mount only after path/permission review and tests. |
| Payments | Payment router is mounted at `/api/checkout`, so its routes resolve to `POST /api/checkout/initiate`, `GET /api/checkout/verify/:reference`, `GET /api/checkout/order/:orderId` | Authenticated | No payment flow | Partial and path naming is inconsistent with webhook `POST /api/payments/webhook`. Decide canonical paths before frontend integration. |
| Paystack webhook | `POST /api/payments/webhook` | Public provider callback; raw body is parsed before JSON middleware | Not integrated in UI | Route registered. Verify signature validation, replay/idempotency, event handling, and order/payment reconciliation. |
| Fulfillment | Router source: `src/modules/fulfillment/fulfillment.routes.js` | Authenticated seller in module | No fulfillment UI | **Blocked at app registration:** router is not imported/mounted in audited `src/app.js`. The seller-order nested router also needs mounting under a deliberate path. |
| Inventory | `/api/seller/inventory` router is mounted | Authenticated seller | No inventory UI | Available at router level. Verify exact routes, location ownership, reserved quantity, and ledger consistency. |
| Location hierarchy | `GET /api/locations/countries`, country detail, states by country, state detail, LGAs by state, LGA detail, cities by LGA, city detail | Public reads | No location selector integration | Available. Build dependent selectors using IDs from this API; do not hardcode runtime geography. |
| Market activity | Router source: `src/modules/market-activity/marketActivity.routes.js` | Authenticated for record/list; comments say inspection is admin/intelligence | Not surfaced in UI | **Blocked at app registration:** router not mounted in audited `src/app.js`. Once mounted, tighten read authorization; authenticated-only may be too broad for activity inspection. |
| Market signals | Router source: `src/modules/market-signals/marketSignal.routes.js` | ADMIN/STAFF guard in router | No intelligence UI | **Blocked at app registration:** router not mounted in audited `src/app.js`. Also review relative import extensions before runtime tests. |
| Market intelligence | Router source: `src/modules/market-intelligence/marketIntelligence.routes.js` | No authentication/authorization middleware in the inspected router | No intelligence UI | **Blocked / security review required:** router is not mounted, and must not be exposed until access policy is explicit. |
| AI interpretation | Prisma model stores interpretation metadata and narrative fields | No dedicated public route found in audited route list | Not implemented | Later phase. Must be grounded in stored metrics/evidence and disclose freshness, model/prompt version, and uncertainty. |
| Wishlist/favorites | Prisma models and activity enum exist | No wishlist router found in app registration | Not integrated | Blocked for UI; inventory model is not proof of usable endpoints. |
| Admin user/seller moderation | Roles/status fields exist in schema; no complete admin route set found in app registration | — | No admin UI | Blocked / requires scope and route audit. |
| Notifications | Notification models exist in schema | No notification router found in app registration | Not implemented | Later phase unless required for verification/payment/order lifecycle. |
| Search analytics / geography / trends dashboards | Data models and signal/intelligence modules exist | Signal routes currently not mounted; intelligence route has no visible guard | Not implemented | Blocked until ingestion, aggregation, access control, and evidence contracts are verified. |

## Critical integration findings

1. **Several routers exist but are not registered in `src/app.js`:** seller orders, fulfillment, market activity, market signals, and market intelligence. Their source files alone do not make their endpoints available.
2. **Payment base path is inconsistent:** `paymentRouter` is mounted at `/api/checkout`, while the webhook is at `/api/payments/webhook`. Choose and document one canonical payment namespace before writing frontend payment code.
3. **Market intelligence needs access control before mounting.** The inspected router contains no authentication or role guard. Do not expose it publicly by simply adding an `app.use`.
4. **The frontend currently has no centralized authenticated session layer.** Its `apiRequest` helper sends cookies but no bearer token and does not implement refresh/retry. Confirm the backend's access-token delivery before standardizing the client.
5. **Google OAuth, email verification, password recovery, and account profile editing are not present in the inspected auth routes.** These are requirements gaps, not frontend-only tasks.
6. **Cart, checkout, payment, orders, seller operations, and intelligence are not complete end-to-end user experiences** even where backend modules exist.
7. **Response contracts need integration tests.** Frontend helpers currently unwrap common `data/items/products/categories/sellers` shapes; validate actual success/error envelopes, pagination, product media, variants, and prices against live responses.

## Recommended implementation sequence

This order is dependency-driven; do not build UI pages until the relevant contract and acceptance criteria are confirmed.

1. **Resolve API registration and security gaps**
   - Decide canonical payment paths.
   - Mount seller-order and fulfillment routers under explicit seller paths.
   - Mount activity and signal routers only after access policy is tested.
   - Add explicit authorization to market intelligence before mounting it.
   - Add route-level integration tests for 401/403, ownership, validation, not-found, and success responses.
2. **Publish the API contract**
   - Ensure OpenAPI matches registered routes, request schemas, response envelopes, pagination, and auth requirements.
   - Add/verify schemas for every public endpoint the frontend will consume.
3. **Finalize authentication contract**
   - Document access-token transport, refresh-cookie lifecycle, CORS/CSRF posture, logout, and expired-session behavior.
   - Specify Google sign-in, email verification, password reset, and account linking before implementation.
4. **Integrate the existing public marketplace**
   - Verify product/category/seller response shapes.
   - Add automated contract tests and correct query/field mismatches.
   - Replace placeholder product-detail/cart actions only when the corresponding flows are testable.
5. **Implement authenticated commerce**
   - Cart → checkout/order creation → payment initialization/verification/webhook → orders → seller fulfillment.
   - Preserve server-authoritative prices, stock reservations, transaction safety, and idempotency.
6. **Implement initial intelligence**
   - Activity ingestion/outbox → deterministic signal generation → evidence-backed intelligence.
   - Add authenticated APIs and visibility rules before dashboard UI.
7. **Add the design-token and component foundation, then page implementation**
   - Light/dark tokens, typography, layout primitives, form and feedback states, accessibility, responsive behavior.

## Acceptance criteria for this audit

- [ ] Every capability is labeled as mounted, module-only, or missing.
- [ ] Every route has a documented HTTP method, base path, access policy, validation, and response example in OpenAPI.
- [ ] Every frontend-consumed endpoint has a contract test.
- [ ] Seller and buyer ownership boundaries have positive and negative tests.
- [ ] Payment webhook signature verification and duplicate-event handling are tested.
- [ ] Sensitive market activity/intelligence endpoints are not exposed without explicit authorization.
- [ ] API path decisions are documented before frontend integration.

## Source files reviewed

- Backend route registration: [`src/app.js`](../src/app.js)
- Authentication routes: [`src/modules/auth/auth.routes.js`](../src/modules/auth/auth.routes.js)
- Product routes/validation: [`src/modules/products/product.routes.js`](../src/modules/products/product.routes.js), [`src/modules/products/product.validation.js`](../src/modules/products/product.validation.js)
- Seller routes: [`src/modules/sellers/seller.public.routes.js`](../src/modules/sellers/seller.public.routes.js), [`src/modules/sellers/seller.routes.js`](../src/modules/sellers/seller.routes.js)
- Cart and checkout routes: [`src/modules/cart/cart.routes.js`](../src/modules/cart/cart.routes.js), [`src/modules/checkout/checkout.routes.js`](../src/modules/checkout/checkout.routes.js)
- Orders and payments: [`src/modules/orders/order.routes.js`](../src/modules/orders/order.routes.js), [`src/modules/orders/order.seller.routes.js`](../src/modules/orders/order.seller.routes.js), [`src/modules/payments/payment.routes.js`](../src/modules/payments/payment.routes.js)
- Fulfillment and intelligence routes: [`src/modules/fulfillment/fulfillment.routes.js`](../src/modules/fulfillment/fulfillment.routes.js), [`src/modules/market-activity/marketActivity.routes.js`](../src/modules/market-activity/marketActivity.routes.js), [`src/modules/market-signals/marketSignal.routes.js`](../src/modules/market-signals/marketSignal.routes.js), [`src/modules/market-intelligence/marketIntelligence.routes.js`](../src/modules/market-intelligence/marketIntelligence.routes.js)
- Frontend API client: [`marketIQ-storefront/src/lib/api.js`](https://github.com/Olexxee/marketIQ-storefront/blob/main/src/lib/api.js)
