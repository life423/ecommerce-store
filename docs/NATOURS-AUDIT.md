# Natours component and UX audit

Reviewed the Natours subtree at commit `cf60eed1dbf87ba5464c2a3fa291c87dae668b7b` of [jonasschmedtmann/advanced-css-course](https://github.com/jonasschmedtmann/advanced-css-course/tree/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours). Scope includes `starter`, `after-S05`, and `final-after-S06`: HTML, all authored Sass partials, compiled styles, build manifests, image usage, and the differences between milestones. The completed version is the primary component reference. The [live site](https://natours.netlify.app/) was also inspected at 1280×900 and 390×844, including navigation, card flip, popup, keyboard dismissal, and responsive layout. Its legacy dependency build was not installed or executed; no screen-reader conformance audit was performed. REWILD's new implementation is checked separately.

Natours is a strong CSS techniques exercise. Its visual effects are useful to study, while several interaction mechanisms need additional behavior before they are appropriate for a production storefront.

## Findings, in priority order

### P1: The navigation toggle cannot be reached as a native keyboard control

[`index.html:19`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/index.html#L19) uses a checkbox and a label; [`_navigation.scss:2`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/sass/layout/_navigation.scss#L2) hides that input with `display:none`. The label is not a keyboard button. The closed menu uses opacity and width rather than removing its links from keyboard navigation. The result risks invisible focus targets while hiding the opening control from keyboard users.

Use a real button with an accessible name and `aria-expanded`, remove collapsed content from interaction, and support closing when navigation finishes. If the menu becomes a modal overlay, add focus containment, Escape, and focus restoration.

Live check: Escape did not dismiss the open navigation. Selecting “Popular tours” changed the hash to `#` and left the menu open; it did not navigate to the tour section. The separate hero link correctly navigated to `#section-tours`.

### P1: The popup has the appearance of a modal without modal behavior

[`_popup.scss:68`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/sass/components/_popup.scss#L68) opens the overlay through `:target`. [`index.html:402`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/index.html#L402) provides ordinary divs and a close link. There is no dialog name/role, focus placement, focus trap, Escape handler, or inert background. Its 75%-width table layout also lacks a bounded scrolling strategy for narrow or short viewports.

For product quick view, use a native dialog or an accessible dialog implementation and style its backdrop. Preserve the transition idea, but separate visual state from a URL hash. Follow the [WAI modal-dialog contract](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Live check: Escape did not dismiss the popup. At a 390×844 viewport its content measured 292.5px wide and 1230.875px tall with a top offset of −193.4375px. The close control was above the visible viewport and the text collapsed into very narrow columns. The desktop layout was visually balanced, but that does not carry over to the small-screen interaction.

### P2: Card prices and booking links depend on a hover flip on desktop

[`_card.scss:26`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/sass/components/_card.scss#L26) rotates the rear face away; lines 44-49 reveal it only on hover. The price and action sit on that rear face. Keyboard focus is not connected to a reveal state. The completed version does include a useful stacked fallback for small screens and `(hover:none)` at line 167; this should be recognized rather than assuming touch support was omitted.

For e-commerce, keep the price and primary action visible. Image scale, elevation, an arrow transition, or an optional secondary view can provide a similar sense of depth without hiding the buying decision.

### P2: Custom radio controls remove native keyboard interaction

[`_form.scss:65`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/sass/components/_form.scss#L65) removes radio inputs with `display:none`. Mouse-clickable labels do not replace native focus and arrow-key behavior. The floating-label treatment also hides labels while placeholders are shown, and error feedback is predominantly visual.

Retain native inputs or visually hide them without removing focusability. Keep persistent labels, group radios in a fieldset, and associate written errors with the relevant controls. REWILD's editor uses native controls and server-returned field errors.

Live check: after typing dummy text into the name and email fields, labels appeared beneath the inputs. Pressing Tab from the email field moved straight to the next-step button, skipping both custom radio controls. No booking form was submitted.

### P2: Motion has no reduced-motion path

The header keyframes, scale/flip effects, expanding navigation background, popup scale, and looping video have no `prefers-reduced-motion` alternative in the authored styles. [`index.html:266`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/index.html#L266) autoplays a looping background video without a pause control. The two available video encodings are approximately 8.9 MB and 7.2 MB; a browser normally selects one source, not both.

Use restrained motion and a reduced-motion override. Prefer a still image for an ordinary product catalog; any ambient video needs a clear purpose, loading strategy, and user control.

### P2: The development build is not a reproducible modern foundation

[`package.json`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/package.json) declares Node Sass 4 and an old concatenation/prefixing/compression chain. The start script invokes `live-server`, which is not declared in that manifest. Sass has officially [retired Node Sass](https://sass-lang.com/blog/node-sass-is-end-of-life/).

Study the authored partials, not the dependency versions. Keep REWILD's Vite pipeline and reproducible lockfile; use maintained Dart Sass only if a real Sass requirement appears. Do not install this old dependency tree to obtain a visual effect.

### P3: Minor CSS mistakes and placeholder content need cleanup before reuse

[`_typography.scss:28`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/sass/base/_typography.scss#L28) assigns `5rem` to `font-family`, apparently intending `font-size`; [`_story.scss:36`](https://github.com/jonasschmedtmann/advanced-css-course/blob/cf60eed1dbf87ba5464c2a3fa291c87dae668b7b/Natours/final-after-S06/sass/components/_story.scss#L36) uses invalid `border-radius:none`. Many navigation/footer actions still point at `#`, image descriptions are generic, and the booking form is a presentation mockup. They illustrate CSS, not a complete booking flow.

## Component techniques worth learning

| Component/source | Mechanism | How to adapt it |
| --- | --- | --- |
| Header | Layered image/gradient, polygon clipping, resolution queries | Use atmosphere and hierarchy; retain readable copy, content-sized layout, and a static fallback. |
| Animated button | Pseudo-element layer, transform, opacity, active state | Use a small arrow or lift transition with equal focus feedback and explicit property transitions. |
| Image composition | Relative container, overlapping positioned photos, stacking changes | Useful for an editorial story section; preserve meaningful reading order and a normal-flow mobile layout. |
| Feature cards | A bounded surface, icon, shadow, transform | Reusable benefit tiles; avoid turning noninteractive decoration into something that looks clickable. |
| Tour cards | Perspective, rear/front faces, backface visibility, touch fallback | Learn the 3D mechanics; keep product identity, price, and action visible in the catalog. |
| Story cards | Shape-based text wrapping, counter-skew, image filter | Optional storytelling enhancement; keep text legible and captions available without hover. |
| Navigation | Sibling selectors and radial scaling | Retain the transition concept only with an accessible stateful controller. |
| Popup | `:target`, opacity/scale, backdrop blur guarded by `@supports` | Use a real modal interaction contract; keep decorative blur optional. |
| Responsive images | Width descriptors, `sizes`, `picture`, and high-density sources | Directly useful: serve smaller product sources on small screens and reserve image dimensions. |
| Sass architecture | Variables, mixins, component partials, BEM conventions | Preserve clear responsibilities and low specificity, without requiring the exact Sass folder structure. |

## REWILD implementation decisions

The storefront keeps its own branding and generated imagery. It uses Grid and Flexbox, readable component styles, image sources sized for different screens, short transform/opacity transitions, native controls, visible focus, and a reduced-motion path. Product details have a real route rather than a CSS-only popup. The product studio has explicit saving/error states and optimistic concurrency.

No Natours source, photography, reviews, or branding was copied into the storefront. The source HTML's attribution notice also says not to claim the Natours design as your own. This audit takes engineering lessons from the reference rather than presenting the course project as an original portfolio design.

## Live visual-study notes

The site's visual system repeats a small set of decisions rather than inventing a different aesthetic per section: a three-green palette, uppercase headings, wide tracking in the hero, a light neutral canvas, and consistent card shadows. Slanted boundaries bridge sections, while counter-transforms keep card content upright. Alternating quiet white sections with immersive photo/gradient sections creates a clear rhythm.

The about section uses an asymmetric two-column layout: restrained copy against three overlapping photographs. Its relative parent and positioned children establish a small local composition; shadows and hover emphasis give the images depth. This is a useful editorial pattern, while the catalog itself benefits from a regular comparison grid.

The feature section repeats four equal surfaces over one shared background. Tour cards reuse a consistent anatomy and differentiate categories through color. Desktop flips use a substantial 0.8-second rotation; the mobile version stacks the price and action under the details. The card interaction was checked by moving/clicking into its visible surface and observing the revealed price face.

The booking panel uses a sharply divided translucent gradient over photography, allowing the form to read as a calm surface inside an immersive image. Native inputs would preserve the useful composition while improving labeling and keyboard behavior. The story section uses circular image masks, skewed surfaces, counter-skewed text, and a low-opacity background video; the video is decorative, so its resource and motion costs need to justify their place in a shopping experience.

For REWILD, adapt the underlying consistency, section rhythm, deliberate layers, and interaction feedback. Avoid importing every effect at once: product comparison should remain fast, readable, and calm. Product pages, filtering, empty/error states, and editing quality demonstrate a stronger e-commerce portfolio than decorative motion alone.
