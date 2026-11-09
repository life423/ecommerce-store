# Design theory notes for REWILD

Sources are Jonas Schmedtmann’s `theory-lectures-v2-BEST.pdf` (407 slides) and `all-design-guidelines.pdf` (12 pages), both in Downloads. The review covered the text and rendered pages of both files, with a closer look at the palette, button, and action hierarchy examples. The 222-slide Advanced CSS deck and Natours source review are covered in the [UI/UX playbook](./UI-UX-PLAYBOOK.md) and [Natours audit](./NATOURS-AUDIT.md).

These are durable project notes for future work, not a claim of model training or global memory. They preserve practical lessons in original wording and page references, without bundling the large source PDFs or copying the course's examples into this project.

## Establish the product and personality first

Pages 82-92 and 236-255 distinguish an intentional visual personality from a collection of unrelated styling tricks. The deck describes serious/elegant, minimalist/simple, plain/neutral, bold/confident, calm/peaceful, startup/upbeat, and playful/fun directions. Those are useful design tools, not rigid categories or universal cultural meanings.

REWILD's direction is **calm and botanical, with an editorial character**: warm cream, deep green, terracotta photography, generous breathing room, soft serif display headings, and readable sans-serif UI. Keep the warmth and confidence without adding unrelated neon gradients, glass panels, exaggerated shadows, or multiple conflicting icon styles.

The site has two user goals: visitors should find and understand appropriate small-space gardening products; the owner should add, edit, publish, and archive products reliably. Its portfolio goal is to demonstrate a coherent storefront backed by working application behavior. There are no real customer testimonials, sales statistics, press endorsements, or transactions to claim.

## Nine design ingredients and how to use them

| Ingredient / pages | Principle | REWILD decision |
| --- | --- | --- |
| Typography, 95-107 | Use a limited family/size/weight system, comfortable line height, and readable line lengths. Distinguish headings, body, labels, and secondary metadata. | A serif display voice paired with a simple sans-serif UI. Body copy should be comfortable to read, not reduced to caption sizing for visual neatness. Use smaller type sparingly for actual metadata. |
| Color, 110-124 | Start with a main color and neutral system; use tints/shades and accents intentionally. Meaningful text must retain sufficient contrast. | Deep green for structure and primary actions, warm cream for surfaces, subdued green-gray for secondary text, restrained warm errors. Do not rely on color alone to communicate state. |
| Images, 127-147 | Imagery should explain the offering and reinforce the visual story. Consistent dimensions, appropriate resolution, and compression matter. | Original generated fictional-product photos use consistent lighting and backdrops. Storytelling hero and square catalog images have separate jobs. Responsive sources, lazy card loading, dimensions, and fallback artwork support real use. |
| Icons, 150-160 | Use one coherent visual family. Icons should help users recognize meaning; unfamiliar icon-only actions need labels. | One SVG stroke style using `currentColor`; accessible names for icon buttons, text labels for important actions. |
| Shadows, 163-173 | Depth implies prominence and interactivity; use it selectively. | Quiet surfaces and borders are the baseline. Reserve depth for an element that actually needs separation. |
| Radius, 176-182 | Corner treatment contributes to personality and should be consistent. | Mostly precise editorial rectangles, with circular secondary image arrows. Do not round every element merely because it is common in app templates. |
| Whitespace, 185-197 | Proximity communicates relationships. Spacing within a group should be tighter than spacing between groups. | Keep product name/price near the image, label/error close to its input, and action near its consequence. Use a small spacing system; check for both crowding and detached controls. |
| Hierarchy, 200-217 | Guide attention with position, size, weight, contrast, and separation. De-emphasizing secondary content can be more effective than enlarging everything. | Hero introduces the offer, one action opens the collection, filters support comparison, images lead each card, and price/availability remain visible. Keep studio controls secondary to shopping. |
| UX, 220-233 | Familiar patterns, clear words, useful feedback, and local actions help people reach their goals. Motion should be purposeful and short. | Search/filter/sort use expected controls; URLs retain filter state; drafts are hidden; validation is written and associated with fields; saving and recovery are explicit; keyboard focus moves to an error summary. |

The course's numeric suggestions are starting points rather than compliance guarantees. Its shorthand for large-text contrast is simplified: assess the actual text size and weight against current accessibility standards. Screen size, content, language, and users' settings matter more than mechanically following a screenshot's pixel values.

## Buttons and accent colors

- **Give each action group a clear priority.** Slide 224 places a filled reservation button beside the fields it acts on, where the label is easy to find. Slide 264 pairs filled buttons with outlined or text alternatives, including a product purchase action beside a details link. Start with filled forest green for the main action in the hero, product purchase panel, and cart. Give Quick Look and other secondary actions a quieter outline or surface. Keep simple navigation visibly styled as links. See also guidelines pp. 10–11.
- **Give the accent a specific job.** Slides 113–121 separate the main, accent, and neutral families, show lighter and darker variants, and use color on icons, highlighted panels, and imagery. The calm examples on slides 246–247 use gentle tints and coordinated photography. Try deep terracotta `#8a432f` on pale clay `#f6e6dc` for a selected space chip or an editorial callout, echoing the planter photos. This candidate pair has a measured text contrast ratio of about 5.9:1. Give selected controls a second cue such as a checkmark and preserve their semantic state. See also guidelines p. 5 and slide 124.
- **Design the full interaction.** Slide 172 compares resting, hover, and click treatments. Slides 226–229 show faster motion, visible feedback, and action placement close to the affected content. Standardize focus, pressed, disabled, loading, and success states across the first set of controls. Review labels, tap targets, motion preferences, and contrast on the actual rendered surfaces, including focus indicators and photo overlays. See also guidelines pp. 7–8 and 11.

## Use the right component for the job

Pages 259-301 organize elements into components: breadcrumbs, pagination, status bars, galleries, feature blocks, cards, accordions, tabs, carousels, testimonials, steps, forms, tables, pricing, and modals. Pages 311-350 assemble them into navigation, hero/footer/CTA sections, feature rows, card grids, Z/F patterns, single columns, sidebars, magazine layouts, and asymmetry.

For this catalog:

- **Sidebar + regular product grid:** supports filtering and comparison. Keep each card's content order and image ratio consistent.
- **Breadcrumb + detail layout + gallery:** supports orientation and product understanding; images do not replace written descriptions and stock state.
- **Status bars and field feedback:** communicate loading, empty results, failure, validation, and saved changes. Avoid showing zero results when a request failed.
- **Studio list + editor form:** keeps the selected item and editing action close. Preserve entered data after server errors, surface concurrency conflicts, and require an explicit lifecycle status.
- **Accordions or tabs:** add only when real product information needs progressive disclosure. Use native disclosure or proper keyboard interaction. Do not hide critical facts just to make the page shorter.
- **Carousel or modal:** use only when it improves the task, with visible controls, keyboard support, focus behavior, and no compulsory autoplay.
- **Testimonials, logos, statistics, pricing tables:** do not insert decorative social proof or subscription comparison into a store that has no basis for it.

Layout patterns describe likely reading relationships; they are not universal eye-tracking laws. Use semantic document order and test actual behavior. A gallery's attractive pattern is not enough justification for copying another brand's composition.

## Development workflow to retain

Pages 354-360 describe a seven-stage workflow: define, plan, sketch, design/build, test/optimize, launch, and maintain. For this project, define the task and data requirements first; choose useful components; build the complete interaction; verify small/large layouts, keyboard use, errors, image performance, and persistence; then document the result. Publication is a separate decision from local development.

Pages 371-405 reinforce fluid containers, relative units, flexible images, and breakpoints chosen when content breaks. Keep mobile and desktop in mind together. Do not shrink the user's root font to make a crowded layout fit. Do not treat old browser-support lists or historical device categories as current requirements without checking.

## Concrete decisions already applied

- Catalog data is stored in MongoDB and validated at the API and schema boundaries, rather than existing only as hardcoded cards.
- Exact integer cents and explicit currency support the planned server-side Stripe Checkout integration. No payment success is inferred from UI alone.
- Shared image, card, and icon components provide consistent behavior and appearance.
- Photos have responsive candidates, explicit dimensions, appropriate loading priority, and a failed-image fallback.
- Focus is visible, error feedback is written, controls remain native, and reduced-motion/touch alternatives are present.
- Authenticated production administration and real checkout remain future work; the development editor is explicitly disabled in production.

Future UI work should consult these notes and the playbook before adding another component or animation. The objective is a credible, usable e-commerce experience, with visual craft supporting the shopping task.
