# Cart and Stripe test checkout

REWILD has a persistent guest bag, hosted Stripe test checkout, signed webhooks, order snapshots, and inventory reservations. It cannot accept live API keys or real payments. Product imagery and merchandise are fictional; fulfillment, taxes, customer accounts, and refunds are outside the test checkout flow.

## Connect locally

1. In your Stripe test account or sandbox, obtain a server-side test key. A restricted key (`rk_test_…`) with the required Checkout/product/price/payment permissions is preferable; a test secret key (`sk_test_…`) also works. Put `STRIPE_SECRET_KEY=…` in **ignored** `backend/.env`. Do not paste it into chat, frontend variables, source, or command arguments.
2. Set `STORE_URL=http://localhost:5173` in that same file. Use this exact origin for the storefront; it controls Stripe's return URLs. No publishable key is needed for a redirect to hosted Checkout.
3. Run `stripe login` with the official Stripe CLI if needed, selecting the **same account/sandbox as the API key**. Run `npm run stripe:listen` in a terminal and keep it running. The helper forwards the relevant Checkout events to `http://127.0.0.1:3000/api/stripe/webhook` and saves its signing secret in `backend/.env` without printing it.
4. Load the new configuration: `docker compose up --build -d --wait`. After later key/listener-secret changes, recreate the backend with `docker compose up -d --force-recreate backend`. Native development loads `backend/.env` on startup; restart the API after changes.
5. Open `http://localhost:5173`, add products, and choose **Test checkout**. If either server key or webhook secret is absent, the bag stays usable and checkout is explicitly disabled.

Use Stripe's test card `4242 4242 4242 4242`, any future expiry and three-digit CVC, with fictional contact/address data. Stripe documents a decline card (`4000 0000 0000 0002`) and authentication test cards for further scenarios. Do not use real card details. [Stripe testing documentation](https://docs.stripe.com/testing).

The existing CLI login is separate from the application's server API key. A working `stripe get /v1/account` or webhook listener does not by itself configure the app. The CLI helper does not extract or copy the CLI's credentials.

## API contracts

| Route | Contract |
| --- | --- |
| `POST /api/cart` | `{items: [{productId, quantity}]}`. Returns current products, stock limits, per-line issues, server totals, a quote fingerprint, and checkout availability. At most 20 distinct products; quantity 1–10 per product. Unknown client price/total fields and duplicate IDs are rejected. |
| `GET /api/checkout/config` | Whether checkout is configured, always `testMode: true`. |
| `POST /api/checkout` | `{items, fingerprint, attemptId}`. Requotes the database, rejects changes, reserves stock, creates an immutable order snapshot and an idempotent hosted session. Returns Stripe URL, order ID, and an opaque guest access token. |
| `GET /api/checkout/:id` | Requires `Authorization: Bearer <guest token>`. Verifies current Stripe status and returns a minimal receipt/state. No email, address, card data, Stripe secret, or database internals. |
| `POST /api/checkout/:id/cancel` | Same token; expires an open Stripe session, then releases inventory after verifying expiry. A completed payment is reconciled as paid. |
| `POST /api/stripe/webhook` | Exact raw body, verified Stripe signature, test events only. Handles completion, expiry, and asynchronous success. Retrieves current session state to tolerate stale event payloads. |

The staff workspace at `/studio/orders` reads recorded REWILD test orders through `GET /api/admin/orders`. It shows line items and the latest payment status recorded by the checkout service. The response excludes guest access tokens and Stripe session identifiers. See the [staff workspace setup](../README.md#staff-workspace-and-catalog).

Return URLs include the guest capability token. Treat them as private receipt links and do not put full query strings into analytics/logs. The token is hashed for lookup; the original is retained privately for deterministic return URLs and checkout retry. No customer contact/address/card data is stored by REWILD. Stripe holds the test checkout details.

Cart/checkout responses are uncached. JSON content-type, allowed-origin checks, bounded input, and request limits protect local routes. These controls do not provide user authentication. All checkout creation and verification is on the server; a success URL alone never clears the bag or marks an order paid.

## Inventory and interruption recovery

- `inventory` is available-to-sell stock. An atomic product update decrements it and embeds a `{orderId, quantity}` hold, conditional on status, quoted price, and enough stock. The same update increments the product edit version, preventing a stale studio save from overwriting a reservation.
- Multi-product reservation is a compensating workflow, not an all-or-nothing database transaction. If one line cannot reserve, previously held lines are released. Each release matches/removes its hold and increments stock in the same atomic update, so retries cannot restock twice.
- A paid session commits already-deducted stock by removing holds. Duplicate webhooks and repeated landing-page checks cannot deduct again. Stripe's current state, expected amount, currency, mode, session ID, and order metadata are checked before finalizing.
- Checkout sessions expire after about 35 minutes. Cancellation expires the actual Stripe session before releasing stock. The background recovery loop also verifies open sessions and releases expired holds if no browser returns or webhook arrives.
- Session creation uses frozen parameters and the order ID as the Stripe idempotency key. A lost response keeps holds; retries recover the same session. A lease prevents routine simultaneous creation work. Initial definitive Stripe validation/authentication failures compensate; authentication failure after an ambiguous earlier attempt keeps stock held until verification is possible.
- A recovery loop runs at startup and every 30 seconds, handling up to 50 pending orders per pass. Orders persist across server restarts. Never delete orders/holds or blindly release by wall clock: a payment may already have happened. If a session remains ambiguous outside Stripe's idempotency retention window, recovery fails closed for owner review rather than risking a second session or overselling. Recover the original Stripe session from Dashboard request logs/metadata before resolving it.

The local standalone MongoDB setup is supported without a replica set. Production would need a durable job runner, operational reconciliation/alerts, distributed rate limiting, capacity planning, tax/shipping configuration, real authenticated management, and a deliberate live-payment review. The current app rejects live keys even with `NODE_ENV=production`.

## Browser behavior

The bag is saved locally as validated product IDs and quantities; totals always come from the API. The drawer keeps checkout visible while its items scroll, uses native modal focus behavior, and respects reduced motion. Quantity controls enforce known limits; server issues handle changes and unavailable products. Failed quote/checkout requests offer recovery without dropping the bag.

A checkout attempt is retained in session storage (with an in-memory fallback) before the network request, so retrying/reopening does not create a fresh session accidentally. An existing session can be resumed at its original prices, or released explicitly before editing. Confirmed purchased quantities are subtracted once; other products and additional quantities remain in the bag. Browser storage restrictions can prevent persistence across a full browser restart.

## Validation

`TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm run check` runs frontend interaction/reducer tests and API integration tests against a uniquely named disposable database. Payment integration tests use a deterministic Stripe transport and real SDK signature verification; they do not create real Stripe sessions. They cover price tampering, stock races, cancellation, repeated/stale events, failed creation compensation, and ambiguous-request recovery. Browser QA covers the real native dialog, keyboard/Escape/focus, persistence, responsive layouts, flip controls, and guide popup.

A full hosted test-card payment still requires the application's test key and matching listener configuration. Record that separately from mocked transport test results; never claim a simulated unit/integration test proves an actual hosted payment succeeded.
