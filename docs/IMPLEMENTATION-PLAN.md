# Implementation plan

Audience: whoever picks up the next milestone. Status marks are updated as work is verified.

Legend: [x] done and verified, [~] partly done, [ ] not started.

## Stage 0: audit and decisions
- [x] Repo, skills and toolchain inspected
- [x] Baseline snapshot committed
- [x] Brief, architecture, design system and plan written

## Stage 1: working vertical slice
- [x] Domain moved to products, worlds, UZS and Uzbek checkout fields, with the unit tests ported to it (117 passing)
- [x] Demo catalog and generated imagery (`npm run media:generate`)
- [x] Design tokens and site shell
- [x] Home with world switching
- [x] World pages from the header: `/drop`, `/showroom`, `/look`, `/about`, each one screen on desktop, world kept in `?world=`
- [ ] `/worlds`, `/worlds/[slug]`
- [ ] `/shop` with search and filters
- [ ] `/products/[handle]`
- [ ] `/cart`
- [x] Sunray Portal 3D scene and fallback (desktop and phone Chrome; real devices are Stage 4)
- [~] Unit, e2e and axe checks: unit tests pass; e2e and axe not written yet

## Stage 1b: premium visuals from the owner's references

References: a "Try the Look" lineup of full-body looks with an "in this look" panel, a 3D product carousel with a large wordmark behind it, and a full-bleed photographic hero.

- [x] AI asset pipeline: prompts from the catalogue (`npm run assets:brief`), import and optimisation (`npm run assets:import`), AI images lead over flats
- [x] Pilot asset: Noir Oversize Hudi, qora and grafit packshots (owner) and GLBs (Hunyuan3D-2 shape, `npm run assets:shape`, dressed per colour by `npm run assets:texture`)
- [~] Same route, one colour each so far: Cut Line Futbolka (sut), Blackout Bomber (qora), Shadow Kargo Shim (qora). DARK MODE's five products all have a 3D model
- [ ] Remaining AI assets: 32 packshots, 4 looks, 8 heroes, GLBs where useful. Generating them from here is blocked on Hugging Face's anonymous GPU quota; an `HF_TOKEN` raises it
- [ ] Try the Look lineup
- [x] 3D product carousel and GLB viewer: the 3D Showroom on the home page (DESIGN-SYSTEM section 6, scene 3). Checked with one sample GLB in desktop Chrome, phone-sized Chrome and reduced motion; real devices are Stage 4
- [ ] Photographic hero per world

## Stage 2: ecommerce operations
- [x] Shopper sign-in `/login`: customer accounts and sessions apart from admin, safe `?next=` redirects, world kept, development account from the environment
- [ ] Registration, password reset, account page and sign-out
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
