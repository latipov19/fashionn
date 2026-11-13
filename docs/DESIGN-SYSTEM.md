# Design system

Audience: anyone changing how the store looks.

## 1. Concept: the Sunray Portal

Sunray pleating is a real garment technique: cloth folded into fine pleats that radiate from a centre. VYBEVERSE builds its doorway from it. A ring of pleats forms a portal, and a real product stands in the opening. Choosing a world sends a wave of pleats around the ring, and the whole page changes ink, ground and typographic voice with it.

The tension is quiet editorial layout against one futuristic sculpture. There is one signature element, and everything else stays disciplined.

The garment in the opening is real page content. It sits in the DOM behind a transparent canvas, so it still shows with WebGL off.

Around the portal the page reads as an obsidian glass atelier: the portal stands on a lit stage (a soft key light in the world's `--glow`, a hairline orbit with one light travelling round it, a slow dashed dial), and the controls float above the page as glass. Editorial type stays flat and straight; glass is kept for things you touch.

## 2. Tokens

`src/content/worlds.ts` is the only place a world colour is defined. It generates the CSS variables and feeds the 3D scene, and a unit test (`tests/unit/lib.test.ts`) checks that text and muted text reach WCAG AA contrast on every ground of every world.

Semantic tokens, the same for every world: `--bg`, `--bg-raised`, `--bg-sunken`, `--fg`, `--fg-muted`, `--line`, `--accent`, `--accent-fg`, `--danger`, `--success`, `--glow`, plus the display voice below. `--glow` is a light colour for the stage, glass edges and the primary button's halo, never text. A world is one theme object, never a separate stylesheet.

Glass is mixed from those tokens in `globals.css`, so it works on light and dark worlds alike. Three densities: `.glass-1` for the floating navigation and switcher, `.glass-2` for panels such as the look receipt, `.glass-3` for overlays (mobile menu, toast). Backdrop blur is used on at most a handful of elements at once, never on product cards, and light mode turns every glass surface solid.

Spacing is an 8-point family: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
Containers: `--shell` 1440 px with fluid gutters of at least 16 px, `--measure` 62ch. `--header-h` is 78 px: a 58 px capsule with 10 px above and below.
Radius: `--r-xs` 8, `--r-sm` 12, `--r-md` 18, `--r-lg` 26 and `--r-pill` for glass, buttons and product frames; 2 px for inputs. Type, rules and section edges stay straight.
Z-index: canvas 0, content 10, header 40, dialog 60, toast 70, skip link 80.
Durations: 120, 200, 320, 600, 900 ms. Easing: `--ease-out` cubic-bezier(.2,.7,.2,1), `--ease-in-out` cubic-bezier(.7,0,.2,1).

## 3. Type

All fonts are OFL Google fonts, self-hosted by `next/font`, with Cyrillic available for the Russian locale.

| Role | Family |
|---|---|
| Body and UI | Geologica, weights 300 to 700 |
| Display, sharp worlds | Sofia Sans Extra Condensed, 800 and 900 |
| Display, soft world | Cormorant, 400 |

Uzbek uses the correct letters: oʻ and gʻ with U+02BB, and the tutuq belgisi with U+02BC. Search folds these with plain apostrophes.

Each world has a display voice made of tokens: family, weight, tracking, case, leading and slant.

| World | Voice |
|---|---|
| DARK MODE | Extra condensed 900, uppercase, tight |
| SOFT SIGNAL | Cormorant 400, sentence case, open leading |
| CHROME FUTURE | Geologica 300, uppercase, wide tracking |
| RAW ENERGY | Extra condensed 900, uppercase, slanted, stacked tight |

Scale is fluid with `clamp()`. Display sizes are `--t-mega` (the manifesto), `--t-hero`, `--t-display` and `--t-title`. Text sizes are `--t-lead`, `--t-body`, `--t-small` and `--t-micro`. Prices use tabular numerals.

## 4. Layout

Asymmetric 12-column grid. Hero text sits on the left and low, and the portal is offset to the right. Product imagery is 4:5. On phones the hierarchy recomposes rather than shrinks: the portal moves above the type, type runs full width, and the switcher becomes a strip with 44 px targets.

Text never depends on the canvas for contrast. Text sits on solid `--bg`.

The store reads as pages, not one long scroll. `src/content/pages.ts` lists them in order: `/` (the hero), `/drop`, `/showroom`, `/look` and `/about` (manifesto and how buying works). Each page fills the first screen below the header with its content centred (`WorldPage`), and checks at 1440×900, 1920×1080 and 1366×768 fit without scrolling (the showroom also at 1536×730 and 1280×720). Phones scroll as usual. The world travels in `?world=`: the hero switcher rewrites it in place, header and menu links carry it, and every page ends with a "next page" link in reading order.

## 5. Components

Header, footer, demo notice, world switcher, product card, sale price, buy box, swatches, size picker, quantity stepper, size guide dialog, filter panel, cart line, toast. All real states are designed: hover, focus, active, loading, error, empty and sold out.

Home page components as built:

| Component | Notes |
|---|---|
| Header | Floating glass capsule, sticky. The five page links show from 1200 px; below that they sit in the menu. It settles from clear to dense over the first 160 px of scroll through a CSS scroll-driven animation, so no script and no layout change. The current section keeps a glass pill (`aria-current`). Search shows its label from 900 px. Phones get a glass menu with the main links and the four worlds; Escape and a press outside close it |
| World switcher | Glass segmented control. A thumb slides to the chosen world; each world shows a dot of its own ground colour |
| Product card | A soft frame around the 4:5 image. Hover (fine pointers only) lifts the frame, zooms the image, passes a light across it and shows an arrow chip. A container query steps the text down on narrow cards so a full price fits |
| The Current Drop | Four columns with an editorial stagger from 1200 px, two columns on tablets, a swipeable snap row of large cards on phones |
| Build Your Look | The pieces beside a sticky glass receipt with each piece's category and price and the server-computed total. Pointing at a piece or its line lights both and dims the rest. Five-piece looks lay out two large and three small |
| Story | A manifesto in `--t-mega` whose words rise once, real catalogue counts (worlds, products, products with a 3D model) and the wordmark drifting behind |
| Trust | Three glass cards with line icons. Copy is unchanged and makes no new claims |
| Sign in `/login` | The hero's composition, quieter: editorial headline and the current world on the left, a glass panel with the form on the right (stacked on phones, the panel capped at 560 px on tablets). In place of the portal stands the **VYBE ID** card: a portrait access pass (brand, emblem, world name in the world voice, world number) whose face is cut from the world portal-blade material, so it is black satin, matte paper, brushed chrome or hatched olive by world. It floats, leans toward a fine pointer, and a slow glint crosses it; a faded Sunray halo and orbit ring stand behind it. CSS plus one small pointer handler, no 3D. On phones it follows the form, so signing in never waits behind decoration. Reduced motion and light mode hold it still at its resting angle. Inputs take a glow focus ring in the world's `--glow`. Registration and password reset are marked «Tez orada» rather than linked |
| Footer | Positioning line, link columns, light mode, and an oversized gradient wordmark cut by the page edge |

Focus is a 2 px `--fg` outline with a 3 px offset; it follows rounded corners.

## 6. Shot list

### Scene 1: hero, Sunray Portal

| | |
|---|---|
| Framing | Ring faces the camera, offset right on desktop and centred above the type on phones. A slight tilt follows the pointer, capped at 6 degrees |
| Geometry | Instanced blades, one draw call. 112 on desktop, 72 on phones. Procedural, no external assets |
| Light | One key directional light per world, plus an environment built from procedural light panels. No HDRI download |
| Background | Transparent canvas over solid `--bg`, so colour is owned by CSS |
| Material | DARK: matte black. SOFT: warm plaster. CHROME: polished silver. RAW: rough olive with irregular blade lengths |
| Aperture | A real product image in the DOM behind the canvas |
| Pointer and touch | Blades near the pointer lift, like a hand across pleats. Touch scrolling is never blocked (`touch-action: pan-y`) |
| World change | A wave travels around the ring in about 900 ms, and CSS colour tokens follow |
| CTA timing | Both CTAs are in the server HTML and usable before any script runs |
| Fallback | An SVG poster drawn from the same blade maths, in CSS tokens, so it also changes world. Used for no WebGL, context loss, reduced motion and light mode |
| Budget (targets) | One draw call for blades, DPR capped at 1.75, on-demand rendering, 3D chunk loaded on idle after first paint |

### Scene 2: The Current Drop

Real product cards for the chosen world, server rendered. Cards enter with a short staggered rise using ScrollTrigger once. Nothing stays hidden if scripts fail.

### Scene 3: 3D Showroom

| | |
|---|---|
| Framing | Up to 7 of the world's products on a shallow arc (an ellipse half as deep as a circle) that turns to the chosen one. Two either side are in view, each place away a fifth smaller and 30% faded toward the page colour, so the chosen product leads and the others stay recognisable. A large brand wordmark and a soft pool of the world's glow sit behind, in the DOM |
| Layout | No intro text: the products are the page. The stage runs the full width of the screen; on a landscape screen from 900 px it takes all the height left above a slim bar (count and drag hint, the chosen product's name, category, colour, price and tags, the arrows). Nothing is laid over the stage. A slot is 80% of the stage height, so a product stands about three quarters of it. Phones put the product's details first and the count and arrows below |
| Items | A colour with a GLB shows the model, scaled to fit whatever units it was made in and stood on a shared floor. Any other product shows its packshot on a card, untoned so it matches the page. Products with a model lead the order |
| Interaction | Previous and next buttons, tap a neighbour (its hit area is as wide as a model may stand, 1.2 slots), drag to turn. A drag never changes the product, and a tap on the chosen product never reaches a neighbour behind it. A model turns freely with inertia and slowly on its own (about 18 s a turn); a card only tilts. Touch scrolling is never blocked (`touch-action: pan-y`) |
| Light | The world's key light (white), an ambient fill, a white rim from behind so a black garment keeps its outline on a dark page, and the same procedural environment as the portal |
| Loading | The chunk loads when the stage comes within 200 px of the viewport, on idle. Cards load together before the poster fades, so the arc never appears half empty. Each GLB loads on its own behind its card |
| Budget (targets) | DPR capped at 1.75, on-demand rendering, frames only while the stage is on screen. GLBs at most 3 MB from `npm run assets:import` |
| Fallback | A CSS carousel of the same images in the same order, sized by container units to match the scene. Used before the 3D loads, and for no WebGL, context loss, reduced motion and light mode. A model that fails to load shows its card |

### Scene 4: the look

One complete outfit per world, built from real products, with a real total. The receipt beside it lists each piece and is presentational only: no bundle purchase exists, so it offers none.

## 7. Motion

CSS handles microinteractions and colour transitions through registered custom properties. GSAP is used only for the hero headline swap and scroll reveals (`Reveal`, `RevealWords`). Under `prefers-reduced-motion` or light mode, nonessential movement stops and all content stays static and readable.

The rest of the motion language, all transform and opacity:

- First paint: the hero kicker, headline, calls to action and switcher rise in with a short stagger. The animation only holds its start state during the delay, so the GSAP headline swap still owns those elements afterwards.
- Hero stage: the orbit light turns every 16 s and the dial every 120 s, paused while the hero is off screen. With a fine pointer the glow, orbit and dial shift a few pixels against the pointer, one rAF write per frame.
- Magnetic calls to action: the two hero buttons lean toward a fine pointer. Touch, reduced motion and light mode leave them still.
- Story wordmark: drifts with the section's own scroll progress where the browser supports `animation-timeline: view()`.
- Never put a CSS transition on a property GSAP animates on the same element: they fight, and a reveal can stay hidden. Dim or lift an inner element instead.

## 8. Imagery rule

Owner photography always wins. There is none yet, and the owner has no physical stock, so the store runs on demo assets, every one tagged DEMO:

1. AI-generated packshots, full-body looks, world heroes and GLB models, made from the prompts in `docs/AI-PROMPTS.md` and imported with `npm run assets:import` (workflow in `docs/AI-ASSETS.md`). They lead when present.
2. Code-drawn flats from `tools/demo-media`, the fallback for any colour without an AI image.

Demo assets never imply fit or fabric behaviour, show no real person's likeness and no third-party brand. Before public launch they must come from a plan that allows commercial use. An owner photo uploaded through admin takes the lead position automatically.

## 9. Adding a real product

1. In admin, create the product with fabric, fit, care, size chart, price, optional sale price, sizes, colours and worlds.
2. Photograph each colour on a plain ground: front, back, detail and on-body. Export JPEG or PNG with the long edge at least 2000 px.
3. Upload per colour with descriptive alt text. The server crops to 4:5 around a focal point, strips metadata and writes three WebP widths. The photo takes the lead position automatically.
4. Set stock per variant, turn off the demo flag and publish.
5. Optional GLB, per colour: owner-provided, licensed, or AI-generated and tagged DEMO. The import centres it, compresses geometry with Meshopt and textures to WebP, and keeps it under 3 MB. KTX2 textures need the `toktx` tool and can replace WebP later.
