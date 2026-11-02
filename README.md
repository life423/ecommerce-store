# REWILD — small beginnings, good things

An original small-space gardening e-commerce portfolio concept built with React, TypeScript, Tailwind, Express, and MongoDB. The catalog, product pages, guest bag, test-checkout integration, and local product studio are functional. Connect a Stripe server test key and webhook listener to enable hosted checkout. Accounts and live payments are future work. All sample products and product imagery are fictional.

## Local development

Use Node 24 (at least 24.15) and npm 11. With nvm, run `nvm install` and `nvm use` from this directory.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The API listens on http://127.0.0.1:3000. Both processes reload on source changes; Ctrl+C stops both. Ports are strict, so startup fails clearly if another process is using them. Run commands from the repository root; there is one root lockfile for both workspaces.

MongoDB is required for the catalog. Without `MONGO_URI`, the health endpoints still run, but catalog requests return a clear `503` instead of silently using fake data. To connect a local database:

```sh
npm run db:up
cp backend/.env.example backend/.env
```

Uncomment `MONGO_URI` in `backend/.env`, run `npm run seed`, then restart `npm run dev`. The example also enables the local product studio at http://localhost:5173/studio. The API validates its configuration and refuses startup when a configured database cannot be reached. `npm run db:down` stops MongoDB without deleting data. Keep real credentials in ignored `.env` files; never put secrets in frontend variables or client code.

## Checks

```sh
npm run check
npm audit
npm audit --omit=dev
```

`check` runs lint, API and model tests, frontend catalog/editor tests, TypeScript checks, and a production frontend build. The real MongoDB integration suite runs when `TEST_MONGO_URI` is set: `TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm run check`. It creates and removes a uniquely named test database; it never resets the application database. Without that variable the integration suite is explicitly skipped. CI supplies MongoDB and the variable. `npm test`, `npm run lint`, and `npm run build` are also available individually. CI runs these checks and audits production dependencies.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Liveness: `200` with `{ "status": "ok", "service": "store-api" }`. |
| `GET /api/ready` | Readiness: `200` when MongoDB is connected or optional/unconfigured; `503` if a configured connection is lost. Includes `database: connected`, `disabled`, or `disconnected`. |

Unknown routes return JSON `404` errors. JSON bodies are limited to 16 KB; invalid JSON returns `400`, oversized bodies return `413`, and unexpected failures use a generic `500` response. The API applies Helmet headers and shuts down HTTP and database connections on termination. Catalog endpoints and field validation are documented below.

The browser uses relative `/api` URLs. Vite proxies them to the API, so local development does not require permissive CORS. The `API_PROXY_TARGET` process environment variable changes the proxy target (Docker sets it to `http://backend:3000`).

## Docker development

Docker Desktop must be running. Stop the native dev servers first because Docker uses the same ports.

```sh
docker compose up --build -d --wait
docker compose exec backend npm run seed -w backend
docker compose logs -f frontend backend
docker compose down
```

Compose starts MongoDB 8, waits for database and API health checks, then starts Vite. Published ports bind to the local machine only. Application source and frontend runtime configuration are mounted for live edits. Public image assets are packaged in the image, so rebuild after changing them. Dependencies stay inside the images, so native host modules cannot mask Linux modules. After changing dependencies or other configuration, rerun `docker compose up --build -d --wait`.

The MongoDB volume persists through `docker compose down`. Do not delete `ecommerce-store_mongo-data` unless you intend to erase the database (the name assumes the default Compose project name). These containers and the unauthenticated loopback-only database are for local development.

## Build and deployment boundary

`npm run build` creates `frontend/dist`. To inspect the build locally, run the API (`npm start`) and, in another terminal, `npm run preview -w frontend`; the preview server also proxies `/api`. Vite preview is a local inspection tool.

Production hosting must serve the built frontend and route `/api` to the API behind HTTPS. Configure an authenticated database, production secrets, and `NODE_ENV=production`. Before launching live commerce, complete authentication/authorization, durable operational jobs and reconciliation, production rate limits, tax/shipping configuration, and fulfillment. The current order, inventory-hold, and webhook implementation is documented in docs/CHECKOUT.md. The catalog does not accept real orders or payments. Set `ENABLE_CATALOG_EDITOR=false` in production; the server rejects any attempt to enable the local editor with `NODE_ENV=production`. A production admin area must have real authentication and authorization.

## Layout

- `frontend/src`: React UI, styles, and component tests.
- `backend/src/app.js`: HTTP routes and error handling, separate from the listening process for integration tests.
- `backend/src/server.js`: database startup, HTTP listener, and graceful shutdown.
- `backend/src/config.js`: environment validation.
- `backend/test`: API and configuration tests using Node's built-in test runner.
- `.github/workflows/ci.yml`: automated checks on pushes and pull requests.

## Audit notes

The original scaffold had no backend entry point or dev script, Tailwind 3 directives paired with Tailwind 4 packages, missing frontend container host binding, and source mounts that masked installed container dependencies. These have been corrected. Unused nodemon and Autoprefixer were removed; native Node watch mode and Tailwind 4's PostCSS plugin cover those jobs.

Dependency versions were selected against their engine and peer requirements rather than applying forced audit downgrades. TypeScript remains on 6.0 because the selected TypeScript ESLint tooling does not yet declare TypeScript 7 support. Check `npm audit` for the current advisory state; a clean production audit is not a guarantee that future business logic will be secure.

At setup time, `npm audit --omit=dev` reported zero vulnerabilities. The full audit reported 12 moderate entries tracing to a single [Minimatch advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) in ESLint's development dependency tree. This is a tooling concern, not an exposed application route. The proposed automatic fixes downgrade major tooling versions; no forced downgrades or incompatible dependency overrides were applied. Revisit this when ESLint and TypeScript ESLint adopt the patched Minimatch release.


## Catalog and product studio

Open `/studio` to create products, edit descriptions/images/prices/inventory, publish drafts, and archive items. Draft is the default; only `active` products are public. Add images as HTTPS URLs or bundled `/images/*.jpg` assets and supply descriptive alt text. Up to five images and six highlights are supported. The editor displays validation and duplicate-identity errors without discarding form input; version checks reject overwriting a newer edit.

The catalog model stores unique SKU and slug indexes, category, plain-text description, exact integer `priceCents`, optional `compareAtPriceCents`, explicit `usd` currency, integer stock, lifecycle status, featured/badge fields, images, highlights, timestamps, and an optimistic version. Checkout orders hold immutable product/price snapshots, guest access tokens, Stripe session state, and inventory reservations. Variants and live payments are not implemented.

| Route | Behavior |
| --- | --- |
| `GET /api/catalog` | Categories/counts and local editor availability. |
| `GET /api/products` | Active products; `q`, `category`, `sort`, `inStock`, `minPrice`, `maxPrice`, `page`, `limit`. Price filters use cents. |
| `GET /api/products/:slug` | One active public product. |
| `GET /api/admin/products` | Local editor list including draft/archived items. Supports a `status` filter. |
| `GET /api/admin/products/:id` | Fetch latest editor version of a product. |
| `POST /api/admin/products` | Create a validated product. |
| `PUT /api/admin/products/:id` | Replace editable fields; requires the current `version`. |

Sort values: `featured`, `newest`, `price-asc`, `price-desc`, `name`. Pagination defaults to 12 and caps at 48 per page. Unknown filters, array/object filter inputs, unsafe write fields, fractional cents, and invalid inventory are rejected. Search escapes regular-expression metacharacters. Duplicate slug/SKU and version conflicts return `409`; validation errors return `422`; unavailable database returns `503`. Updates are atomic with a version predicate.

**Editor boundary:** `ENABLE_CATALOG_EDITOR=true` works only in development. Editor requests require `X-Catalog-Editor: local`, JSON writes, and approved local browser origins; cross-site requests are rejected. These checks protect this loopback-only development tool from incidental browser requests. They are not authentication and must not be used for a public management interface. Docker publishes ports to loopback only. Public product reads do not expose draft status, SKU, or the internal edit version.

`npm run seed` (native) or `docker compose exec backend npm run seed -w backend` (Docker) adds the six REWILD samples with insert-only upserts keyed by SKU. Rerunning preserves edits and never resets stock or deletes products. Samples are blocked in production. Manual image replacement does not upload a file; provide a hosted URL or add a static image and rebuild.

## Stripe test checkout

The bag persists product IDs and quantities locally, refreshes prices and stock from the API, and offers hosted Stripe test checkout after server configuration. Live keys are rejected. Signed webhooks and server verification determine payment state; a redirect alone cannot mark an order paid. Inventory holds, idempotent session creation, cancellation, and recovery protect stock and retries.

See [Checkout setup and architecture](docs/CHECKOUT.md) for the exact local setup, API contracts, test cards, inventory behavior, and verification limits. Add a test key to ignored `backend/.env`, run `npm run stripe:listen`, then recreate/restart the backend. The cart remains usable with a clear disabled checkout state until credentials are configured. No real charges or shipments are accepted.

## Storefront interactions

Product cards rotate 180° on mouse hover with explicit touch/keyboard flip controls. Their details face provides an Add to bag action while name, price, and stock stay visible below. Quick look offers with fresh API prices/stock, a gallery when multiple images exist, retry on failure, and a link to the full product page. Mobile uses a navigation panel, scrolling category chips, a sticky search/filter toolbar, and a filter sheet with draft changes applied together. Dialogs support Escape, backdrop dismissal, scroll locking, and focus restoration; mobile close controls remain reachable during internal scrolling.

The growing-guide popup adapts the supplied Natours reference with stacked REWILD photos, a space selector, two-column copy on desktop, and a matching collection link. Find it through Growing guide or the hero’s starting-point button. Mobile navigation uses a circular reveal.

Motion uses short hero entrances, scroll reveals, card lift/image zoom for fine pointers, and dialog transitions. Reduced-motion preferences disable these effects. Product facts and actions remain visible without hover. Catalog refreshes retain the existing grid while loading. See the playbook for implementation decisions and browser checks.

## Design references

- [UI/UX project playbook](docs/UI-UX-PLAYBOOK.md): durable lessons from the supplied CSS slides, with modern corrections and component standards.
- [Design theory notes](docs/DESIGN-THEORY-NOTES.md): the second supplied deck's design framework, gallery lessons, and concrete REWILD decisions.
- [Natours audit](docs/NATOURS-AUDIT.md): source findings, useful techniques, and adaptation decisions.
- [Generated asset prompts](frontend/public/images/ASSETS.md): original photo prompts, created with the built-in image generation tool. JPEG and responsive derivatives live in `frontend/public/images`.
