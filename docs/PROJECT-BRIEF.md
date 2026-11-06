# VYBEVERSE: project brief

Audience: anyone building or reviewing this store.
Status: Stage 0 decisions, 2026-11-06. VYBEVERSE is a working name. Trademark and domain are unchecked.

## What this is

A direct-to-consumer fashion store for customers in Uzbekistan, where shopping feels like discovering a personal aesthetic universe, while buying stays quick. Positioning: **Shop by vibe, not just by category.**

Four worlds are curated collection filters plus art direction. They are not separate stores or databases.

| World | Language | Assortment |
|---|---|---|
| DARK MODE | Black, graphite, hard directional light, sharp silhouettes | Streetwear |
| SOFT SIGNAL | Warm stone, off-white, airy type | Calm editorial minimalism |
| CHROME FUTURE | Charcoal, controlled silver, sculptural | Techwear |
| RAW ENERGY | Muted olive, industrial texture, kinetic type | Experimental layering |

**SHOP FAST** is always one click away: a plain accessible catalog with search, filters, visible prices, cart and checkout. No intro, animation or 3D stands between a shopper and buying.

## Audit of what already existed

`E:\fashion` held a one-day-old MVP for a brand called Lierne: tested commerce server code and almost no UI.

- Kept: Next 16, React 19, Drizzle, PGlite locally and Postgres in production, cookie cart, one-transaction order placement, idempotency, stock guards, admin auth, upload processing, rate limits.
- Replaced: brand, copy, catalog, rooms and hours, cloth physics, USD, Western checkout fields.
- Baseline before any change: `tsc` clean, `eslint` clean, 115 of 115 unit tests passing.
- History: the old state is commit 1 of the repo. The old briefs are in `docs/archive/`.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Commerce backend | Keep the existing Drizzle backend, no Medusa | The master prompt recommends Medusa for an empty repo and says to preserve an existing stack unless migration is demonstrably necessary and approved. Neither holds. This machine also has no Postgres or Docker, which Medusa needs. See ARCHITECTURE section 2 for the exit path |
| Language | Uzbek Latin primary, locale modules ready for Russian and English | Overrides the earlier English-only decision |
| Currency | UZS, stored as integer whole soʻm | Soʻm prices have no practical fraction. Providers that use tiyin convert inside their adapter |
| Money online | Pay on delivery only, stated plainly | No merchant account exists |
| Imagery | Generated demo garment flats, labeled DEMO | No owner photography exists. Real uploads replace them with no code change |
| Demo labeling | Site-wide notice plus a tag on each product | Prices and stock are invented for testing and must never read as real offers |

## Assumptions the owner must confirm

- Brand name, trademark, domain.
- Launch market and legal entity.
- Real inventory, photos, prices, size charts, fabric facts.
- Delivery zones and prices. The current values are placeholders.
- Click and Payme merchant onboarding.
- Return, privacy and delivery policies. Legal review is required.

## Out of scope for MVP

Cloth simulation, virtual try-on, a custom payment engine, a separate admin app, microservices, accounts and order history.
