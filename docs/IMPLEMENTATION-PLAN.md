# Implementation plan

Audience: whoever picks up the next milestone. Status marks are updated as work is verified.

Legend: [x] done and verified, [~] partly done, [ ] not started.

## Stage 0: audit and decisions
- [x] Repo, skills and toolchain inspected
- [x] Baseline snapshot committed
- [x] Brief, architecture, design system and plan written

## Stage 1: working vertical slice
- [~] Domain moved to products, worlds, UZS and Uzbek checkout fields: server code done, unit tests still target the old model
- [x] Demo catalog and generated imagery (`npm run media:generate`)
- [x] Design tokens and site shell
- [x] Home with world switching
- [ ] `/worlds`, `/worlds/[slug]`
- [ ] `/shop` with search and filters
- [ ] `/products/[handle]`
- [ ] `/cart`
- [x] Sunray Portal 3D scene and fallback (desktop and phone Chrome; real devices are Stage 4)
- [ ] Unit, e2e and axe checks

## Stage 1b: premium visuals from the owner's references

References: a "Try the Look" lineup of full-body looks with an "in this look" panel, a 3D product carousel with a large wordmark behind it, and a full-bleed photographic hero.

- [x] AI asset pipeline: prompts from the catalogue (`npm run assets:brief`), import and optimisation (`npm run assets:import`), AI images lead over flats
- [ ] Pilot asset: Noir Oversize Hudi, black, packshot and GLB (owner generates)
- [ ] Remaining AI assets: 37 packshots, 4 looks, 8 heroes, GLBs where useful (owner generates)
- [ ] Try the Look lineup
- [x] 3D product carousel and GLB viewer: the 3D Showroom on the home page (DESIGN-SYSTEM section 6, scene 3). Checked with one sample GLB in desktop Chrome, phone-sized Chrome and reduced motion; real devices are Stage 4
- [ ] Photographic hero per world

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
