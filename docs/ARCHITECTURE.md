# Architecture

Audience: engineers working in this repo. This file describes what exists now.

## 1. Stack, pinned

Next 16.4.5 App Router, React 19.3.1, TypeScript 6 strict, Tailwind 4 with a bespoke token layer, three 0.187 with @react-three/fiber 9.8 and drei 10.7, GSAP 3.15, Drizzle 0.45, PGlite locally, `pg` in production, Zod 4, Vitest 5, Playwright 1.65.

React stays below 19.4 because fiber 9.8 requires it. Read `node_modules/next/dist/docs` before using an unfamiliar Next API: `params` and `searchParams` are promises, and request interception lives in `proxy.ts`.

## 2. Why not Medusa, and how to leave

The master prompt's Medusa stack is written for an empty repo, and its own rule says to preserve an established stack. The server layer is therefore the commerce engine.

If Medusa is approved later, these are the only modules that change: `src/server/catalog.ts`, `cart.ts`, `orders.ts` and `actions/*`. Routes and components import the types those modules export and never touch the database, so the UI survives a swap.

## 3. Shape

```
Browser
  Server components (pages)  -- read -->  src/server/catalog.ts, cart.ts, orders.ts
  Client islands             -- server actions -->  src/server/actions/*
    world stage, buy box, cart line, shop filters
  3D island (lazy, optional) -- reads world tokens only, never commerce data

src/server/*  -->  Drizzle  -->  PGlite (.data/pglite) or Postgres (DATABASE_URL)
```

```
src/
  app/            routes
  content/        locales/, worlds.ts, catalog.demo.ts, commerce.ts, types.ts, media.generated.json
  server/         catalog, cart, orders, auth, media, rate-limit, payment/, storage/, actions/, db/
  lib/            money, search, validation, action-result, checkout-state
  components/     ui/, shell/, product/, shop/, cart/, world/
  scene/          everything that imports three
tools/demo-media/ demo garment renderer, not deployed
public/media/demo/
tests/unit/  tests/e2e/
drizzle/          migrations
```

## 4. Data model

```
products 1-n product_colors 1-n variants (size, stock, sku)
products 1-n product_worlds (world slug, position)
products 1-n product_media, media_overrides
orders   1-n order_items --> variants
admin_users (role) 1-n admin_sessions
admin_users 1-n admin_activity, inventory_adjustments  (actor, set null on removal; email copied)
variants 1-n inventory_adjustments (set null on delete; product, colour, size, SKU copied)
customers 1-n customer_sessions
promotions (code unique, stored only: no checkout applies them yet)
```

`products.archived_at` marks an archived product: unpublished, out of the panel's working lists, kept for its orders.

Worlds are code (`src/content/worlds.ts`), because they are art direction. Membership is data (`product_worlds`), because it is merchandising.

After seeding, the database is the source of truth for every product field.

Money is integer whole soʻm. Columns are named `*_uzs`.

## 5. Contracts

**Prices.** The server computes every total. A price from a client is never read. The cart cookie holds only variant ids and quantities.

**Stock.** `placeOrder` is one transaction. Each line runs a guarded `UPDATE ... WHERE stock >= q`. If any line changes no row, the whole order rolls back.

**Idempotency.** Each checkout page load carries one key with a unique constraint. A double submit returns the first order.

**Order access.** The confirmation page is reached only through a random 32-byte token. This replaces the prompt's `/order/success`, because a static URL cannot prove a legitimate order.

**Order status.** pending, then confirmed, packed, shipped, delivered. Cancel any time before shipping. Return from shipped or delivered. Cancelling or returning restores stock exactly once.

**Payment.** `PaymentProvider` is the seam. Only pay on delivery exists. Click and Payme need merchant credentials and sandbox accounts, and must add signed callback handling that is idempotent and checks amount and currency on the server.

**Delivery.** Regions map to zones in `src/content/commerce.ts`. The server looks up the price. Admin editing arrives in Stage 2.

## 6. Security

Admin access is checked on the server in every read and action. `proxy.ts` is only a convenience redirect. Passwords use scrypt. Sessions are hashed rows in an HttpOnly, SameSite=Lax cookie, Secure in production. Login and checkout are rate limited in process memory, which is correct for one process and must move to shared storage before scaling out. Uploads are re-encoded by sharp, capped at 10 MB and named by the server.

Shopper accounts (`/login`) are a separate boundary from admin: `customers` and `customer_sessions` tables, the `vv_customer` cookie, `src/server/customer-auth.ts` and their own rate limits, so a shopper session can never pass `requireAdmin` and shopper traffic cannot lock the admin out. Both kinds of session share `src/server/session-token.ts`: 32 random bytes in the cookie, only the SHA-256 stored. An unknown email and a wrong password take the same time and give the same answer. A `?next=` destination passes `safeNextPath` (same-site paths only, never `/login`, `/register` or `/admin`) on the page and again in the action.

Registration (`/register`, `registerCustomer`) writes only a `customers` row (name, lower-cased email, scrypt hash) and then opens the same session a sign-in would. `registerSchema` reads exactly name, email, password and confirmation, so no client field can set a role, an id or a hash; the confirmation is compared and dropped. Passwords are judged by length (10 to 256) and two weak forms only, never by composition rules. The insert uses `ON CONFLICT DO NOTHING` on the unique email index instead of a lookup first, so racing requests make one account. A taken email is reported as taken: without email verification there is no way to hide it that does not lie to the shopper, so the per-address limit (`customerRegisterLimiter`, 10 per 15 minutes, checked before hashing) is what slows enumeration. Accounts are usable at once; there is no verification step and nothing claims a message was sent. Server Actions carry Next's same-origin check, and the cookie is SameSite=Lax. `customers.name` arrived in migration `0002` and is null for older accounts. `DEMO_CUSTOMER_EMAIL` and `DEMO_CUSTOMER_PASSWORD` create one shopper account at boot for local testing; they are ignored in production.

The admin panel (`src/app/admin`) has its own frame: `PublicChrome` leaves the shop's header and footer out of `/admin/*`, and `app/admin/admin.css` loads only there. Roles live in `admin_users.role` (`owner`, `manager`, `editor`, migration `0003`; existing rows became `owner`) and map to permissions in `src/lib/admin-roles.ts`. `requireAdmin(permission)` reads the role from the session's database row, never from the request, and throws `ForbiddenError`; every read in `src/server/admin/queries.ts` and every action in `src/server/actions/admin*.ts` calls it, so hiding a menu item is never the only guard, and the panel layout cannot be relied on because it does not run for server actions. Actions go through `guarded()` (`src/server/admin/guard.ts`), which turns refusals into results and logs failures without input. Each change writes an `admin_activity` row in the same transaction: flat metadata only, no passwords, tokens or shopper contact details, and no code path updates or deletes it. Stock changes lock the variant row (`FOR UPDATE`) and write `inventory_adjustments` with the old and new count and the reason. A product is deleted only when no order line points at it and its handle is typed back; otherwise it is archived. The owner adds staff with a temporary password (12+ characters); an owner cannot change or remove themselves, and the last owner cannot be demoted (owners are locked in the transaction). Correlated subqueries in a select list are written with explicit aliases, because Drizzle leaves column references unqualified in a single-table select.

Virtual try-on (`/try-on`) keeps the camera in the browser. `useCamera` starts only from a click, keeps one stream, and stops its tracks on stop, unmount, hidden tab and `pagehide`. Pose tracking is MediaPipe Pose Landmarker lite (`@mediapipe/tasks-vision`, Apache-2.0), dynamically imported after the camera starts; its WASM is served from `node_modules` by `app/vendor/mediapipe/wasm/[file]` (two whitelisted names) and the model from `public/vendor/mediapipe/`, so no request leaves the site. `src/lib/try-on/geometry.ts` holds the pure parts: a One Euro filter for jitter, the garment's bounds and shoulder line read from a cut-out packshot's alpha, and the placement from shoulder landmarks (tilt, yaw from landmark depth, reasons when it cannot place). Only AI packshots (`role: "render"`) have a transparent background, so only they are offered for AR.

The garment is bent onto the body rather than placed on it. `src/lib/try-on/rig.ts` says where each garment type's torso corners, front neckline and sleeve axes (shoulder seam, elbow, cuff) sit in its packshot; one rig per type works because `assets:import` frames every packshot the same way, and the values were read off the packshots on a 5 % grid. `src/lib/try-on/warp.ts` is the pure geometry: the torso is an 8 x 10 triangle grid mapped bilinearly from the garment's shoulder and hem corners to the smoothed shoulders and hips (rigid above the shoulder line, so a hood keeps its shape), and each sleeve is a strip mapped segment by segment onto shoulder, elbow and wrist when the arm is seen, hanging as in the packshot when not. `garment-renderer.ts` splits the packshot once into a torso band and the sleeves around it, then draws each triangle with one affine `setTransform` and a clip. `body-masker.ts` runs MediaPipe Selfie Multiclass (16 MB, `public/vendor/mediapipe/`, loaded after the pose because both fetch the same runtime) and keeps the mask on the GPU: `DrawingUtils.drawCategoryMask` draws hair and face, and bare skin, straight into two small canvases, because reading the mask back to the CPU stalled the GPU for about 90 ms a frame. The draw order is torso, then the wearer from the current frame (hair and face anywhere; skin only in the neck and, below short sleeves, the forearms, so a low neckline worn underneath stays covered), then sleeves, then hands past the cuffs. The mask refreshes every second to fourth frame depending on what a frame costs: on an Intel UHD laptop GPU a fitted frame costs about 40 ms (25 fps), the same as pose alone, with the mask every fourth frame. The model was downloaded from Google's MediaPipe model bucket; check its model card licence before launch. Limits: no cloth simulation, no back view, and the rig is per garment type, so a packshot framed differently needs its own values.

The AI result is a separate path: `tryOnAction` checks configuration, explicit consent and `tryOnLimiter` (5 per 10 minutes per address) before decoding anything, re-encodes the photo without metadata, sends it to the provider behind `src/server/try-on/provider.ts`, and returns the image without storing it. Two providers sit behind it. `TRYON_PROVIDER=huggingface` is free: the public IDM-VTON Space through `@gradio/client` (`src/server/try-on/huggingface.ts`), `/tryon` read from the Space's API and tried end to end on 2026-11-19 (30 to 90 s, 768 x 1024); the model and Space are CC BY-NC-SA 4.0, so it is for the demo shop, not commercial use, and it sends the photo to a service we do not run, which the consent line names. It is never chosen by default. FASHN v1.6 (`FASHN_API_KEY`, paid) is the commercial option; its status path follows the official quickstart and should be confirmed on the first real call. The photo is cropped to 3:4 around its salient region (`sharp.strategy.attention`) before sending, because both models squeeze a landscape frame into a portrait one. `next.config.ts` keeps `camera=()` site-wide and allows `camera=(self)` on `/try-on` only.

`.env*` is ignored except `.env.example`, which has blank values.

## 7. 3D and motion

`src/scene/` is reached only through a dynamic client import, so three never enters the initial bundle. Commerce, prices and navigation never depend on it. DESIGN-SYSTEM section 6 has the shot list.

## 8. Operating rules

- Work only on `E:`. Drive C: is nearly full. The npm cache is set in `.npmrc`.
- PGlite allows one process, and `next dev` allows one server per folder. Use port 3100 and stop only your own server.
- Unit tests use in-memory PGlite and never touch `.data`.
- Pages that read the database use `export const dynamic = "force-dynamic"`, so `next build` never opens it.
