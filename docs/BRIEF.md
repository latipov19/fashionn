# Lierne: Final Build Brief

Status: final direction from the creative review. Client sign-off on the name and direction is still pending. Date: 2026-11-06.
Audience: the engineers building the site. Everything here is meant to be implemented without further design input.

Rules for reading this document:

- **Numbers marked "target"** are budgets. Nothing has been prototyped or measured. Do not quote them as results.
- **Contrast ratios are computed**, not estimated. Section 4 lists every pair, and the script logic is the WCAG 2.x relative luminance formula.
- **All product facts are placeholders**: fibre, weight, origin, price, measurements, policy terms. The client must replace them before selling anything real.
- **Items marked "Assumption"** were not decided by the client. They are engineering defaults so that work can start. Confirm them before go-live.

---

## 1. Decision record

### 1.1 Scores (1 to 10, higher is better; for the last column, higher means safer)

| Concept | Distinctive | Luxury from code alone | Feasible to build well | Commerce clarity | Perf and access safety | Total |
|---|---|---|---|---|---|---|
| Alnage (cloth first) | 9 | 8 | 4 | 3 | 6 | 30 |
| **Lierne (space first)** | **8** | **8** | **6** | **8** | **8** | **38** |
| Incavo (object first) | 7 | 5 | 7 | 7 | 8 | 34 |

### 1.2 What would fail once built

**Alnage.** The product card shows a length of cloth, not a coat. Twelve products become twelve curtains, and a 56 px technical flat cannot carry the job of showing what is for sale. The category is only inferred from a pose. Technically it is the heaviest of the three: five poses with self-collision, arc-visibility baking, a yarn-scale swap, a relight quad. Text sits over the canvas and depends on a shader quiet zone. It is the most beautiful idea and the weakest shop.

**Incavo.** The ghost-mannequin silhouette is familiar to shoppers, which is a real advantage. The failure is material: a lofted rigid shell with no drape reads as armour or a prop, and low-key lighting does not rescue a wrong silhouette. A dark floating coat on black is also a crowded register. The `mix-blend-mode` edgeless plate is a Safari risk and depends on compression behaviour. The pattern-to-form film is excellent storytelling, but it sells a shape the site then cannot make believable.

**Lierne.** Five failures were found. Each has a design fix in this brief. None of the fixes has been built or tested yet.

1. **Paper doll.** A flat-hung garment with no seams reads as a cut-out. Fix: a `details[]` list in every spec (seams, plackets, collars, pockets, buttons, hems) rasterised into a detail map, plus a shadowed back layer visible at neck, hem and cuff. See 9.3.
2. **Scale.** The original plan put a 142 cm sleeve span and a 72 cm scarf in identical 4:5 frames at a fixed hang line. They could not share one rail. Fix: three frame classes at one physical scale, so a card's width is proportional to the size of the object, and a shopper can compare lengths directly. See 6.3.
3. **Dark on dark.** A dark garment in Room III in evening light disappears. Fix: colourway-to-wall separation rules and an automatic lit-area check in the pipeline. See 9.6.
4. **Text on canvas through the back door.** The original header sat over the live scene with swapped tokens. Fix: the header is always opaque. See 7.1.
5. **Noon sun missed the wall.** At the proposed steep angle the blade lands on the floor, not the garment. Fix: the hours table is reworked and window position is solved from a desired landing point. See 8.5.

Also corrected: the fullscreen composite pass is removed (it needed float render target support on phones), the idle dust tick is removed (it contradicted "if the visitor stops, the sun stops"), and the poster is drawn to a canvas so it can never become the LCP element.

### 1.3 Why Lierne won

It is the only concept where the shopper sees the whole garment, the limitation is hidden by the staging itself, and the signature moment is cinematic in the literal sense of a camera moving through rooms. Architecture, flat planes, raking light and cast shadow are what code renders best. A garment hung flat is close to a height field, which makes it far easier to simulate and light than cloth on a body. Text never sits on the canvas, so accessibility is structural rather than policed.

### 1.4 Grafts

| From | Idea kept | Why it earns its place |
|---|---|---|
| Alnage | Weave matrix with warp and weft anisotropic lobes selected by parity, `fwidth` LOD | This is what makes twill and satin read as real in stills |
| Alnage | Cloth weight and stiffness drive the simulation | A 540 gsm coat and a 110 gsm scarf hang differently, visibly |
| Alnage | Poster painted into a 2D canvas | A late image can never replace the H1 as LCP |
| Alnage | Always-available skip link | The walk is long. Commerce cannot be held hostage to it |
| Incavo | One spec drives mesh, mask and cut sheet SVG | One source of truth |
| Incavo | Plain wall label stating that images are renders | Honesty as house voice, not as small print |
| Incavo | Disclosure disappears automatically once a real photo is first | No manual step to forget |
| Incavo | Index table view at all widths (their Checklist) | Fast scanning for shoppers who want a list |
| Incavo | Khronos PBR Neutral tone mapping | Filmic curves shift garment colour. Colour is a commerce fact here |
| Incavo | Peg numbers in place of accession numbers, and `prefers-contrast` handling | Small, cheap, on-concept |

### 1.5 Explicitly not grafted

Alnage's lead seal, selvedge rail, relight slider, Fall to Thread film. Incavo's Closing, shell geometry, cinnabar accent, Turn the form. Each is good, and each would be a second idea. Lierne keeps one: **a house threaded on one line, lit by one sun.**

---

## 2. Brand

**Name:** Lierne. Say it *lee-URN*. Set as LIERNE in the wordmark.
**Meaning:** a lierne is a short rib in a vault that ties other ribs together. It runs between them rather than rising from the floor. A seam in stone.

**Trademark clearance is unverified.** Only general web searches were run, including two in this session, and they found no fashion label of this name. No USPTO, EUIPO or WIPO search was done, and domains and social handles were not checked. Lierne is an existing dictionary word and also a municipality in Norway. A trademark professional must clear classes 25 and 35 before any spend on identity.

**Tagline:** Cut flat. Hung in light.

**Concept in one sentence:** Lierne is a house of three plastered rooms threaded on one straight line, where every garment hangs flat from a steel bar and one slit of sun moves across it.

**The range:** flat-cut wovens only, because flat cut is what hangs true in this display. No tailoring, no knitwear at launch.

### Voice

- Plain, exact, unhurried. Short declaratives. Say what the thing is.
- Building words are a seasoning. Plain labels always come first: *Shop*, *Cart*, *Checkout*. Room names are secondary.
- Say *pieces*, not *products*. Say *cart*, not *bag*.
- Never use: luxury, timeless, curated, elevate, iconic, essential, journey, crafted, effortless.
- Never claim what is not true. Renders are called renders.
- Sentence case everywhere except display headings (uppercase via CSS) and labels.

### Wordmark and marks

- **Wordmark:** LIERNE outlined from Forum (convert to SVG path, do not rely on the font). The stem of the I is cut out as a hollow vertical slit showing the ground behind it, the slit of sun as a letter. `fill: currentColor`.
- **Small mark and favicon:** three nested door outlines crossed by one horizontal line, 24 by 24 viewBox, stroke 1.5, no fill.

---

## 3. Design tokens

There is no user theme toggle. The site uses **grounds**: each section declares `data-ground`, and semantic tokens resolve from it. The viewer's dark or light preference does not change the design.

```css
/* app/tokens.css, imported into Tailwind 4 */
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-bone: #E4DCCD;
  --color-bone-raised: #F0EADF;
  --color-ink: #191613;
  --color-oxide: #6E2C1E;
  --color-verdigris: #24504A;
  --color-lampblack: #161C29;

  /* Text and accent */
  --color-ink-2: #55493E;
  --color-muted-dark: #B3A99A;
  --color-muted-oxide: #D6C7B5;
  --color-muted-verdigris: #D2CDBD;
  --color-sienna: #8A3A1C;
  --color-sienna-hover: #6F2D14;
  --color-sun: #E7A766;
  --color-sun-hover: #F2C08A;

  /* States */
  --color-danger: #8E1F1A;
  --color-danger-dark: #EE9A8A;
  --color-success: #2C5A3F;
  --color-success-dark: #9CCBA8;
  --color-disabled-fill: #D6CEBF;

  /* Lines */
  --color-rail-light: #7A6E60;
  --color-rail-dark: #7D7366;
  --color-rail-oxide: #C9A78F;
  --color-rail-verdigris: #8FB0A6;
  --color-rail-lampblack: #7D7F8A;

  /* Fonts */
  --font-display: var(--font-forum), "Times New Roman", serif;
  --font-sans: var(--font-ysabeau), system-ui, "Segoe UI", sans-serif;

  /* Radius: zero. The building has square corners. */
  --radius-none: 0;

  /* Motion */
  --ease-door: cubic-bezier(.22,.8,.2,1);
  --ease-out: cubic-bezier(.2,.7,.3,1);
  --dur-1: 180ms;
  --dur-2: 240ms;
  --dur-3: 320ms;
  --dur-4: 720ms;
}

:root {
  /* Spacing, 4 px base */
  --s-1: .25rem; --s-2: .5rem; --s-3: .75rem; --s-4: 1rem; --s-5: 1.5rem;
  --s-6: 2rem; --s-7: 3rem; --s-8: 4rem; --s-9: 6rem; --s-10: 9rem;

  --gutter: clamp(1rem, 3.2vw, 3.5rem);
  --gap: clamp(.75rem, 1.6vw, 1.5rem);
  --max: 100rem;
  --measure: 62ch;
  --header-h: 3.5rem;

  /* Layers */
  --z-stage: 0; --z-wall: 10; --z-placard: 20; --z-header: 40; --z-drawer: 60; --z-toast: 70;

  /* Niche: the only shadow in the system */
  --niche-shadow: inset 0 .5rem .875rem rgb(0 0 0 / .35), inset 0 0 0 1px rgb(0 0 0 / .25);
}

[data-ground="bone"]      { --bg:#E4DCCD; --fg:#191613; --fg-2:#55493E; --link:#8A3A1C; --link-hover:#6F2D14; --line:#7A6E60; --focus:#191613; --danger-t:#8E1F1A; --success-t:#2C5A3F; --btn-bg:#8A3A1C; --btn-bg-hover:#6F2D14; --btn-fg:#F0EADF; }
[data-ground="raised"]    { --bg:#F0EADF; --fg:#191613; --fg-2:#55493E; --link:#8A3A1C; --link-hover:#6F2D14; --line:#7A6E60; --focus:#191613; --danger-t:#8E1F1A; --success-t:#2C5A3F; --btn-bg:#8A3A1C; --btn-bg-hover:#6F2D14; --btn-fg:#F0EADF; }
[data-ground="ink"]       { --bg:#191613; --fg:#E4DCCD; --fg-2:#B3A99A; --link:#E7A766; --link-hover:#F2C08A; --line:#7D7366; --focus:#E7A766; --danger-t:#EE9A8A; --success-t:#9CCBA8; --btn-bg:#E7A766; --btn-bg-hover:#F2C08A; --btn-fg:#191613; }
[data-ground="lampblack"] { --bg:#161C29; --fg:#F0EADF; --fg-2:#B3A99A; --link:#E7A766; --link-hover:#F2C08A; --line:#7D7F8A; --focus:#E7A766; --btn-bg:#F0EADF; --btn-bg-hover:#E4DCCD; --btn-fg:#191613; }
[data-ground="oxide"]     { --bg:#6E2C1E; --fg:#F0EADF; --fg-2:#D6C7B5; --link:#F0EADF; --link-hover:#E4DCCD; --line:#C9A78F; --focus:#F0EADF; --btn-bg:#F0EADF; --btn-bg-hover:#E4DCCD; --btn-fg:#191613; }
[data-ground="verdigris"] { --bg:#24504A; --fg:#F0EADF; --fg-2:#D2CDBD; --link:#F0EADF; --link-hover:#E4DCCD; --line:#8FB0A6; --focus:#F0EADF; --btn-bg:#F0EADF; --btn-bg-hover:#E4DCCD; --btn-fg:#191613; }

@media (prefers-contrast: more) {
  [data-ground="bone"], [data-ground="raised"] { --fg-2:#191613; --link:#6F2D14; }
  [data-ground="ink"], [data-ground="lampblack"] { --fg-2:#F0EADF; }
  [data-ground="oxide"], [data-ground="verdigris"] { --fg-2:#F0EADF; }
}
```

**Usage rules**

1. Text never sits directly on the live canvas, a baked still or a product image. It sits on a solid ground or an opaque `raised` placard, so every ratio below holds in every frame.
2. `--color-sun` is used on `ink` and `lampblack` only. It fails AA on `verdigris` (4.36:1).
3. Forms, errors and success messages appear only on `bone`, `raised` or `ink`. Never on a pigment band.
4. No gradients in UI. No blur. No glass. Radius is 0 everywhere. The one shadow is `--niche-shadow`.
5. `ink-2` is the placeholder colour. Placeholders are hints only. Every field has a visible label.

---

## 4. Contrast (computed)

AA requires 4.5:1 for normal text and 3:1 for UI graphics.

**Text pairs**

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| #191613 ink | #E4DCCD bone | 13.23 | Body |
| #191613 ink | #F0EADF raised | 15.05 | Placards, inputs |
| #55493E ink-2 | #E4DCCD bone | 6.40 | Secondary |
| #55493E ink-2 | #F0EADF raised | 7.28 | Secondary, placeholders, sold-out sizes |
| #8A3A1C sienna | #E4DCCD bone | 5.70 | Links |
| #8A3A1C sienna | #F0EADF raised | 6.49 | Links |
| #6F2D14 sienna-hover | #E4DCCD bone | 7.48 | Link hover |
| #6F2D14 sienna-hover | #F0EADF raised | 8.51 | Link hover |
| #8E1F1A danger | #E4DCCD bone | 6.53 | Errors |
| #8E1F1A danger | #F0EADF raised | 7.43 | Field errors |
| #2C5A3F success | #E4DCCD bone | 5.84 | Success |
| #2C5A3F success | #F0EADF raised | 6.64 | Success |
| #F0EADF raised | #8A3A1C sienna | 6.49 | Primary button |
| #F0EADF raised | #6F2D14 sienna-hover | 8.51 | Primary button hover |
| #E4DCCD bone | #191613 ink | 13.23 | Footer text |
| #B3A99A muted-dark | #191613 ink | 7.77 | Footer secondary |
| #E7A766 sun | #191613 ink | 8.68 | Links on ink |
| #F2C08A sun-hover | #191613 ink | 10.88 | Link hover on ink |
| #191613 ink | #E7A766 sun | 8.68 | Button on ink |
| #191613 ink | #F2C08A sun-hover | 10.88 | Button hover on ink |
| #EE9A8A danger-dark | #191613 ink | 8.26 | Errors on ink |
| #9CCBA8 success-dark | #191613 ink | 9.89 | Success on ink |
| #F0EADF raised | #6E2C1E oxide | 8.59 | Band title |
| #E4DCCD bone | #6E2C1E oxide | 7.55 | Band hover |
| #D6C7B5 muted-oxide | #6E2C1E oxide | 6.22 | Band secondary |
| #F0EADF raised | #24504A verdigris | 7.56 | Band title |
| #E4DCCD bone | #24504A verdigris | 6.64 | Band hover |
| #D2CDBD muted-verdigris | #24504A verdigris | 5.69 | Band secondary |
| #F0EADF raised | #161C29 lampblack | 14.23 | Band title |
| #B3A99A muted-dark | #161C29 lampblack | 7.35 | Band secondary |
| #E7A766 sun | #161C29 lampblack | 8.21 | Links on lampblack |
| #191613 ink | #E4DCCD bone | 13.23 | Button hover on pigment |
| #55493E ink-2 | #D6CEBF disabled-fill | 5.58 | Disabled button |

**Fixed during this review**

| Pair | Was | Resolution |
|---|---|---|
| sun on verdigris | 4.36, fails | Banned by rule 2. Verdigris links use raised, 7.56 |
| disabled text #6B6155 on #CFC6B6 | 3.58, fails | Replaced with ink-2 on #D6CEBF, 5.58 |
| disabled text #6B6155 on bone | 4.45, fails | Replaced by the same token |

**Non-text pairs (3:1)**

| Line | Ground | Ratio |
|---|---|---|
| #7A6E60 rail-light | bone | 3.65 |
| #7A6E60 rail-light | raised | 4.15 (input borders) |
| #7D7366 rail-dark | ink | 3.87 |
| #C9A78F rail-oxide | oxide | 4.61 |
| #8FB0A6 rail-verdigris | verdigris | 3.85 |
| #7D7F8A rail-lampblack | lampblack | 4.28 |

Focus rings: ink on bone 13.23, ink on raised 15.05, sun on ink 8.68, sun on lampblack 8.21, raised on oxide 8.59, raised on verdigris 7.56.

---

## 5. Typography

Both families are open-licensed Google Fonts. Both are confirmed present in the `next@16` `font-data.json` checked on 2026-11-06. Forum exports weight 400 only. Ysabeau Office is variable on `wght` with normal and italic.

**Display: Forum 400.** Roman square-capital proportions, so headings read like letters cut into a lintel. There is no bold and no italic. Set `font-synthesis: none`.

**Body and UI: Ysabeau Office.** Weights 400, 500, 600. A sans on a Garamond skeleton, so it shares bones with Forum. Always set `font-variant-numeric: lining-nums tabular-nums` on prices and tables.

```ts
// app/fonts.ts
import { Forum, Ysabeau_Office } from "next/font/google";
export const forum = Forum({ weight: "400", subsets: ["latin"], display: "swap", preload: true, variable: "--font-forum" });
export const ysabeau = Ysabeau_Office({ subsets: ["latin"], style: ["normal"], display: "swap", preload: true, variable: "--font-ysabeau" });
```

Latin subset only. `adjustFontFallback` stays at its default. Forum is the LCP font. Ysabeau is preloaded too because its small x-height makes fallback swaps visible.

| Token | Family | Size | Line height | Tracking | Case |
|---|---|---|---|---|---|
| `--text-display-xl` | Forum | clamp(3.25rem, 8.6vw, 9.5rem) | .96 | .01em | upper |
| `--text-display-l` | Forum | clamp(2.5rem, 5.4vw, 5.75rem) | 1 | .015em | upper |
| `--text-display-m` | Forum | clamp(1.75rem, 2.8vw, 2.75rem) | 1.1 | .02em | sentence |
| `--text-lead` | Ysabeau 400 | 1.375rem | 1.4 | 0 | sentence |
| `--text-body` | Ysabeau 400 | 1.125rem | 1.55 | 0 | sentence |
| `--text-small` | Ysabeau 400 | 1rem | 1.5 | 0 | sentence |
| `--text-label` | Ysabeau 600 | .875rem | 1.3 | .12em | upper |
| `--text-price` | Ysabeau 500 | 1.125rem | 1.3 | 0 | tabular |

The base is 18 px because Ysabeau has a small x-height. `.875rem` is the smallest size on the site. Inputs are at least `1rem`, which stops iOS zoom.

---

## 6. Layout and grid

### 6.1 Grid

- 12 columns, `--gap` between, `--gutter` at the sides, `max-width: var(--max)` centred.
- Pigment bands bleed full width. Their content stays on the grid.
- Breakpoints: `sm 640`, `md 900`, `lg 1200`, `xl 1600`.
- Body text measure is `--measure`.

### 6.2 Vertical rhythm

Section padding is `--s-9` on desktop and `--s-8` on mobile. Sections are separated by a change of ground, never by a rule.

### 6.3 The rail and the one-scale system

This is the signature of the shop and must be built exactly.

All pieces hang at **one physical scale**. Every image is 4:5, and each piece is rendered in a frame class sized for it.

| Class | World frame (W by H) | Used for | Bar below frame top |
|---|---|---|---|
| `wide` | 160 by 200 cm | Sleeved pieces, capes, long dresses | 16 cm |
| `mid` | 112 by 140 cm | Vests, tops, trousers, skirts | 16 cm |
| `small` | 72 by 90 cm | Scarves, small accessories | 16 cm |

The hang line sits 16 cm below the frame top in every class, and the frame tops align in a row. So every bar lines up at one height. Card width is proportional to real size:

```css
.rail-row  { --cm: calc((100cqw - 3 * var(--gap)) / 400); display: flex; gap: var(--gap); align-items: flex-start; justify-content: space-between; }
.hang-card { width: calc(var(--frame-w-cm) * var(--cm)); }  /* 160, 112 or 72 */
.rail-line { position: absolute; top: calc(16 * var(--cm)); height: 2px; inset-inline: 0; background: var(--rail-steel); }
```

- Rows are packed server-side, greedy, up to 400 cm of frame width per row (for example 160 + 160 + 72, or 160 + 112 + 112).
- The 2 px `.rail-line` runs behind the niches at the hang line, the full band width. It is decorative and `aria-hidden`.
- `--rail-steel` starts at #0F0E0D on oxide and verdigris and #7D7F8A on lampblack. After the spike, sample the bar colour from the renders and update it so the line reads as a continuation of the bar.
- Each image sits in a niche: `box-shadow: var(--niche-shadow)` drawn on a pseudo-element above the image.

### 6.4 Shared components

- **`<HangImage>`** reads one media record and renders the niche, `srcset`, blur placeholder and alt text. Nothing is ever laid on the image except the niche shadow.
- **`<Placard>`** is opaque `raised`, zero radius, `--s-4` padding: name in `--text-display-m`, cloth line in `--text-small`, price in `--text-price`, peg number in `--text-label`.
- **`<Button>`** is 48 px minimum height, `--s-5` side padding, `--text-label`. Primary uses `--btn-bg`. Secondary is a 1 px `--fg` border on transparent. Text link uses the rail underline.
- **`<RailLink>`** has a 1 px underline in `currentColor` drawing from the left. See section 10.

---

## 7. Pages

### 7.1 Global

**Header.** Opaque, height `--header-h`, sticky. Its `data-ground` matches the section beneath: on the home stage it swaps at each door crossing, and the swap is a hard cut because a door is a hard edge. **It is always a solid bar, never transparent, because text never sits on canvas.** Left: wordmark. Centre: Shop, Story. Right: Cart with count. On home only, a 72 by 16 px SVG floor plan sits beside Cart and acts as the progress indicator, with a current-room marker. On mobile that plan becomes a 2 px, three-segment bar under the header.

**Skip link.** `Skip to content` is the first focusable element. On home, the `Skip the walk` link is always visible in the header, right of the plan, and jumps to `#rail`.

**Footer.** `ink` ground. Newsletter (email, Subscribe), Shop, Story, policies, wordmark.

**Rendered disclosure.** On any product shown with `source: generated`, the caption `Rendered study. Colour is approximate.` sits below the image in `--text-small`. It disappears automatically when an upload is first in sort order.

### 7.2 Home `/`

| # | Section | Ground | Composition |
|---|---|---|---|
| 0 | The Wall | bone | First viewport, no WebGL required. H1 lower left across columns 1 to 7. Lead and two CTAs beneath. Door on the right, columns 8 to 10, sitting on a 1 px floor line. See 8.2. |
| 1 | Room I | stage | Lintel Coat. The Crossing. Placard at plateau |
| 2 | Room II | stage | Three pieces on one bar. Placard |
| 3 | Room III | stage | Nave Dress. Placard with `See all 12 pieces` |
| 4 | The Plan | bone | Large SVG floor plan, columns 1 to 8, with each room a link to `/shop?room=`. Copy beside it in columns 9 to 12 |
| 5 | What you are looking at | raised | One large plain label, `--text-display-m`, columns 3 to 10. Disclosure copy |
| 6 | Footer | ink | |

Placards are real DOM, in reading order, in the sticky stage. Keyboard focus and crawlers reach everything. Desktop: placard docks to the right, columns 9 to 12, vertically centred, never over the lit garment. The camera's station composition leaves that area for it.

### 7.3 Shop `/shop`: The Long Section

A cut through the building, not a grid. Each room is a full-bleed pigment band.

- **Top bar on bone:** H1 `All pieces`, count, then filter row: Room, Type, Size, Colour, Sort, and a view toggle `Rail` or `Index`. Everything is a real control and reflected in the URL: `?room=&type=&size=&colour=&sort=&view=`.
- **Band:** sticky room title on the left (`Room I` as `--text-label`, `Outerwear` as `--text-display-l`, then the hour, `Morning`), rail row, placards beneath each piece. Bottoms end where the garment ends.
- **Index view:** a real `<table>` on bone at all widths: thumbnail, peg, name, room, cloth, sizes in stock, price. Sortable headers. This is the fast path.
- Filtering to an empty result shows the empty state (section 11). When filtered, empty rooms are not rendered.

### 7.4 Product `/product/[slug]`: The Niche

Ground is the piece's room pigment for the first section, then bone.

- **First section.** Sticky niche image in columns 1 to 7. Right, columns 8 to 12, an opaque `raised` placard: peg, name, cloth line, price, colourway swatches, sizes, `Add to cart`, stock line.
- **Hour switch.** Under the image: `Morning`, `Noon`, `Evening` as a radio group. It crossfades 240 ms. It appears only when those images exist. Copy under it: `The same piece at three hours. Noon is closest to true colour.`
- **Swatches** are crops of the cloth study, 44 by 44 px, not flat fills. Selected state: 2 px `--focus` outline at 2 px offset, plus the name in text.
- **Cut sheet.** Section on bone. A live SVG drawn from the spec, with architectural dimension lines. It updates when a size is picked and sits beside a real measurement table. Caption: `Illustrative cut. Measurements in the table are the reference.`
- **Cloth study.** 1:1 macro image, with composition, weight, weave and care.
- **From the same room.** Three pieces on one rail.

### 7.5 Cart drawer: Your cart

`raised` panel, right side, 28rem wide, title `Your cart` with subtitle `Cloakroom`. `role="dialog"`, `aria-modal`, focus trap, Escape to close, scroll lock, focus returns to the trigger. Line items carry a numbered tag (peg style), thumbnail, name, colourway, size, quantity stepper, remove, line price. Below: subtotal, `Shipping and tax at checkout`, primary `Checkout`.

### 7.6 Checkout `/checkout`: The Desk

Bone, no WebGL, no motion, no display flourish. H1 in `--text-display-m`. Single column, max 34rem, plus a summary column at `lg`. Sections in order: Contact, Shipping address, Shipping method, Payment. Labels above fields. Correct `autocomplete` and `inputmode`. Errors inline and in a summary at the top, with focus moved to the summary.

### 7.7 Order confirmation `/order/[number]`: The Receipt

Bone. A coat-check ticket drawn in SVG, with the order number large in Forum, for example `L-000124`, set on a `raised` ticket. Then items, delivery address, what happens next. The URL uses an unguessable token, not the plain order number.

### 7.8 Story `/story`

Bone with one lampblack band. The plan drawn large and annotated. Three baked room stills at full column width. Copy from section 14.

### 7.9 Policies `/policies/[slug]`: House Rules

Bone. Long-form text at `--measure`, with a sticky side index at `lg`. Slugs: `shipping`, `returns`, `privacy`, `terms`.

### 7.10 404: This door was closed

`ink` ground. One baked still of a doorway plastered shut. The small floor plan with one unlabelled room. Copy from section 14, link to Shop.

### 7.11 Admin `/admin`: Back of House

Functional and restrained: tables and forms on bone, Ysabeau only, no pigment bands, no 3D, no display type.

- **Pieces:** list, edit, publish state, sort order.
- **Stock:** by size and colourway.
- **Orders:** list, detail, status (paid, packed, shipped, refunded).
- **Media:** per colourway slots showing Generated or Photo, with upload, focal point, hang line and one-click revert.

---

## 8. 3D scene spec

Runtime 3D exists **only on the home route**. Everything else uses baked stills. One shot, one signature.

Units are metres. X across, Y up, camera travels toward negative Z.

### 8.1 Layout

Three rooms on one Z axis. Each room is 7.2 wide (x from -3.6 to 3.6), 6.0 high, 11 long, with walls 0.7 thick.

| Element | Z extent or position |
|---|---|
| Entry wall | z 0.7 to 0 |
| Room I, Oxide | z 0 to -11 |
| Wall I to II | z -11 to -11.7 |
| Room II, Verdigris | z -11.7 to -22.7 |
| Wall II to III | z -22.7 to -23.4 |
| Room III, Lampblack | z -23.4 to -34.4 |
| Far door | End wall of Room III |
| Plaster screens | z -7.5, -19.2, -30.9 |

- **Doors:** 1.5 wide by 4.4 high, centred on x = 0.
- **Plaster screen:** free-standing, on axis, 3.0 wide by 4.6 high by 0.2 thick, in the room's pigment. This is the wall behind the garment. It makes the live view match the catalog stills.
- **Garment plane:** 0.12 in front of the screen, on a cross-bar at y = 2.35, dropped from the axial rail on two hanger rods.
- **Rail:** blackened steel, diameter 0.024, at y = 4.9 through all doors.
- **Windows:** one vertical slit per room in the left wall, 0.7 wide along z, y from 0.9 to 5.5. Window z is solved (8.5).

### 8.2 The Wall (DOM) and registration with WebGL

The first viewport is a real solid wall.

- `.stage` is `position: sticky; top: 0; height: 100svh` inside a wrapper of `420vh` on desktop and `340svh` on mobile.
- The canvas fills the stage. Over it, `.wall` is **four solid bone rectangles** surrounding a door rectangle. Solid panels scale crisply and cost nothing to rasterise. Do not use a single masked layer.
- **The door rectangle is defined in CSS and is the master.** Desktop: `height: 72svh; aspect-ratio: 1.5 / 4.4; left: 58vw; bottom: 0`.
- At mount, the rig computes the camera so the world door projects exactly onto that rectangle: `d0 = 4.4 / (2 * tan(fov/2) * doorPx/viewportPx)`. Then `camera.setViewOffset` shifts the projection so the door lands off-centre. The offset eases to zero by p = 0.14.
- As the camera moves, `s(p) = d0 / (d0 - travel(p))` is written to `--wall-s`, which drives `transform: scale()` with origin at the door centre. So the DOM wall behaves like a real wall in perspective.
- The H1 block uses the same transform and leaves the viewport by about s = 2.5, then gets `visibility: hidden`. Do not set `will-change` on text.
- Once the camera passes z = 0.7, the wall is hidden.
- Fill the door at first paint with nested CSS rectangles in oxide, verdigris and lampblack, inset to look like receding doors. After `load`, draw the poster into a 2D `<canvas>` inside the door. A canvas is not an LCP candidate. Then crossfade WebGL over it in 800 ms when the first frame is ready.

### 8.3 Scene graph

```
<Canvas flat dpr gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} frameloop="demand">
  CameraRig           one Catmull-Rom spline, damped
  Architecture        one merged BufferGeometry, about 120 boxes, attribute aRoom
  Rail                one InstancedMesh: axis, cross-bars, hanger rods
  Garments            up to 3 Meshes from .bin, visible only in the current or next room
  SunVolumes          one merged prism mesh, additive, depthWrite false
  Dust                one Points, alpha gated by the slit mask
```

There is **no** composite pass, **no** render target, **no** three.js lights, **no** shadow maps at runtime and **no** postprocessing library. Each `ShaderMaterial` ends with a shared `finish()` chunk (tone map, vignette, dither). Do not use three's tone mapping. `flat` keeps it off.

Use drei only for `PerformanceMonitor`. Import it from its own path.

### 8.4 Camera

- PerspectiveCamera. Vertical FOV 34 in landscape, 52 in portrait, interpolated from aspect.
- Eye height 1.55. Yaw within 6 degrees. No roll, no head-bob, no pointer parallax.
- Spline control points for position, with look target in brackets:

| Point | Position | Look at | p |
|---|---|---|---|
| Outside | solved from d0, y 2.2 | (0, 2.2, 0.7) | 0.00 |
| Door I | (0, 1.55, 0.35) | (0, 1.75, -7.4) | 0.14 |
| Station I | (-0.6, 1.55, -2.5) | (0, 1.75, -7.4) | 0.43 to 0.50 |
| Round screen | (-2.2, 1.55, -7.5) | (0, 1.8, -11.7) | 0.57 |
| Door II | (0, 1.55, -11.35) | (0, 1.75, -19.1) | 0.60 |
| Station II | (-0.4, 1.55, -14.2) | (0, 1.75, -19.1) | 0.64 to 0.72 |
| Round screen | (-2.2, 1.55, -19.2) | (0, 1.8, -23.4) | 0.78 |
| Door III | (0, 1.55, -23.05) | (0, 1.75, -30.8) | 0.82 |
| Station III | (-0.3, 1.55, -26.0) | (0, 1.75, -30.8) | 0.90 to 1.00 |

### 8.5 Sun and the hours table

`lib/hours.ts` is shared by runtime and the build renderer.

Sun azimuth `a` is measured from the screen plane, and elevation `e` from the horizon. The direction toward the sun is:

`L = normalize(-cos(e)*cos(a), sin(e), cos(e)*sin(a))`

| Hour | Clock | a | e | Sun colour | Room default |
|---|---|---|---|---|---|
| morning | 08:30 | 35 | 14 | #FFC48A | I |
| noon | 13:00 | 40 | 34 | #FFF1DC | II |
| evening | 19:00 | 24 | 6 | #FF8A4A | III |

**Window position is solved, not authored.** Given a desired landing point on the screen at `landingX`:

`windowZ = screenZ + (landingX + 3.6) * tan(a)`

Blade width on the screen is `windowW / tan(a)`, so 0.7 gives 1.0 at morning, 0.83 at noon, 1.57 at evening. The top of the lit area on the screen is `5.5 - (3.6 / cos(a)) * tan(e)`, about 4.4 at morning, 2.33 at noon and 5.1 at evening. Noon therefore lands just reaching the bar, which is why the angle is 34 degrees and not steeper. Steeper puts the blade on the floor.

**In the Crossing,** for Room I, `a` runs from 58 at p = 0.14 to 35 at p = 0.43 and the blade travels from left of the coat onto it. Window z stays fixed at the value solved for `a = 35, landingX = 0.1`.

### 8.6 Shader outline

**Slit mask** (all three surface materials):

```glsl
float slit(vec3 P, vec3 L, vec2 winZY, vec2 halfSize, float planeX) {
  float t = (planeX - P.x) / L.x;      // ray from P toward sun, hits window plane
  if (t < 0.0) return 0.0;
  vec2 q = (P + L * t).zy - winZY;
  float s = 0.012 * t;                 // penumbra widens with distance
  vec2 e = smoothstep(halfSize + s, halfSize - s, abs(q));
  return e.x * e.y;
}
```

Test it on two planes, x = -3.6 and x = -4.3, and multiply, so the wall thickness narrows the blade as a real reveal does.

**Bounce.** JS computes the sun patch centroid `C` for the current state. Each fragment adds, unshadowed:

`E_b = sunColor * pigment * k * max(dot(N, W), 0) / (1 + dot(C-P, C-P))`, where `W = normalize(C - P)`, `k` about 0.6.

This pigment-tinted glow is what makes the rooms feel filmed.

**AO** is analytic: the product of `sqrt(clamp(d_i / 0.6, 0, 1))` over distances to the nearest floor, ceiling and wall planes.

**Cast shadow on the screen.** Garments hang near-flat in a plane, so the wall shader projects along the sun ray to the garment plane: `t = (zg - P.z) / L.z`, `uv = toMask((P + L*t).xy)`. It samples the alpha mask (256 by 320, one atlas per room, bar and rods included) with mip bias from `t`. This is only possible because of the flat hang.

**Limewash.** Pigment albedo modulated by one tiling 512 px noise texture sampled at two scales, `0.92 + 0.16 * n`. Diffuse only.

**Cloth.**
- Wrap diffuse: `(dot(N,L) + w) / (1 + w)^2` with `w` from 0.1 to 0.4 by cloth.
- Charlie sheen: `D(h) = (2 + 1/r) * pow(sinθh, 1/r) / (2π)` with the Neubelt visibility term.
- Normal: fold normal from the mesh, plus detail map, plus a tiling weave normal.
- Baked AO vertex attribute.
- Self-shadow: 8-step ray march along `L.xy` in the 256 by 320 height map, 4 steps on mobile, soft by nearest occluder. Possible because the garment is close to a height field.
- Same slit mask.

**Steel.** Albedo #16171A, one GGX lobe, roughness 0.35.

**`finish()`:**

```glsl
vec3 neutral(vec3 c) {             // Khronos PBR Neutral
  const float start = 0.76, desat = 0.15;
  float x = min(c.r, min(c.g, c.b));
  float offs = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= offs;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < start) return c;
  float d = 1.0 - start;
  float np = 1.0 - d * d / (peak + d - start);
  c *= np / peak;
  float g = 1.0 - 1.0 / (desat * (peak - np) + 1.0);
  return mix(c, vec3(np), g);
}
// then vignette by gl_FragCoord, sRGB encode, add static blue-noise dither of +/- 1/255
```

Dither is mandatory. Dark gradients band without it. It is static, because a demand-rendered frame has no animated grain.

### 8.7 Budgets (targets)

| Item | Desktop | Mobile |
|---|---|---|
| DPR clamp | 2 | 1.5 |
| Vertices | 60k or fewer | 20k or fewer |
| Garment LOD | 16k verts | 6k verts, one visible at a time |
| Draw calls | 7 or fewer | 5 or fewer |
| Textures | 6 or fewer, under 12 MB GPU | same |
| Dust points | 400 | 200 |
| Lazy 3D JS | 280 KB gzip or less | same |
| Scene data | 1.2 MB or less | 600 KB or less |
| LCP | 2.0 s or less | 2.5 s or less |
| CLS | under 0.05 | under 0.05 |
| Frame | 16.7 ms mid laptop | 33 ms mid phone |

Pin React to 19.3.x: `@react-three/fiber` 9.8.2 peers on `react >=19 <19.4`. Versions current on 2026-11-06: next 16.4.5, three 0.187.0, fiber 9.8.2, drei 10.7.9, gsap 3.15.1, tailwindcss 4.3.4, sharp 0.35.5, playwright 1.65.0. Pin all exactly.

### 8.8 Lifecycle and tiers

The 3D chunk is imported with `next/dynamic` and `ssr: false`, after LCP and idle.

```ts
const tier =
  reducedMotion ? "stills-hard" :
  !webgl2 || saveData || (deviceMemory && deviceMemory < 4) ? "stills" :
  "live";
```

| Tier | Trigger | Behaviour |
|---|---|---|
| Live | Capable device | The scene |
| Stills | No WebGL2, Save-Data, low memory, scene load failure | Door holds the poster. Four full-bleed stills at each station. The reveal becomes a scroll-driven opacity crossfade between two coat stills, silhouette and lit. No three.js is downloaded |
| Reduced motion | `prefers-reduced-motion` | No WebGL, no GSAP, no sticky scrub. The wall stays still, normal flow, coat shown lit only. Hour buttons swap instantly |
| Runtime failure | `webglcontextlost`, or sustained budget failure | Canvas fades to the nearest station still, scroll position unchanged |
| No JS or no images | | CSS nested door draws. All links and placards work. A missing product image falls back to the niche with the SVG cut sheet from product data |

**Frame watch:** if frame time stays over 28 ms for 40 frames, step DPR to 1.25, then to the Stills tier. The scene is not assumed weak on mobile.

Dispose all geometries, materials and textures on unmount. Stop rendering when the stage is offscreen or the tab is hidden. If the visitor has scrolled before the scene arrives, snap to the current progress rather than replaying.

---

## 9. Product visual pipeline

### 9.1 What a catalog image shows

A 4:5 frame. One piece, no body, no text. It hangs dead straight from a blackened steel bar that spans the whole frame width, 16 cm below the top. Behind it is a limewash wall in the room's pigment, 12 cm away. One slit of raking sun comes from frame left, leaving at least 55 percent of the piece lit, and the rest falls off into shadow. The piece's shadow lands on the wall, offset right. Hang modes:

- `sleeveBar`: the bar passes through both sleeves, which spread into a T. Coats, jackets, shirts, long dresses.
- `shoulderRod`: a short rod inside the shoulders. Vests, sleeveless tops, capes.
- `waistBar`: a waistband clipped to the bar. Trousers, skirts.
- `overBar`: folded over the bar. Scarves.

### 9.2 Outputs per product

| Asset | Format | Count |
|---|---|---|
| Room shot | 4:5 WebP at 480, 960, 1600 | Each colourway at 3 hours |
| Cloth study | 1:1 WebP at 480, 960 | One per colourway; 44 px swatch crop derived from it |
| Cut sheet | Live SVG, not an image | Generated from the spec |
| Blur placeholder | Inline base64 | One per image |

The seed catalog has 26 colourways, so 78 room shots and 26 cloth studies. There are only 12 simulations, because colour does not change the drape.

Home stills: poster at door aspect, four stations and two coat states, at 1920 by 1080 and 1080 by 1920.

### 9.3 Steps

All tooling lives in `tools/pipeline/` and runs on a machine with a GPU. It is not part of the deploy.

**Step 1, spec.** `content/cloths.ts` and `content/pieces.ts`, typed as in section 13. The cut outline in centimetres is the single source for the mesh, mask, and cut sheet.

**Step 2, cloth simulation.** TypeScript XPBD on typed arrays, in Node worker threads, seeded.
- Mesh the cut outline at 10 mm.
- Mass from `gsm`. Bend compliance `10^(-2 - 4 * bend)` where `bend` is 0 to 1 from the cloth.
- Pin the top contact line to the bar with `gatherPct` of compression. Compression is what forms real folds.
- Start buckling with seeded, low-frequency out-of-plane noise, stretched 4:1 along gravity, amplitude 6 to 14 mm, biased to the front.
- Collide with the bar (cylinder, radius 12 mm) and the wall plane at -120 mm. No self-collision: this is a single layer, which is why this concept is feasible.
- Settle over 600 frames, 20 substeps. Upsample to 5 mm.
- **Back layer:** the same result offset 6 mm back, with the neck opening cut higher, darker, using lining colour. It shows at neck, hem and cuffs, and it is what stops a garment reading as a paper cut-out.

**Step 3, detail map.** Rasterise `details[]` into a 2048 px map: seam grooves (normal plus darkening), topstitch dashes at 2.5 mm, hem folds, placket edges, pocket outlines. Buttons are small instanced discs with four holes, in the colour given. Collars are a separate short strip mesh on top. A garment without these reads as cheap. Do not skip them.

**Step 4, surface.** The weave matrix is a tiny `NEAREST` `DataTexture`. For thread coordinates `(i, j) = floor(uv * threadsPerCm)`, `w = texelFetch(matrix, (i, j) mod size).r` says whether warp or weft is on top. That selects a cylinder-profile normal and which of the two anisotropic GGX lobes applies, with tangent along the top thread. Add a Charlie sheen term from the cloth's `sheen` and `fuzz`.

LOD: `fw = max(fwidth(tc.x), fwidth(tc.y)); mix(analytic, macro, smoothstep(.35, .9, fw))`. This is the main defence against moire. Analytic weave is a `#define` for the build renderer and macro studies. Runtime uses baked tiling normals.

**Step 5, render.** Playwright opens a headless Chromium harness that imports the same GLSL and `hours.ts` as the site.
- Camera: long lens, fov 12, framed from the class's world frame. Same bar position every time.
- Accumulate 128 samples into an RGBA32F target. Each sample jitters the sub-pixel offset and one point on the slit with a 2048 shadow map, and every fourth sample is a dome sample for ambient.
- Average, resolve through `neutral()`, add 8-bit dither and a light grain, then `canvas.toBlob` to PNG and pass to Node.
- For macro cloth studies add thin-lens focus and analytic weave.

Scale the window width by `frameW / 160` and set `landingX` at 10 percent left of the piece's centre, so every class gets the same lit share.

**Step 6, encode.** `sharp` to WebP at `quality: 85, effort: 6, smartSubsample: true`, plus blur placeholder and dominant colour. Target 250 KB or less at 1600 px, then measure. Dark gradients band below about q80.

**Step 7, manifest.** `content/media.generated.json` records dimensions, placeholder, hash and alt text. Alt comes from the spec: `Lintel Coat in Chalk, hung flat from a steel bar against an oxide plaster wall in morning light.`

**Step 8, cache.** Hash of spec, seed and shader source. Skip when unchanged. Commit outputs. Deployment never needs Chromium.

### 9.4 Real photos replace renders without a redesign

```ts
type ProductMedia = {
  id: string; productId: string; colourwayId: string;
  role: "room" | "cloth" | "photo";
  hour?: "morning" | "noon" | "evening";
  source: "generated" | "upload";
  url: string; width: number; height: number;
  blur: string; alt: string; position: number; hidden: boolean;
};
```

**Upload flow.** The admin picks the frame class from the piece, drags a hang line and a focal point on the upload. Then `sharp.extract` crops to 4:5 so the hang line lands 16 cm down at the class's scale (8 percent, 11.43 percent or 17.78 percent of frame height). If the crop is impossible, the tool disables Save and says why. Output widths are the same three. **Because this is done at upload, there is no runtime positioning code**, and the rail lines up with no extra logic.

The first visible media by `position` wins everywhere. Generated files stay and can be reinstated in one click. When the first item is an upload, the Rendered disclosure disappears and the hour switch hides unless uploads exist for those hours.

**Photo brief for the client:** garment hung flat, side lit, 4:5, plain wall. Model shots also work: the hang line sits at the shoulders.

### 9.5 Spike gate, before any page work

Build **Lintel Coat, Chalk, morning** end to end, including details and back layer. Review at 100 percent at 1600 by 2000 next to a real reference photo of a hung coat. Pass if it reads as a hung garment rather than rubber or paper, and if the render time per image is acceptable on the available machine.

**Plan B if it fails:** garments folded on a plaster shelf. Folded stacks need no simulation and use rounded boxes, the same weave and detail systems, in the same niche. The hang line becomes the shelf line and nothing else in the layout changes. The silhouette moves to the cut sheet.

### 9.6 Automatic image QA (fails the build of that image)

1. **Separation.** Colourway hex against room pigment: CIE76 delta E at least 30, and absolute delta L* at least 12. All seed colourways pass, and the seed script enforces it on new ones.
2. **Lit share.** At least 55 percent of pixels inside the alpha mask must exceed the lit threshold. The ambient dome is set so that shadowed cloth sits at no less than 18 percent of lit luminance.
3. **Bar check.** The bar's rendered centre is within 2 px of the expected hang line.
4. **Size.** WebP at 1600 px within budget, warning only.

---

## 10. Motion story

**One clock: the sun. Scroll position is time of day.** If the visitor stops, the sun stops. Nothing else performs.

### 10.1 Scroll map

| p | Clock | What happens |
|---|---|---|
| 0.00 to 0.14 | 06:30 | Through the wall. The wall scales around the door, and the H1 leaves the frame |
| 0.14 to 0.30 | 07:30 | Inside Room I. The coat is a silhouette. A thin blade of sun enters at the far left of the screen |
| 0.30 to 0.43 | 08:30 | The blade reaches the sleeve. Sheen ignites on the fold ridges, twill appears, colour arrives, and the shadow lands on the plaster |
| 0.43 to 0.50 | 08:30 | Plateau. Placard enters |
| 0.50 to 0.64 | to 13:00 | Round the screen, through Door II. Header cuts to verdigris |
| 0.64 to 0.72 | 13:00 | Plateau. Three pieces on one bar. Placard |
| 0.72 to 0.90 | to 19:00 | Through Door III. Header cuts to lampblack |
| 0.90 to 1.00 | 19:00 | Plateau. Nave Dress in the last sun. Far door. Placard with `See all 12 pieces` |

Rooms II and III add **no new effects**. Same dolly, same sun, one placard each.

### 10.2 Implementation

- The stage uses CSS `position: sticky`, not a ScrollTrigger pin, to avoid pin spacers.
- GSAP ScrollTrigger only writes `p` to a ref. Use `ignoreMobileResize: true`.
- The R3F loop reads it through critical damping: `cur += (target - cur) * (1 - exp(-dt * 8))`. Call `invalidate()` while `abs(target - cur) > 1e-4`. There are no per-frame React state updates.
- Dust position is a function of `p` only. There is no idle render. Idle GPU cost is zero.
- **Lenis is rejected.** Damping the camera gives the same smoothness, and native scroll keeps keyboard, anchors, find-in-page and iOS momentum intact, for less JS.
- GSAP is dynamically imported on home only, and not at all in the reduced-motion tier.

### 10.3 Choreography on load

1. H1 is simply there. No entrance animation. It is the LCP.
2. Poster is drawn in the door after `load`.
3. When the first WebGL frame is ready, canvas fades in over the poster, 800 ms `--ease-out`.

### 10.4 UI motion

| Element | Change | Duration | Easing |
|---|---|---|---|
| RailLink underline | `scaleX` 0 to 1 from left | 180 ms | `--ease-door` |
| Button | Background swap | 180 ms | `--ease-out` |
| Card image | Crossfade to the next hour, pointer devices only | 240 ms | `--ease-out` |
| Hour switch | Image crossfade | 240 ms | `--ease-out` |
| Placard enter | `opacity` and 12 px `translateY` | 320 ms | `--ease-door` |
| Cart drawer | `translateX` slide, dim 40 percent ink | 320 ms | `--ease-door` |
| Route change | Opacity fade only, none in checkout | 200 ms | linear |

No custom cursor, no magnetic buttons, no text splitting, no parallax, no scroll-triggered text reveals. After the walk the site is still.

With `prefers-reduced-motion`, all of these become instant, except that opacity changes under 200 ms may remain.

---

## 11. States

Focus everywhere: `outline: 2px solid var(--focus); outline-offset: 2px`. Never remove it.

| Component | Hover | Focus | Loading | Error | Empty or disabled |
|---|---|---|---|---|---|
| Primary button | `--btn-bg-hover` | Ring | Label stays, a 1 px line draws along the base, `aria-busy` | Message beside it, button re-enabled | `--color-disabled-fill` with ink-2, `aria-disabled` |
| Link | Underline draws | Ring | | | |
| Hang card | Crossfade to next hour | Ring on whole card, no crossfade | Blur placeholder on dominant colour, niche stays | Niche with SVG cut sheet, alt text beneath | Sold out: label `Sold out` on placard, image unchanged |
| Size chip | 1 px `--fg` border | Ring | | `Pick a size` inline in danger text, plus icon | Sold-out size: ink-2, diagonal strike, still focusable, announces `sold out` |
| Colour swatch | 1 px line | Ring | | | |
| Add to cart | As button | Ring | `Adding` | `Could not add. Try again.` | `Sold out` |
| Input | Border to `--fg` | Ring | | 2 px danger border, icon, message linked with `aria-describedby` | Disabled fill |
| Cart drawer | | Focus trapped | Line skeleton | Inline retry | `Your cart is empty.` plus `Shop all pieces` |
| Shop | | | Skeleton niches on the same rail, sized by class | `The rail did not load.` with Retry | `Nothing here in this size.` with `Clear filters` |
| Checkout | | | Payment button with `Placing order`, form locked | Summary at top, focus moved, inputs preserved | Empty cart redirects to shop with a note |
| Stock change at checkout | | | | `Only 1 left in this size. We changed your cart.` | |
| Admin tables | Row tint to raised | Ring | Skeleton rows | Inline banner | `No orders yet.` |

Toasts are `raised`, bottom left, `role="status"`. Text meaning is never carried by colour alone.

`forced-colors`: hairlines map to system colours and focus stays visible.

---

## 12. Mobile plan

Portrait suits this building, because tall doors fit tall screens. Mobile is recomposed, not shrunk.

**Home at 390 by 844**

- The wall stays solid. H1 sets large across 4 lines at the top, set by the `display-xl` clamp floor of 3.25rem, about 13vw at 390. Check for fit at 360.
- Full-width CTA in the thumb zone, with `Walk through` beneath it.
- Door: centred, rising from the bottom edge and cut off by it, as if the building continues below. CSS: `height: 46svh; left: 50%; transform: translateX(-50%); bottom: -6svh`. The registration maths is the same.
- Wrapper `340svh`. FOV 52. Camera path more central. One garment visible at a time. Room II shows Mullion Shirt only.
- Placards dock to the lower third as opaque full-width panels and never cover the lit part of the garment.
- `Skip the walk` stays visible in the header.

**Shop.** Each room keeps its rail as a horizontal scroll-snap row. `--cm: calc(78vw / 160)`, so scale stays true: wide cards are 78vw, mid 54.6vw, small 35.1vw. The next piece peeks. A visible `Next` control sits beside the band title. Index toggle is a two-line list. Filters open in a bottom sheet.

**Product.** Full-bleed niche, then placard. Hover replaced by the Hour switch at full width. Sticky `Add to cart` bar with `padding-bottom: env(safe-area-inset-bottom)`. Size must be chosen first, with a clear inline prompt. Cut sheet dimension lines give way to the table below 640.

**Cart and checkout.** Drawer full width. Order summary collapsed at the top. Correct input types.

**General.** Targets at least 44 px. Side gutters at least 16 px. Wrap the Index table in its own `overflow-x: auto` container. The page body never scrolls sideways.

---

## 13. Seed catalog

**All values are placeholders.** Fibre, weight, price, sizes and measurements must be confirmed by the client. Fibre statements carry legal weight.

### 13.1 Types

```ts
type Room = "I" | "II" | "III";
type Weave = "plain" | "twill22" | "herringbone" | "hopsack" | "satin5";
type HangMode = "sleeveBar" | "shoulderRod" | "waistBar" | "overBar";
type Template = "tee" | "vest" | "trouser" | "skirt" | "rect";

type Cloth = {
  id: string; label: string; weave: Weave; composition: string;
  gsm: number; warpPerCm: number; weftPerCm: number;
  bend: number;      // 0 to 1
  roughness: number; // 0 to 1
  sheen: number;     // 0 to 1
  fuzz: number;      // 0 to 1
  wrap: number;      // 0.1 to 0.4
};

type Detail =
  | { kind: "seam"; path: "shoulder" | "sleeve" | "side" | "centreBack" | "centreFront" | "yoke" | "inseam" }
  | { kind: "hem"; cm: number }
  | { kind: "placket"; widthCm: number; lengthCm?: number }
  | { kind: "collar"; style: "band" | "camp" | "shawl" | "funnel" }
  | { kind: "button"; count: number; diaMm: number; hex: string }
  | { kind: "pocket"; style: "patch" | "welt"; xCm: number; yCm: number; wCm: number; hCm: number }
  | { kind: "waistband"; heightCm: number }
  | { kind: "fly" } | { kind: "tie"; lengthCm: number } | { kind: "fringe"; cm: number };

type Piece = {
  slug: string; peg: string; name: string; category: string;
  room: Room; hour: "morning" | "noon" | "evening";
  frameClass: "wide" | "mid" | "small"; hang: HangMode;
  priceUsd: number; sizes: string[];
  colourways: { id: string; name: string; hex: string; lining: string }[];
  clothId: string; description: string;
  cut: { template: Template; lengthCm: number; bodyWidthCm: number; spanCm: number;
         sleeveDepthCm: number; neckWidthCm: number; neckDropCm: number };
  gatherPct: number; seed: number; details: Detail[];
};
```

**Sizing rule for the seed script.** Spec dimensions are for the middle size. Each size step changes body width by 4 cm, length by 1.5 cm and span by 3 cm. Trousers use waist in inches. Stock seeds at 8 per size per colourway.

### 13.2 Cloths

| id | Label | Weave | Composition | gsm | Warp/cm | Weft/cm | bend | rough | sheen | fuzz | wrap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `wool-twill-540` | Heavy wool twill | twill22 | 90% wool, 10% cashmere | 540 | 14 | 12 | .82 | .78 | .45 | .55 | .20 |
| `wool-herringbone-430` | Wool herringbone | herringbone | 100% wool | 430 | 16 | 13 | .70 | .80 | .35 | .45 | .18 |
| `wool-hopsack-380` | Wool hopsack | hopsack | 100% wool | 380 | 12 | 12 | .60 | .82 | .35 | .50 | .22 |
| `cotton-canvas-340` | Cotton canvas | plain | 100% cotton | 340 | 18 | 14 | .74 | .85 | .10 | .15 | .14 |
| `linen-twill-260` | Linen twill | twill22 | 100% linen | 260 | 22 | 18 | .52 | .80 | .18 | .25 | .22 |
| `wool-gabardine-280` | Wool gabardine | twill22 | 100% wool | 280 | 34 | 24 | .46 | .62 | .30 | .10 | .18 |
| `linen-plain-190` | Linen plain weave | plain | 100% linen | 190 | 20 | 18 | .38 | .84 | .12 | .28 | .28 |
| `cotton-poplin-120` | Cotton poplin | plain | 100% cotton | 120 | 48 | 26 | .22 | .70 | .14 | .05 | .32 |
| `silk-satin-210` | Silk satin | satin5 | 100% silk | 210 | 60 | 34 | .20 | .32 | .70 | .02 | .30 |
| `silk-wool-twill-110` | Silk wool twill | twill22 | 70% wool, 30% silk | 110 | 42 | 34 | .12 | .55 | .50 | .12 | .40 |

### 13.3 Pieces

Peg numbers run in room order. `lining` is the back-layer colour. Horn buttons are #3B2E25. Corozo buttons are #B9A68A.

**1. Lintel Coat**

```json
{ "slug": "lintel-coat", "peg": "I.01", "name": "Lintel Coat", "category": "Coats",
  "room": "I", "hour": "morning", "frameClass": "wide", "hang": "sleeveBar",
  "priceUsd": 920, "sizes": ["S","M","L","XL"],
  "colourways": [
    { "id": "chalk", "name": "Chalk", "hex": "#DAD2C2", "lining": "#8A8172" },
    { "id": "soot", "name": "Soot", "hex": "#202224", "lining": "#3A3C3F" },
    { "id": "slate", "name": "Slate", "hex": "#5C7282", "lining": "#2F3B44" } ],
  "clothId": "wool-twill-540",
  "cut": { "template": "tee", "lengthCm": 118, "bodyWidthCm": 66, "spanCm": 142, "sleeveDepthCm": 34, "neckWidthCm": 20, "neckDropCm": 10 },
  "gatherPct": 6, "seed": 1101,
  "details": [ { "kind": "seam", "path": "shoulder" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 5 },
    { "kind": "collar", "style": "shawl" }, { "kind": "placket", "widthCm": 7 },
    { "kind": "button", "count": 3, "diaMm": 28, "hex": "#3B2E25" },
    { "kind": "pocket", "style": "patch", "xCm": 16, "yCm": 62, "wCm": 19, "hCm": 21 } ] }
```
Description: A long coat cut from straight panels in heavy wool twill. It falls in broad, slow folds and closes with three horn buttons.

**2. Jamb Jacket**

```json
{ "slug": "jamb-jacket", "peg": "I.02", "name": "Jamb Jacket", "category": "Jackets",
  "room": "I", "hour": "morning", "frameClass": "wide", "hang": "sleeveBar",
  "priceUsd": 540, "sizes": ["S","M","L","XL"],
  "colourways": [
    { "id": "putty", "name": "Putty", "hex": "#BFB39C", "lining": "#6F6656" },
    { "id": "harbour", "name": "Harbour", "hex": "#526D8A", "lining": "#2B3A4A" } ],
  "clothId": "wool-herringbone-430",
  "cut": { "template": "tee", "lengthCm": 68, "bodyWidthCm": 62, "spanCm": 134, "sleeveDepthCm": 28, "neckWidthCm": 19, "neckDropCm": 9 },
  "gatherPct": 5, "seed": 1102,
  "details": [ { "kind": "seam", "path": "shoulder" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 3 },
    { "kind": "collar", "style": "camp" }, { "kind": "placket", "widthCm": 4 },
    { "kind": "button", "count": 5, "diaMm": 22, "hex": "#3B2E25" },
    { "kind": "pocket", "style": "patch", "xCm": 14, "yCm": 44, "wCm": 17, "hCm": 18 } ] }
```
Description: A boxy jacket in wool herringbone with a short, square body. Two patch pockets sit low and hold their shape.

**3. Transom Cape**

```json
{ "slug": "transom-cape", "peg": "I.03", "name": "Transom Cape", "category": "Coats",
  "room": "I", "hour": "morning", "frameClass": "wide", "hang": "shoulderRod",
  "priceUsd": 680, "sizes": ["One size"],
  "colourways": [
    { "id": "oat", "name": "Oat", "hex": "#CDBFA5", "lining": "#7C7260" },
    { "id": "fir", "name": "Fir", "hex": "#617A68", "lining": "#2F3D34" } ],
  "clothId": "wool-hopsack-380",
  "cut": { "template": "rect", "lengthCm": 96, "bodyWidthCm": 136, "spanCm": 136, "sleeveDepthCm": 0, "neckWidthCm": 24, "neckDropCm": 12 },
  "gatherPct": 8, "seed": 1103,
  "details": [ { "kind": "seam", "path": "centreBack" }, { "kind": "hem", "cm": 4 }, { "kind": "collar", "style": "funnel" } ] }
```
Description: A single wide rectangle of wool hopsack with a slit for the head and a soft funnel neck. It has no sleeves and no fastening.

**4. Purlin Vest**

```json
{ "slug": "purlin-vest", "peg": "I.04", "name": "Purlin Vest", "category": "Jackets",
  "room": "I", "hour": "morning", "frameClass": "mid", "hang": "shoulderRod",
  "priceUsd": 340, "sizes": ["S","M","L","XL"],
  "colourways": [
    { "id": "flax", "name": "Flax", "hex": "#C9B78F", "lining": "#7A6D50" },
    { "id": "black", "name": "Black", "hex": "#1E1E1F", "lining": "#3A3A3C" } ],
  "clothId": "cotton-canvas-340",
  "cut": { "template": "vest", "lengthCm": 70, "bodyWidthCm": 58, "spanCm": 58, "sleeveDepthCm": 0, "neckWidthCm": 20, "neckDropCm": 16 },
  "gatherPct": 3, "seed": 1104,
  "details": [ { "kind": "seam", "path": "shoulder" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 2.5 },
    { "kind": "placket", "widthCm": 3.5 }, { "kind": "button", "count": 4, "diaMm": 20, "hex": "#B9A68A" },
    { "kind": "pocket", "style": "patch", "xCm": 12, "yCm": 46, "wCm": 16, "hCm": 15 } ] }
```
Description: A plain sleeveless layer in cotton canvas, stiff enough to stand a little away from the body. Wear it over a shirt or under a coat.

**5. Mullion Shirt**

```json
{ "slug": "mullion-shirt", "peg": "II.01", "name": "Mullion Shirt", "category": "Shirts",
  "room": "II", "hour": "noon", "frameClass": "wide", "hang": "sleeveBar",
  "priceUsd": 240, "sizes": ["S","M","L","XL"],
  "colourways": [
    { "id": "white", "name": "White", "hex": "#EFEBE3", "lining": "#A9A399" },
    { "id": "pale-blue", "name": "Pale Blue", "hex": "#BCCBD8", "lining": "#7C8A96" } ],
  "clothId": "cotton-poplin-120",
  "cut": { "template": "tee", "lengthCm": 76, "bodyWidthCm": 58, "spanCm": 138, "sleeveDepthCm": 24, "neckWidthCm": 17, "neckDropCm": 7 },
  "gatherPct": 8, "seed": 2101,
  "details": [ { "kind": "seam", "path": "yoke" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 1 },
    { "kind": "collar", "style": "band" }, { "kind": "placket", "widthCm": 3 },
    { "kind": "button", "count": 7, "diaMm": 11, "hex": "#E5DECF" } ] }
```
Description: A band-collar shirt in fine cotton poplin, cut with wide flat sleeves. The cloth is light, so it falls in small, close folds.

**6. Clerestory Overshirt**

```json
{ "slug": "clerestory-overshirt", "peg": "II.02", "name": "Clerestory Overshirt", "category": "Shirts",
  "room": "II", "hour": "noon", "frameClass": "wide", "hang": "sleeveBar",
  "priceUsd": 360, "sizes": ["S","M","L","XL"],
  "colourways": [
    { "id": "sand", "name": "Sand", "hex": "#C8B596", "lining": "#786C58" },
    { "id": "rust", "name": "Rust", "hex": "#B25A32", "lining": "#5E2F1A" } ],
  "clothId": "linen-twill-260",
  "cut": { "template": "tee", "lengthCm": 74, "bodyWidthCm": 62, "spanCm": 136, "sleeveDepthCm": 27, "neckWidthCm": 18, "neckDropCm": 8 },
  "gatherPct": 7, "seed": 2102,
  "details": [ { "kind": "seam", "path": "shoulder" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 2 },
    { "kind": "collar", "style": "camp" }, { "kind": "placket", "widthCm": 3.5 },
    { "kind": "button", "count": 6, "diaMm": 16, "hex": "#3B2E25" },
    { "kind": "pocket", "style": "patch", "xCm": 13, "yCm": 26, "wCm": 13, "hCm": 14 } ] }
```
Description: An overshirt in linen twill, heavier than a shirt and lighter than a jacket. It softens with wear and keeps its square shape.

**7. Frieze Tunic**

```json
{ "slug": "frieze-tunic", "peg": "II.03", "name": "Frieze Tunic", "category": "Shirts",
  "room": "II", "hour": "noon", "frameClass": "wide", "hang": "sleeveBar",
  "priceUsd": 280, "sizes": ["S","M","L"],
  "colourways": [
    { "id": "natural", "name": "Natural", "hex": "#D8CDB8", "lining": "#847B6A" },
    { "id": "madder", "name": "Madder", "hex": "#B0503F", "lining": "#5C2820" } ],
  "clothId": "linen-plain-190",
  "cut": { "template": "tee", "lengthCm": 96, "bodyWidthCm": 64, "spanCm": 130, "sleeveDepthCm": 30, "neckWidthCm": 22, "neckDropCm": 11 },
  "gatherPct": 8, "seed": 2103,
  "details": [ { "kind": "seam", "path": "shoulder" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 2 } ] }
```
Description: A long tunic in plain-weave linen with a wide, open neck. Four straight panels and nothing else.

**8. Spandrel Top**

```json
{ "slug": "spandrel-top", "peg": "II.04", "name": "Spandrel Top", "category": "Shirts",
  "room": "II", "hour": "noon", "frameClass": "mid", "hang": "shoulderRod",
  "priceUsd": 190, "sizes": ["XS","S","M","L"],
  "colourways": [
    { "id": "ivory", "name": "Ivory", "hex": "#E7DFCF", "lining": "#9C9484" },
    { "id": "ochre", "name": "Ochre", "hex": "#B98A34", "lining": "#6A4E1C" } ],
  "clothId": "linen-plain-190",
  "cut": { "template": "vest", "lengthCm": 60, "bodyWidthCm": 52, "spanCm": 52, "sleeveDepthCm": 0, "neckWidthCm": 22, "neckDropCm": 9 },
  "gatherPct": 5, "seed": 2104,
  "details": [ { "kind": "seam", "path": "shoulder" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 1.5 } ] }
```
Description: A sleeveless top in plain-weave linen with a straight hem. It is cut square and sits away from the body.

**9. Arcade Trouser**

```json
{ "slug": "arcade-trouser", "peg": "III.01", "name": "Arcade Trouser", "category": "Trousers",
  "room": "III", "hour": "evening", "frameClass": "mid", "hang": "waistBar",
  "priceUsd": 380, "sizes": ["28","30","32","34","36"],
  "colourways": [
    { "id": "stone", "name": "Stone", "hex": "#A79D8C", "lining": "#615A4E" },
    { "id": "clay", "name": "Clay", "hex": "#8A5A44", "lining": "#4C3126" },
    { "id": "pewter", "name": "Pewter", "hex": "#7E8186", "lining": "#45474A" } ],
  "clothId": "wool-gabardine-280",
  "cut": { "template": "trouser", "lengthCm": 104, "bodyWidthCm": 42, "spanCm": 58, "sleeveDepthCm": 0, "neckWidthCm": 0, "neckDropCm": 0 },
  "gatherPct": 3, "seed": 3101,
  "details": [ { "kind": "waistband", "heightCm": 5 }, { "kind": "fly" }, { "kind": "seam", "path": "inseam" },
    { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 4 },
    { "kind": "button", "count": 1, "diaMm": 18, "hex": "#3B2E25" } ] }
```
Description: A wide, straight trouser in dense wool gabardine. The leg falls without a break from waist to hem.

**10. Nave Dress**

```json
{ "slug": "nave-dress", "peg": "III.02", "name": "Nave Dress", "category": "Dresses",
  "room": "III", "hour": "evening", "frameClass": "wide", "hang": "sleeveBar",
  "priceUsd": 640, "sizes": ["XS","S","M","L"],
  "colourways": [
    { "id": "pearl", "name": "Pearl", "hex": "#E3DACB", "lining": "#9A9182" },
    { "id": "garnet", "name": "Garnet", "hex": "#7A1F2B", "lining": "#431118" } ],
  "clothId": "silk-satin-210",
  "cut": { "template": "tee", "lengthCm": 132, "bodyWidthCm": 54, "spanCm": 122, "sleeveDepthCm": 26, "neckWidthCm": 20, "neckDropCm": 8 },
  "gatherPct": 8, "seed": 3102,
  "details": [ { "kind": "seam", "path": "shoulder" }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 1 },
    { "kind": "tie", "lengthCm": 150 } ] }
```
Description: A long dress in silk satin, cut as a single flat T and tied at the waist. Light runs down each fold in a long, narrow line.

**11. Apse Skirt**

```json
{ "slug": "apse-skirt", "peg": "III.03", "name": "Apse Skirt", "category": "Skirts",
  "room": "III", "hour": "evening", "frameClass": "mid", "hang": "waistBar",
  "priceUsd": 320, "sizes": ["XS","S","M","L"],
  "colourways": [
    { "id": "camel", "name": "Camel", "hex": "#B08A5B", "lining": "#66502F" },
    { "id": "ash", "name": "Ash", "hex": "#8C8C88", "lining": "#4E4E4B" } ],
  "clothId": "wool-gabardine-280",
  "cut": { "template": "skirt", "lengthCm": 86, "bodyWidthCm": 72, "spanCm": 72, "sleeveDepthCm": 0, "neckWidthCm": 0, "neckDropCm": 0 },
  "gatherPct": 7, "seed": 3103,
  "details": [ { "kind": "waistband", "heightCm": 4 }, { "kind": "seam", "path": "side" }, { "kind": "hem", "cm": 3 },
    { "kind": "button", "count": 2, "diaMm": 18, "hex": "#3B2E25" } ] }
```
Description: A wrap skirt in wool gabardine, made from one wide flat panel. It closes at the side with two buttons.

**12. Cornice Scarf**

```json
{ "slug": "cornice-scarf", "peg": "III.04", "name": "Cornice Scarf", "category": "Accessories",
  "room": "III", "hour": "evening", "frameClass": "small", "hang": "overBar",
  "priceUsd": 160, "sizes": ["One size"],
  "colourways": [
    { "id": "saffron", "name": "Saffron", "hex": "#D19A2A", "lining": "#D19A2A" },
    { "id": "rose-clay", "name": "Rose Clay", "hex": "#B56F5E", "lining": "#B56F5E" } ],
  "clothId": "silk-wool-twill-110",
  "cut": { "template": "rect", "lengthCm": 140, "bodyWidthCm": 45, "spanCm": 45, "sleeveDepthCm": 0, "neckWidthCm": 0, "neckDropCm": 0 },
  "gatherPct": 10, "seed": 3104,
  "details": [ { "kind": "fringe", "cm": 3 } ] }
```
Description: A long scarf in fine wool and silk twill with a short fringe at each end. Hung over a bar, it collapses into tight folds.

**Fit check.** All pieces fit their frame: longest wide piece 16 + 132 = 148 of 200 cm, longest mid 16 + 104 = 120 of 140 cm, scarf 16 + 70 = 86 of 90 cm. Widest span 142 of 160 cm.

**Home scene pieces.** Room I: Lintel Coat in Chalk. Room II: Mullion Shirt in White, Clerestory Overshirt in Sand, Frieze Tunic in Madder. Room III: Nave Dress in Pearl.

---

## 14. Final copy

All copy is draft until checked against real product facts. Do not state origin, makers or materials beyond what the client confirms.

### 14.1 Home

**Meta title:** Lierne. Cut flat. Hung in light.
**Meta description:** Flat-cut clothes in natural cloth, hung in three rooms and shown in one light.

**The Wall**
- H1: A house of clothes, lit by one sun.
- Lead: Every piece is cut flat and hung in a room of its own. Walk through, or go straight to the rail.
- Primary: Shop all 12 pieces
- Secondary: Walk through
- Header link: Skip the walk

**Room I placard**
- Label: Room I, morning
- Name: Lintel Coat
- Line: Heavy wool twill, 540 gsm
- Price: $920
- Link: View the coat

**Room II placard**
- Label: Room II, noon
- Heading: Three pieces on one bar
- Body: Each one starts as straight panels. That is why they hang this way.
- Links: Mullion Shirt, Clerestory Overshirt, Frieze Tunic

**Room III placard**
- Label: Room III, evening
- Name: Nave Dress
- Line: Silk satin, 210 gsm
- Price: $640
- Links: View the dress. See all 12 pieces.

**The Plan**
- Heading: Three rooms, one line
- Body: The doors of this house line up, so one line runs through all of it. Outerwear hangs in the morning room. Shirts hang at noon. Trousers, dresses and small things hang in the evening. Pick a room, or see them all.
- Links: Room I, Outerwear. Room II, Shirts. Room III, Evening.

**What you are looking at**
> These pictures are renders, made in code from each garment's cut and cloth. They are not photographs. No one is wearing these clothes, so nothing here shows you how a piece fits. Use the measurements, which are listed on every piece. Colour is approximate, and noon is the closest light.

**Footer**
- Newsletter heading: New pieces, when they arrive
- Field: Email address
- Button: Subscribe
- Success: You are on the list.

### 14.2 Shop

- H1: All pieces
- Room bands: Room I, Outerwear, Morning. Room II, Shirts, Noon. Room III, Evening.
- Empty: Nothing here in this size.

### 14.3 Story

**H1:** The house

**Why flat**
Most clothes are built around a body. Ours start from the cloth. A piece is cut from straight panels, with as little shaping as it can carry, and joined by simple seams. It lies flat when it is off you. It takes its shape from whoever puts it on.

**Why hung**
Flat clothes do not need a mannequin. So we do what a museum does with a textile. We hang the piece from a steel bar, against a plaster wall, and let one slit of sun move across it. A fold shows you how heavy the cloth is. A shadow shows you how far it stands from the wall.

**Why three rooms**
The house has three rooms, plastered in oxide, verdigris and lampblack. The doors line up, so you can see from the first room to the last. An old word for this is enfilade, from the French for threading. We keep the clothes on that one line, and the day moves along it.

**Why Lierne**
A lierne is a short rib in a stone vault. It does not rise from the floor. It runs between the other ribs and ties them together. It is a seam in stone.

**What is real**
The rooms and the sun are made in code, and so are the pictures of the clothes. We say so because you are buying clothes, not pictures. As we photograph each piece, the photograph takes the render's place.

### 14.4 404

- H1: This door was closed.
- Body: The page you wanted is not in this house. It may have been moved, or it was never here.
- Link: Back to the shop

### 14.5 Policy summaries

**Draft only. Legal review is required before launch. The bracketed values are placeholders.** Shown at the top of each policy page.

**Shipping.** We ship from [location] to [regions]. Orders leave within [2] working days. Standard delivery costs [$18] and takes [3 to 7] working days. You get a tracking link by email when your order leaves.

**Returns.** You have [30] days from delivery to return a piece that is unworn, with its tags on. We refund the original payment within [5] working days of receiving it. Return shipping is [paid by the customer]. Scarves are returned only if unopened.

**Privacy.** We collect what we need to take and deliver your order: your name, address, email and order details. Payments are handled by our payment provider, and we never see your full card number. We do not sell your data. You can ask us to see or delete it at [contact email].

**Terms.** Prices are in US dollars. Images may be renders, and colour is approximate. Measurements on each piece are the reference for fit. If a piece sells out after you order, we refund you in full. These terms are governed by the laws of [jurisdiction].

### 14.6 Microcopy

- Add to cart: Add to cart. Adding. Added.
- Size prompt: Pick a size
- Stock: In stock. Only 2 left. Sold out.
- Disclosure: Rendered study. Colour is approximate.
- Hour note: The same piece at three hours. Noon is closest to true colour.
- Cart empty: Your cart is empty.
- Order confirmed H1: Your order is in.
- Order next: We will email you when it leaves. Keep this number.
- Checkout generic error: We could not take that payment. Nothing was charged. Check the details and try again.

---

## 15. Commerce engineering

**Assumption, not client-decided.** The decided stack does not cover persistence, payment or auth. These defaults let work start. Confirm before go-live:

- **Database:** PostgreSQL with Drizzle ORM.
- **Payments:** Stripe Payment Element, test mode until the client has an account. Style it with the Appearance API: radius 0, tokens from section 3.
- **Admin auth:** one role, email and password, session cookies, rate-limited login.
- **Media storage:** S3-compatible object storage for uploads. Generated media ships in `public/media/generated`.

**Rules that must hold**

- Prices are stored as integer cents, in USD. The server recalculates totals. Never trust a client price.
- Stock is decremented in a transaction when the Stripe webhook confirms payment. Webhooks are idempotent, keyed by the Stripe event id.
- Stock is checked again at the start of checkout.
- Guest checkout only. The confirmation URL uses a random token.
- Tax and shipping come from a server config at launch: a flat shipping rate, and tax at zero until the client's tax position is known. This needs professional advice before selling.

**Minimum tables:** `pieces`, `cloths`, `colourways`, `variants` (piece, colourway, size, stock, sku), `product_media`, `carts`, `cart_items`, `orders`, `order_items`, `admin_users`, `newsletter_signups`.

**Routes:** `/`, `/shop`, `/product/[slug]`, `/checkout`, `/order/[token]`, `/story`, `/policies/[slug]`, `/admin/*`, `/api/stripe/webhook`.

Render the shop and product pages as server components. Cart drawer, hour switch and filters are small client islands. `/` ships no three.js in the initial bundle.

---

## 16. Build order and acceptance

1. Spike gate (9.5). Stop and decide before anything else.
2. Run the headless float target check on day one. Confirm RGBA32F accumulation works in Chromium on the render machine.
3. Tokens, fonts, grounds, shell.
4. Shop rail with placeholder images at all three frame classes. Prove the one-scale system with real text.
5. Commerce end to end with Index view only.
6. Full pipeline for all 12 pieces. Review the rail as a whole, not one image at a time.
7. Home wall and door, with stills tier first.
8. Live scene.
9. Admin media tool.

**Acceptance**

- Home H1 is the LCP element in Lighthouse on all tiers.
- The full purchase path works with WebGL disabled and with images disabled.
- Keyboard-only purchase works, including the drawer.
- `axe` is clean on every route. Manual checks at 200 percent zoom.
- A real uploaded photo replaces a render on the rail, with the bars aligned, and the disclosure gone, with no code change.
- `prefers-reduced-motion` downloads neither three.js nor GSAP.
- Real-device checks: iOS Safari, a mid-range Android, a 1x Windows monitor. Record measured numbers next to the targets in 8.7.

---

## 17. Out of scope

- People, mannequins, on-body renders, virtual try-on.
- Licensed 3D models, stock images, AI-generated images.
- Knitwear, tailoring, shoes, lingerie and any piece that does not hang flat.
- WebGL on any route other than home.
- Live cloth simulation at runtime.
- Interactive relighting beyond the three hour stills.
- Product spin or turnable models.
- Postprocessing, bloom, depth of field at runtime.
- Lenis, custom cursors, magnetic buttons, View Transitions.
- Customer accounts, wishlists, reviews, recommendations, loyalty, gift cards, promo codes.
- Site search.
- Multi-currency, multi-language, right-to-left. English and USD only.
- Tax calculation and carrier rate integration.
- Dark or light theme toggle.
- Native apps.
- Trademark clearance, domain purchase and legal drafting, which are client actions.
