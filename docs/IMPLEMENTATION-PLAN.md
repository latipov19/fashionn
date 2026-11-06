# Implementation plan

Audience: whoever picks up the next milestone. Status marks are updated as work is verified.

Legend: [x] done and verified, [~] partly done, [ ] not started.

## Stage 0: audit and decisions
- [x] Repo, skills and toolchain inspected
- [x] Baseline snapshot committed
- [x] Brief, architecture, design system and plan written

## Stage 1: working vertical slice
- [ ] Domain moved to products, worlds, UZS and Uzbek checkout fields
- [ ] Demo catalog and generated imagery
- [ ] Design tokens and site shell
- [ ] Home with world switching
- [ ] `/worlds`, `/worlds/[slug]`
- [ ] `/shop` with search and filters
- [ ] `/products/[handle]`
- [ ] `/cart`
- [ ] Sunray Portal 3D scene and fallback
- [ ] Unit, e2e and axe checks

## Stage 2: ecommerce operations
- [ ] Guest `/checkout` and order page
- [ ] Delivery zones editable in admin
- [ ] Admin UI: products, stock, media, orders
- [ ] Policy pages marked for owner review
- [ ] Click and Payme adapters: blocked on merchant accounts

## Stage 3: signature world experience
- [ ] `/lookbook`
- [ ] `/outfit-lab` with shareable selection
- [ ] Deeper world choreography

## Stage 4: launch readiness
- [ ] Full Playwright journeys, security and performance review
- [ ] Provider sandbox tests
- [ ] Deployment, backups, alerting, consent, legal, real assets and real devices
