# Lierne MVP scope

Audience: the engineers building the first version of the store.

`docs/BRIEF.md` is the design source of truth. This file overrides it wherever they conflict. The client will hand over their own spec after the MVP, so brand, catalog, copy and tokens must stay in replaceable modules, never scattered through components.

Status words matter here. Nothing in the brief has been measured. Report what you ran and saw, and say plainly what you did not check.

## 1. What the MVP must do

A shopper can walk the home scene, browse the shop, open a piece, pick colour and size, add to cart, check out as a guest, and land on a confirmation page. The owner can sign in, edit pieces and stock, add a new piece, upload a real photo, and move an order through its statuses.

Both paths must work on a real database, end to end, on desktop and at 360 px wide.

## 2. Overrides of the brief

| Brief | MVP decision | Why |
|---|---|---|
| 9.3 Step 2: XPBD cloth simulation | Analytic height field for folds, evaluated from the same spec data (`gatherPct`, cloth `bend`, `gsm`, `seed`) | A flat-hung garment is close to a height field, and this avoids a simulator |
| 9.3 Step 5: 128-sample accumulation in RGBA32F | Single-pass WebGL2 fragment shader render with analytic slit, soft shadow and neutral tone map | Far less tooling |
| 9.5 Spike gate | Still applies. Lintel Coat, Chalk, morning must be reviewed by eye before the other pieces are rendered | The main visual risk |
| 15: Stripe Payment Element | Pay on delivery behind a `PaymentProvider` interface. Checkout says clearly that no online payment exists yet | No account or keys exist. Stripe slots in later |
| 15: stock decremented by webhook | Stock is decremented in the same transaction that creates the order | No webhook exists |
| 15: S3 storage | `StorageProvider` interface, local implementation writing to `public/uploads` | No bucket exists |
| 15: `carts` and `cart_items` tables | Cart lives in an HttpOnly cookie of variant ids and quantities, at most 20 lines. No prices in it. Server re-reads everything | Works without client JS, no sync problems |
| 15: PostgreSQL | Drizzle, Postgres dialect. PGlite in `.data/pglite` when `DATABASE_URL` is empty, `pg` when set | No Postgres or Docker on this machine |
| 7.7 statuses paid, packed, shipped, refunded | `placed`, `packed`, `shipped`, `delivered`, `cancelled`. Cancelling restores stock exactly once | Matches pay on delivery |
| 7.11 and 9.4 Media tool with hang-line dragging | Upload, enter a focal point, `sharp` crops to 4:5 and writes the three widths. Choose the first image, hide an image, revert to generated | The drag tool is polish |
| 8.3 Garment meshes from `.bin` | Garments in the live scene are textured planes using baked cutouts with alpha | No simulation meshes exist |
| 8.6 Cloth self-shadow ray march, sheen and weave at runtime | Dropped at runtime. Baked into the cutouts. The slit mask still decides what is lit | Runtime stays small |
| 8.3 `SunVolumes`, `Dust` | Optional. Add only after everything else in the scene passes review | Not the signature |
| 16 Acceptance: `axe` clean, real-device checks | Run axe through Playwright. Real-device checks are listed as unverified | No devices available |

Everything else in the brief stands, including tokens, fonts, copy, the one-scale rail, the placard rule that text never sits on canvas or image, hours, tiers, and the states table.

Generated media is not stored in the database. At runtime, `getMediaFor(piece, colourway)` merges `src/content/media.generated.json` with uploaded rows from `product_media`, with hide and order applied. No reseed is needed when the images change.

## 3. Project layout

```
src/
  app/                 routes
  content/             types.ts, cloths.ts, pieces.ts, copy.ts, media.generated.json
  server/
    db/                schema.ts, client.ts, seed.ts
    catalog.ts  cart.ts  orders.ts  auth.ts  media.ts  newsletter.ts  rate-limit.ts
    payment/           provider.ts, pay-on-delivery.ts
    storage/           provider.ts, local.ts
  lib/                 money.ts, hours.ts, validation.ts, cut-sheet.ts
  components/          ui/, shop/, product/, cart/, checkout/, admin/, home/
  scene/               everything that imports three.js
tools/pipeline/        renderer, not part of the deploy
public/media/generated/
tests/unit/  tests/e2e/
drizzle/               migrations
```

The content modules seed the database. After seeding, the database is the source of truth for every piece field, including `cut` and `details` as JSONB, so the owner can add pieces from admin.

## 4. Engineering rules

- Work only under `E:\fashion`. Drive C: is full, so never install or write anything there. In Bash, begin with `cd /e/fashion`. The npm cache is set by `.npmrc`.
- Next.js is 16.4.5. Read `node_modules/next/dist/docs` before using an API you are unsure of. Route `params` and `searchParams` are promises, and request interception lives in `proxy.ts`.
- Pin dependencies exactly. Keep React on 19.3.x because `@react-three/fiber` 9.8.2 requires below 19.4.
- Move `sharp` to `dependencies` when server code uses it.
- PGlite allows one process. Keep a single client on `globalThis`. Pages that read the database use `export const dynamic = "force-dynamic"`, so `next build` never opens it. Migrations run on first use, and an empty `pieces` table seeds itself, so `npm run dev` works on a fresh checkout with no extra step.
- `next dev` allows one server per project folder, and PGlite cannot be shared. Use port 3100 and stop your server when finished. Find the process listening on the port and stop only that one.
- Unit tests use in-memory PGlite and never touch `.data`.
- Prices are integer cents. The server recalculates every total. A price from the client is never read.
- Validate every input with Zod at the server boundary. Enforce auth on the server in every admin action and route, not only in `proxy.ts`.
- Order placement is one transaction. Each line runs `UPDATE variants SET stock = stock - q WHERE id = ? AND stock >= q`, and if any line changes no row, the whole order rolls back and the shopper sees the stock message from brief section 11. A client idempotency key has a unique constraint, so a double submit returns the first order.
- Confirmation URLs use a random token of at least 32 bytes. Admin passwords use `scrypt`. Sessions are server-side rows with a hashed token, in an HttpOnly, SameSite=Lax cookie that is Secure in production. Login and checkout are rate limited. The limiter is in memory, which is correct for one process, and a comment says so.
- Uploads: accept only images that `sharp` can decode, cap at 10 MB, write only re-encoded output, and use generated file names.
- Read `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment. Create `.env.local` with a generated password for local use. Never print its contents or copy it anywhere.
- Do not run `git init` or commit. Do not add a dependency that is not needed.
- Follow the skills in `.claude/skills` that fit the work. They are instructions for how to do the job, so read the relevant `SKILL.md` first.
- All visible text comes from the brief's copy or from `src/content/copy.ts`, in the brief's voice. No lorem ipsum, and no control that does nothing.
