# REWILD UI and UX playbook

Project standards distilled from Jonas Schmedtmann's supplied 222-slide Advanced CSS course deck and the [Natours source audit](./NATOURS-AUDIT.md). These notes retain useful engineering principles and adapt the educational examples to an accessible React storefront. They do not reproduce the course or claim its designs as original work.

The second supplied 407-page deck is summarized in [Design theory notes](./DESIGN-THEORY-NOTES.md), including its typography, color, spacing, hierarchy, personality framework, and component/layout gallery. `AGENTS.md` points future project work to both references.

## What the lessons teach

| Slides | Lesson | Application here |
| --- | --- | --- |
| 21 | Responsive design, maintainable code, and web performance are joint goals. | A polished screenshot is only one check; also test keyboard use, failures, small screens, and load cost. |
| 23-37 | Understand the cascade, computed values, and inheritance before adding overrides. | Use shared tokens, low-specificity component classes, and inherited typography. Avoid escalating selector specificity to patch layout problems. |
| 42-48 | Box dimensions, normal flow, containing blocks, and stacking contexts explain layout. | `border-box`, bounded containers, explicit image ratios, and `minmax(0, 1fr)` prevent overflow. Use absolute positioning for overlays, not ordinary page structure. |
| 50-55 | Think in components and organize styles around those components. | Shared `CatalogImage`, `ProductCard`, and `Icon` components; separate token, base, layout, catalog, product, studio, and responsive stylesheets. |
| 59-68 | Preprocessors and build tools should reduce repetition and automate production output. | Keep the existing Vite/Tailwind pipeline. Use CSS custom properties for runtime tokens; adding Sass is optional, not a prerequisite for quality. |
| 74-78 | Use fluid layouts, flexible images, relative units, and purposeful breakpoints. | Keep the root font at the user's default. Use relative type for refinements and content-driven Grid changes. Floats remain useful for text wrapping, not the product grid. |
| 80-104 | Pseudo-elements, transforms, perspective, clipping, sibling selectors, and state selectors create visual detail. | Small entrance and arrow transitions, visible keyboard focus, product image zoom, active-filter styling. Essential information stays outside hover effects. |
| 109-115 | Mobile-first and desktop-first both require intentional treatment of both contexts. | Let content determine where layouts change; do not assume the course's historical device statistics describe today's traffic. Check narrow screens and wide screens. |
| 120-130 | Resolution switching, density switching, and art direction solve different image problems. | Bundled catalog images have 480px, 960px, and full-size sources with `srcset` and `sizes`. Product cards load lazily; the hero has explicit dimensions and high fetch priority. |
| 137-164 | Flexbox is suited to one-dimensional relationships and component alignment. | Header, toolbar, price rows, form actions, and metadata rows use Flexbox. SVG icons inherit `currentColor`; avoid an icon font dependency. |
| 172-190 | Grid expresses two-dimensional relationships, alignment, implicit tracks, and intrinsic sizing. | Catalog sidebar/results and product detail use Grid; `minmax(0, 1fr)` allows content to shrink. Cards form an explicit responsive grid. |
| 194-219 | Combine nested Grid, Flexbox, overlapping elements, and `object-fit` deliberately. | Grid handles major structure, Flexbox handles controls, and positioned badges remain inside a well-defined product image container. |

## Modern corrections and extensions

The slides are an educational overview, not a current browser specification. Their early cascade diagram is simplified: origin, importance, cascade layers, animations/transitions, and scope can change the outcome before specificity and source order settle a tie. Inline styles do not universally beat important declarations. The meaning of percentage values depends on the property; not all length percentages use the parent's width. See [MDN's cascade reference](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/Cascade).

Use `inline-flex` and `inline-grid` for inline formatting contexts; the slide labels `flex-inline` and `grid-inline` are not CSS display values. Prefer supported modern CSS, and use feature queries where an enhancement actually needs a fallback. Do not preserve obsolete prefixes or historical browser warnings merely because the course demonstrates them.

The course's checkbox navigation and `:target` popup illustrate selectors. Production interaction also needs semantics, state, keyboard access, and focus management. Use a real disclosure button with `aria-expanded`, or a modal dialog with focus placement, contained tab order, Escape dismissal, and focus restoration. See the WAI patterns for [disclosures](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) and [modal dialogs](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Component contract

- Make names, prices, stock state, and the primary product link available without hover. Hover may add polish; focus must make interactive elements clear; touch users must not need hover emulation.
- Represent loading, success, empty results, service errors, validation errors, and saving explicitly. Give users a recovery action and never represent failed requests as an empty catalog.
- Keep native inputs, labels, checkboxes, and select elements unless a real requirement justifies custom behavior. Connect field errors using `aria-invalid` and `aria-describedby`.
- Use restrained transform/opacity motion. Honor `prefers-reduced-motion`; avoid automatic background video and effects that obstruct buying decisions.
- Use readable type and comfortable touch targets. Preserve the user's root font settings. Test long names and descriptions, unavailable images, stock zero, and currency formatting.
- Reserve image space, optimize photo encoding, and provide accurate alternative text. Do not crop informational product features out of the only product photo.
- Keep public shopping separate from product management. Do not expose development controls in production.
- Preserve an independent REWILD identity. Learn techniques from Natours without copying its branding, imagery, layout, or testimonials.

## Applied storefront interactions

- Staggered hero lines and subtle scroll reveals use transform/opacity. Content is visible by default; reduced motion disables animation and pending reveals. Focus also reveals off-screen content.
- Product cards keep names, prices, stock, and Quick look visible on touch. Fine-pointer hover adds lift and image zoom without becoming a prerequisite for access.
- Quick look fetches the public product endpoint again before displaying price or inventory, supports multiple images, and provides loading, retry, and unavailable states. The full detail page remains linked.
- A shared native dialog supports quick look, mobile navigation, and the mobile filter sheet, with Escape/backdrop dismissal, body scroll locking, and trigger focus restoration. Mobile sheets have bounded internal scrolling and a sticky close control.
- Mobile category chips and a sticky search/filter toolbar replace the desktop sidebar. Filter changes remain a draft until Show results; cancellation discards them. Search/filter state remains in the URL.
- Existing results remain visible, dimmed and inert, during catalog refresh; initial loading uses skeletons.

Browser checks covered desktop at 1280px, phones at 390px and 320px, keyboard opening/Escape/focus restoration, scrolling sheets, filter cancellation/application, and unavailable products. Interaction tests use a dialog lifecycle shim because jsdom does not implement native dialog behavior; they do not replace the browser checks.

## Cart, flip cards, and guide popup

- Product media now has true perspective and `rotateY(180deg)` front/back faces with hidden backfaces. Fine-pointer hover reveals the details face; a visible flip control supports touch and keyboard; Escape returns to the photo. Hidden faces are inert and hidden from assistive technology. Names, prices, stock, and Quick look remain available outside the rotated faces. Focus on a back-face action pins that face so pointer movement cannot hide the focused control.
- The growing-guide popup adapts the user's Natours reference: two stacked gardening photos, an editorial title, a native space selector, separated columns, and an action into the selected collection. It stacks on mobile and uses the shared accessible dialog. It does not copy the reference's text/images or pretend to book a tour.
- The cart drawer stages item entrances, animates quantity/subtotal changes, and keeps checkout outside the scrolling list. Native delivery disclosure, empty/error states, and an unfinished-checkout recovery panel support actual shopping tasks. See [Checkout setup and architecture](./CHECKOUT.md).
- The circular mobile navigation reveal, button fill transitions, photo layers, and perspective effects use the course's techniques while retaining reduced-motion alternatives.

## Storefront roadmap and course source

The [Advanced CSS course repository](https://github.com/jonasschmedtmann/advanced-css-course) includes starters and finished builds. For implementation references, open `Nexter/final`, `Trillo/final`, or `Natours/final-after-S06` and look in `sass` alongside `index.html`. The links below pin the exact revision reviewed.

| Order | REWILD component | Course source |
| --- | --- | --- |
| 1 · Built | **Shop by Space**. An asymmetric desktop photo grid becomes a single column on phones. The balcony, windowsill, and indoor corner tiles link to the catalog with `?space=…#collection`. The API curates each group by SKU in `backend/src/catalog/routes.js`; the tiles and labels live in `frontend/src/lib/shopSpaces.ts`. Update both when adding a space. | [Nexter gallery](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Nexter/final/sass/_gallery.scss#L1-L32) |
| 2 · Next | **Product details and Quick Look**. Share the photo selector and add an “At a glance” section for documented facts such as footprint, light needs, and what comes in the box. | [Trillo gallery](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Trillo/final/sass/_components.scss#L236-L246), [responsive detail layout](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Trillo/final/sass/_layout.scss#L57-L96) |
| 3 · Planned | **Complete your setup**. Show complementary catalog products in compact cards with visible prices and stock. | [Nexter responsive card grid](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Nexter/final/sass/_homes.scss#L1-L45) |
| 4 · Planned | **Growing guide story**. Add a layered photo feature to “Our approach” and link it to the existing guide. Simplify the layout on phones and respect reduced motion. | [Nexter story panel](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Nexter/final/sass/_story.scss#L1-L64), [Natours photo composition](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/sass/components/_composition.scss#L1-L62) |

The existing flip cards and guide dialog have their own reference notes in the [Natours source audit](./NATOURS-AUDIT.md).

## Operational work when scheduled

1. A proper authenticated management area before any remote deployment of editing capabilities.
2. Product variants and durable production fulfillment/operational tooling before live commerce.

These remain planned; the current payment path is explicitly test-mode only.
