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
admin_users 1-n admin_sessions
```

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

Shopper accounts (`/login`) are a separate boundary from admin: `customers` and `customer_sessions` tables, the `vv_customer` cookie, `src/server/customer-auth.ts` and their own rate limits, so a shopper session can never pass `requireAdmin` and shopper traffic cannot lock the admin out. Both kinds of session share `src/server/session-token.ts`: 32 random bytes in the cookie, only the SHA-256 stored. An unknown email and a wrong password take the same time and give the same answer. A `?next=` destination passes `safeNextPath` (same-site paths only, never `/login` or `/admin`) on the page and again in the action. `DEMO_CUSTOMER_EMAIL` and `DEMO_CUSTOMER_PASSWORD` create one shopper account at boot for local testing; they are ignored in production.

`.env*` is ignored except `.env.example`, which has blank values.

## 7. 3D and motion

`src/scene/` is reached only through a dynamic client import, so three never enters the initial bundle. Commerce, prices and navigation never depend on it. DESIGN-SYSTEM section 6 has the shot list.

## 8. Operating rules

- Work only on `E:`. Drive C: is nearly full. The npm cache is set in `.npmrc`.
- PGlite allows one process, and `next dev` allows one server per folder. Use port 3100 and stop only your own server.
- Unit tests use in-memory PGlite and never touch `.data`.
- Pages that read the database use `export const dynamic = "force-dynamic"`, so `next build` never opens it.
