# Design system

Audience: anyone changing how the store looks.

## 1. Concept: the Sunray Portal

Sunray pleating is a real garment technique: cloth folded into fine pleats that radiate from a centre. VYBEVERSE builds its doorway from it. A ring of pleats forms a portal, and a real product stands in the opening. Choosing a world sends a wave of pleats around the ring, and the whole page changes ink, ground and typographic voice with it.

The tension is quiet editorial layout against one futuristic sculpture. There is one signature element, and everything else stays disciplined.

The garment in the opening is real page content. It sits in the DOM behind a transparent canvas, so it still shows with WebGL off.

## 2. Tokens

`src/content/worlds.ts` is the only place a world colour is defined. It generates the CSS variables and feeds the 3D scene, and a unit test computes contrast for every pair.

Semantic tokens, the same for every world: `--bg`, `--bg-raised`, `--bg-sunken`, `--fg`, `--fg-muted`, `--line`, `--accent`, `--accent-fg`, `--danger`, `--success`, plus the display voice below. A world is one theme object, never a separate stylesheet.

Spacing is an 8-point family: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.
Containers: `--shell` 1440 px with fluid gutters of at least 16 px, `--measure` 62ch.
Radius: 0 for surfaces, 2 px for inputs. Fashion layouts hold straight edges.
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

Scale is fluid with `clamp()`. Display sizes are `--t-hero`, `--t-display` and `--t-title`. Text sizes are `--t-lead`, `--t-body`, `--t-small` and `--t-micro`. Prices use tabular numerals.

## 4. Layout

Asymmetric 12-column grid. Hero text sits on the left and low, and the portal is offset to the right. Product imagery is 4:5. On phones the hierarchy recomposes rather than shrinks: the portal moves above the type, type runs full width, and the switcher becomes a strip with 44 px targets.

Text never depends on the canvas for contrast. Text sits on solid `--bg`.

## 5. Components

Header, footer, demo notice, world switcher, product card, sale price, buy box, swatches, size picker, quantity stepper, size guide dialog, filter panel, cart line, toast. All real states are designed: hover, focus, active, loading, error, empty and sold out.

Focus is a 2 px `--fg` outline with a 2 px offset.

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

### Scene 3: the look

One complete outfit per world, built from real products, with a real total.

## 7. Motion

CSS handles microinteractions and colour transitions through registered custom properties. GSAP is used only for the hero headline swap and scroll reveals. Under `prefers-reduced-motion` or light mode, nonessential movement stops and all content stays static and readable.

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
