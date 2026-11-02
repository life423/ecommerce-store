# Project conventions

This repository is REWILD, an original small-space gardening e-commerce portfolio concept. Preserve the independent brand and the working catalog.

- Read `docs/UI-UX-PLAYBOOK.md` before significant UI changes. It distills the supplied CSS course and the Natours source review into project standards.
- Also read `docs/DESIGN-THEORY-NOTES.md` for the second supplied design course: brand personality, type/color/spacing systems, visual hierarchy, component selection, and practical UX standards. Treat the saved notes as project memory; the original PDFs remain in the user's Downloads folder.
- Use Grid for page/product layouts and Flexbox for rows and controls. Keep styles in the focused files under `frontend/src/styles` and shared UI under `frontend/src/components`.
- Essential product facts and actions must be visible without hovering. Keep keyboard focus visible, retain native form semantics, and honor reduced-motion preferences.
- Prices are integer cents with explicit `usd` currency. Business prices and inventory must come from the API. Stripe Checkout is test-mode only; read `docs/CHECKOUT.md` before changing payment or inventory behavior. Never accept live keys or infer payment from a return URL.
- Catalog writes are a local-only development tool. Keep `ENABLE_CATALOG_EDITOR` disabled in production; production admin requires real authentication and authorization.
- Seed commands must be additive and idempotent; never overwrite user products or delete application data to reset a demo.
- Run `npm run check` after implementation changes. Run real database integration tests with `TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm run check` when MongoDB is available; tests create and remove their own uniquely named database.
- Keep the local Docker stack usable. Source files mount live; changes to public assets, package metadata, or environment configuration require `docker compose up --build -d --wait`.
