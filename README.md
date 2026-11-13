# VYBEVERSE

Oʻzbekiston uchun onlayn kiyim doʻkoni. Shiori: **“Kategoriya boʻyicha emas, vayb boʻyicha xarid qiling.”**

> **Holat: ishlab chiqilmoqda, demo.** Katalogdagi mahsulotlar, narxlar va qoldiqlar namuna sifatida oʻylab topilgan. Haqiqiy savdo yoʻq. VYBEVERSE hozircha ishchi nom: brend va domen tekshirilmagan.

---

## Mundarija

1. [Loyiha haqida](#loyiha-haqida)
2. [Hozir nima ishlaydi, nima yoʻq](#hozir-nima-ishlaydi-nima-yoʻq)
3. [Talablar](#talablar)
4. [Localhostda ishga tushirish](#localhostda-ishga-tushirish)
5. [Sozlamalar (.env.local)](#sozlamalar-envlocal)
6. [Maʼlumotlar bazasi](#maʼlumotlar-bazasi)
7. [Buyruqlar](#buyruqlar)
8. [Loyiha tuzilishi](#loyiha-tuzilishi)
9. [Asosiy qoidalar](#asosiy-qoidalar)
10. [Muammolar va yechimlar](#muammolar-va-yechimlar)
11. [Qoʻshimcha hujjatlar](#qoʻshimcha-hujjatlar)

---

## Loyiha haqida

Doʻkon kiyimni javon boʻyicha emas, kayfiyat boʻyicha guruhlaydi. Toʻrtta **olam** bor. Har biri alohida doʻkon emas, balki tanlangan kolleksiya va oʻziga xos dizayn:

| Olam | Uslub | Demo mahsulotlar |
|---|---|---|
| **DARK MODE** | Qora, grafit, oʻtkir siluetlar. Streetwear | 5 |
| **SOFT SIGNAL** | Iliq tosh rang, oq, yengil shrift. Tinch minimalizm | 5 |
| **CHROME FUTURE** | Koʻmir rang, kumush. Techwear | 6 |
| **RAW ENERGY** | Zaytun rang, industrial tekstura. Qatlamli kiyim | 6 |

Bitta mahsulot bir nechta olamda boʻlishi mumkin, jami 20 ta mahsulot bor.

**Shop Fast** — animatsiyasiz oddiy katalog: qidiruv, filtrlar, narx, savat va rasmiylashtirish. Xaridor xohlasa, olamlarni chetlab oʻtib toʻgʻridan-toʻgʻri xarid qiladi.

**Asosiy qarorlar:**

- Til oʻzbek (lotin). Rus va ingliz tillari uchun joy tayyor.
- Pul birligi soʻm. Narxlar butun soʻmda saqlanadi.
- Toʻlov faqat yetkazib berishda. Click va Payme uchun merchant akkaunt kerak, ular hali ulanmagan.

**Texnologiyalar:** Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 6, Tailwind CSS 4, Drizzle ORM. Lokal kompyuterda PGlite (brauzersiz ishlaydigan Postgres) ishlatiladi, serverda haqiqiy PostgreSQL. Shuningdek Zod 4, Vitest 5 va Playwright. 3D: three.js va React Three Fiber. Animatsiya: GSAP (ScrollTrigger).

---

## Hozir nima ishlaydi, nima yoʻq

Loyiha avval **Lierne** nomli boshqa doʻkon edi. Hozir u VYBEVERSE'ga koʻchirilmoqda. Dizayn tizimi, sayt qobigʻi va olam sahifalari tayyor. Savdo mantigʻi serverda tayyor, lekin qolgan sahifalar hali yozilmagan.

### ✅ Ishlaydi

| Nima | Izoh |
|---|---|
| Olam sahifalari | Navbar'dagi 5 ta sahifa, har biri desktop'da bitta ekranga sigʻadi (telefonda oddiy scroll): `/` — **Sunray Portal** (3D plisse halqa, ichida haqiqiy mahsulot) va 4 ta olam almashtirgichi; `/drop` — The Current Drop (4 ta mahsulot); `/showroom` — 3D Showroom; `/look` — Build Your Look (olamdagi toʻliq obraz va jami narx); `/about` — manifest, katalog raqamlari va «Xarid qanday ishlaydi». Olam tanlanganda butun sayt rangi, shrifti va portal materiali oʻzgaradi. Olam URL'da saqlanadi (`?world=soft-signal`) va sahifadan sahifaga oʻtganda ham saqlanib qoladi. Har sahifa oxirida «Keyingi sahifa» havolasi bor. |
| Sunray Portal zaxirasi | WebGL boʻlmasa, `prefers-reduced-motion` yoqilgan boʻlsa yoki Yengil rejimda 3D yuklanmaydi. Oʻrniga xuddi shu matematikadan chizilgan SVG poster chiqadi. 3D qismi sahifa chizilgandan keyin, brauzer boʻsh paytda yuklanadi. |
| 3D Showroom | `/showroom` sahifasida. Olamning 7 tagacha mahsuloti yoy boʻylab turadi, orqada katta VYBEVERSE yozuvi. 3D modeli (GLB) bor mahsulot haqiqiy model boʻlib chiqadi: sichqoncha yoki barmoq bilan 360° aylantiriladi va biroz yuqori-pastga egiladi, qoʻyib yuborilgach 2.5 soniyadan keyin oʻzi sekin aylanadi, ↺ tugmasi old tomoniga qaytaradi. Modeli yoʻq mahsulot qimirlamaydigan rasmli kartochka boʻlib turadi va ostida «3D modeli hali yoʻq» deb yoziladi. Modeli bor mahsulotlar birinchi turadi. GLB faqat tanlangan mahsulot va yonidagi ikkitadan yuklanadi. 3D boʻlim ekranga yaqinlashganda yuklanadi va faqat ekranda koʻrinib turganda chiziladi. Harakat kamaytirilgan boʻlsa 3D qoladi, lekin oʻzi aylanmaydi. WebGL boʻlmasa, Yengil rejimda yoki olamda birorta model boʻlmasa oʻrniga oddiy CSS karusel chiqadi va sababi yoziladi. |
| Dizayn tizimi | Ranglar, shrift ovozi va portal materiali faqat `src/content/worlds.ts`da belgilanadi. Shriftlar: Geologica, Sofia Sans Extra Condensed, Cormorant. |
| Sayt qobigʻi | Demo bandi, suzuvchi shisha header (5 ta sahifa havolasi, qidiruv, savat soni; 1200 px dan tor ekranda menyu tugmasi, unda olamlar ham bor), footer va **Yengil rejim** tugmasi (3D, harakat va blur'ni oʻchiradi, brauzerda saqlanadi). |
| Mijoz kirishi `/login` | Bosh sahifa uslubidagi kirish sahifasi: email, parol (koʻrsatish/yashirish tugmasi bilan), maydonni tark etganda va yuborishda tekshiruv, yuklanish holati, xato xabarlari oʻzbekcha. Tanlangan olam sahifada ham, kirgandan keyin ham saqlanadi. `?next=/look` kabi faqat sayt ichidagi manzilga qaytaradi, tashqi manzillar rad etiladi. Kirgan mijoz `/login`ni ochsa, darhol oʻtkazib yuboriladi. Sessiya HttpOnly cookie'da, admin sessiyasidan butunlay alohida (boshqa jadval, boshqa cookie, boshqa urinish limiti). Header'da hozircha kirish tugmasi yoʻq: sahifa manzil orqali ochiladi. |
| 404 sahifa | Nomaʼlum manzil va hali qurilmagan sahifalar VYBEVERSE uslubidagi oʻzbekcha 404 sahifani ochadi, bosh sahifa va dropga qaytish tugmalari bilan. |
| Demo rasmlar | 20 ta mahsulotning har bir rangi uchun kod orqali chizilgan kiyim eskizi (37 ta rasm, 3 oʻlchamda). Rasm burchagida DEMO yozuvi bor. |
| AI materiallar zanjiri | Haqiqiy kiyim yoʻqligi sababli suratlar va 3D modellar AI orqali yaratiladi. Har bir fayl uchun prompt: [docs/AI-PROMPTS.md](docs/AI-PROMPTS.md), yoʻriqnoma: [docs/AI-ASSETS.md](docs/AI-ASSETS.md). Import qilingan AI surati eskizdan oldinga chiqadi. |
| Maʼlumotlar bazasi | Birinchi soʻrovda oʻzi yaratiladi, migratsiya qilinadi va demo katalog bilan toʻldiriladi. |
| Savdo mantigʻi (server) | Savat, buyurtma berish, qoldiqni kamaytirish, buyurtma holatlari, admin kirishi, rasm yuklash va soʻrovlarni cheklash. Bu kod `src/server/` ichida tayyor, lekin uni ishlatadigan sahifalar hali yoʻq. |
| `/uploads/<fayl>` | Admin yuklagan rasmlarni beradi. |

### ❌ Hali yoʻq

- `/shop`, `/worlds`, mahsulot sahifasi, `/cart`, `/checkout` — hali yozilmagan, 404 sahifani ochadi.
- Admin panel. `/admin` manzili `/admin/login`ga yoʻnaltiradi, u yerda esa sahifa yoʻq (404).
- Roʻyxatdan oʻtish, parolni tiklash, mijoz kabineti va chiqish tugmasi. Kirish sahifasida ular «Tez orada» deb belgilangan, soxta havola yoʻq.
- Haqiqiy mahsulot fotolari (hozir kod orqali chizilgan demo eskizlar) va onlayn toʻlov.
- Mahsulot kartalari, qidiruv va savat tugmalari hozircha 404 sahifaga olib boradi, chunki bu sahifalar keyingi qadamlarda quriladi.

### ⚠️ Maʼlum muammolar

| Muammo | Tafsilot |
|---|---|
| Testlarni `E:\fashion` (katta **E**) papkasidan ishga tushiring | Windows'da terminal `e:\fashion` (kichik e) yoʻlida ochilgan boʻlsa, Vitest oʻzini ikki nusxada yuklaydi va `Vitest failed to find the runner` xatosini beradi. Bu kod xatosi emas: `cd E:\fashion` qilib qayta ishga tushiring. |
| Konsolda `THREE.Clock` ogohlantirishi | React Three Fiber 9.8 kutubxonasining ichidan keladi. Ishlashga taʼsir qilmaydi, kutubxona yangilanganda yoʻqoladi. |

Ish rejasi va bosqichlari: [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md).

---

## Talablar

- **Node.js 22 yoki undan yangi.** Loyiha Node 24.14 va npm 11.9 bilan tekshirilgan.
- **Internet**, faqat birinchi ishga tushirishda: `next/font` Google shriftlarini yuklab oladi.
- PostgreSQL, Docker yoki boshqa server **kerak emas**: lokal baza loyiha papkasida yaratiladi.
- Taxminan 1 GB boʻsh operativ xotira: lokal baza ishlayotganda bir oʻzi ~600 MB oladi. Batafsil: [Muammolar va yechimlar](#muammolar-va-yechimlar).

---

## Localhostda ishga tushirish

```bash
git clone https://github.com/latipov19/fashionn.git
cd fashionn
npm install
```

Sozlamalar faylini namunadan nusxalang:

```bash
# macOS / Linux / Git Bash
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Serverni ishga tushiring:

```bash
npm run dev
```

Brauzerda oching: **http://localhost:3100**

Birinchi ochilish 10–30 soniya olishi mumkin. Bu vaqtda Next sahifani kompilyatsiya qiladi, baza yaratiladi va demo mahsulotlar yoziladi. Keyingi ochilishlar bir soniyadan kam vaqt oladi.

Serverni toʻxtatish uchun terminalda `Ctrl + C` bosing.

> **Eslatma (.npmrc):** repodagi `.npmrc` fayli npm keshini `E:\.npm-cache-fashion` papkasiga yoʻnaltiradi, chunki asosiy kompyuterda C: disk toʻla. Kompyuteringizda E: disk boʻlmasa, `npm install`dan oldin `.npmrc` ichidagi `cache=` qatorini oʻchiring.

---

## Sozlamalar (.env.local)

`.env.local` faqat sizning kompyuteringizda turadi va GitHubga **yuklanmaydi** (`.gitignore`da). Repoda faqat qiymatlari boʻsh namuna, `.env.example` saqlanadi.

| Oʻzgaruvchi | Majburiymi | Nima qiladi |
|---|---|---|
| `DATABASE_URL` | Yoʻq | Boʻsh qolsa, lokal PGlite ishlatiladi. Production uchun PostgreSQL manzili: `postgres://user:parol@host:5432/baza`. |
| `ADMIN_EMAIL` | Yoʻq | Birinchi admin akkauntining emaili. Baza ochilganda bunday akkaunt boʻlmasa, yaratiladi. |
| `ADMIN_PASSWORD` | Yoʻq | Oʻsha admin paroli. Uzun, tasodifiy parol qoʻying. |
| `DEMO_CUSTOMER_EMAIL` | Yoʻq | Faqat lokal sinov uchun: `/login`ni sinash uchun mijoz akkaunti. Server ishga tushganda bunday akkaunt boʻlmasa, yaratiladi. Production'da eʼtiborsiz qoldiriladi. |
| `DEMO_CUSTOMER_PASSWORD` | Yoʻq | Oʻsha sinov akkauntining paroli. Faqat sinov uchun ishlatiladigan parol qoʻying. |
| `NEXT_PUBLIC_SITE_URL` | Yoʻq | Saytning toʻliq manzili, metadata va havolalar uchun. Lokalda: `http://localhost:3100`. |
| `HF_TOKEN` | Yoʻq | Hugging Face tokeni (read). `npm run assets:shape` uchun bepul GPU limitini oshiradi. Boʻlmasa, anonim limit ishlatiladi. |

Admin panel hali yozilmagan, lekin akkaunt bazada yaratib qoʻyiladi.

---

## Maʼlumotlar bazasi

**Lokal (standart):** PGlite bazasi `.data/pglite` papkasida saqlanadi va GitHubga yuklanmaydi. Hech narsa oʻrnatish shart emas. Birinchi soʻrovda avtomatik ravishda:

1. `drizzle/` papkasidagi migratsiyalar qoʻllanadi.
2. Mahsulotlar jadvali boʻsh boʻlsa, `src/content/catalog.demo.ts`dagi demo katalog yoziladi: 20 ta mahsulot va 138 ta oʻlcham-rang varianti.
3. `.env.local`da `ADMIN_EMAIL` va `ADMIN_PASSWORD` boʻlsa, admin akkaunti yaratiladi.

**Bazani noldan boshlash:** serverni toʻxtating, `.data` papkasini oʻchiring va `npm run dev`ni qayta ishga tushiring.

**Diqqat:** PGlite bir vaqtda faqat **bitta jarayon**ga ruxsat beradi. `npm run db:seed` ishlatishdan oldin `npm run dev`ni toʻxtating.

**Production:** `DATABASE_URL`ga PostgreSQL manzilini yozing. Migratsiya va seed oʻsha yerda ham avtomatik bajariladi.

**Jadval tuzilishini oʻzgartirish:** `src/server/db/schema.ts`ni tahrirlang, keyin `npm run db:generate` buyrugʻi `drizzle/` ichida yangi migratsiya yaratadi.

---

## Buyruqlar

| Buyruq | Nima qiladi | Hozirgi holati |
|---|---|---|
| `npm run dev` | Dev serverni ishga tushiradi: http://localhost:3100 | ✅ Ishlaydi |
| `npm run build` | Production build | ✅ Ishlaydi |
| `npm run start` | Production serverni ishga tushiradi (avval build kerak) | Avval `npm run dev`ni toʻxtating: PGlite bir vaqtda bitta jarayonga ruxsat beradi |
| `npm run lint` | ESLint | ✅ Xato va ogohlantirish yoʻq |
| `npm run typecheck` | TypeScript tekshiruvi | ✅ Butun loyiha toza |
| `npm test` | Unit testlar (Vitest) | ✅ 117 ta test oʻtadi |
| `npm run test:e2e` | Playwright (Chrome orqali) | `tests/e2e` hali yoʻq |
| `npm run db:generate` | Sxemadan yangi migratsiya yaratadi | — |
| `npm run db:seed` | Bazani migratsiya qiladi va toʻldiradi | Avval `npm run dev`ni toʻxtating |
| `npm run assets:brief` | Katalogdan AI promptlarini `docs/AI-PROMPTS.md`ga yozadi va `assets/incoming` papkalarini yaratadi | Katalog oʻzgarganda ishlating |
| `npm run assets:import` | `assets/incoming`dagi AI fayllarni siqib, saytga ulaydi | Yoʻriqnoma: `docs/AI-ASSETS.md` |
| `npm run assets:shape -- <mahsulot>` | Packshotdan teksturasiz 3D shakl yasaydi (Hugging Face, Tencent Hunyuan3D-2) | Bepul GPU limiti bilan cheklangan |
| `npm run assets:texture` | Shaklni har bir rang packshoti bilan boʻyab GLB yasaydi, kompyuterda | ✅ Ishlaydi |
| `npm run media:generate` | Demo kiyim eskizlarini `public/media/generated`ga chizadi va `media.generated.json`ni yangilaydi | Katalogga mahsulot yoki rang qoʻshilganda ishlating |

---

## Loyiha tuzilishi

```
src/
  app/                  Sahifalar (Next App Router)
    page.tsx            Bosh sahifa: Sunray Portal va olam almashtirgich
    drop/ showroom/     Olam sahifalari: Drop, 3D Showroom,
    look/ about/          Obraz, Biz haqimizda
    not-found.tsx       404 sahifa
    layout.tsx          Umumiy qolip: shriftlar, olam tokenlari, header, footer
    globals.css         Dizayn tizimi: oʻlchamlar, shrift shkalasi, komponent uslublari
    uploads/[file]/     Yuklangan rasmlarni beradi
  components/
    shell/              Header, mobil menyu, footer, Yengil rejim tugmasi
    world/              Hero, Sunray Portal, 3D Showroom, Look, sahifa qobigʻi (WorldPage)
    product/            Mahsulot kartasi, narx
    motion/             Scroll'da paydo boʻlish (GSAP), magnit tugmalar
    ui/                 Tugma, maydon, toast, logo
  scene/                3D sahna. three faqat shu yerda import qilinadi
  content/              Matn va demo maʼlumotlar
    locales/uz.ts       Saytdagi barcha oʻzbekcha matnlar
    worlds.ts           4 ta olam: ranglar, shriftlar, uslub
    pages.ts            Navbar sahifalari va ularning tartibi
    catalog.demo.ts     Demo katalog (20 ta mahsulot)
    commerce.ts         Yetkazib berish hududlari va narxlari (namuna)
  lib/                  Pul, qidiruv, validatsiya, portal geometriyasi (bazasiz kod)
  server/               Bazaga murojaat qiluvchi barcha kod
    catalog.ts          Mahsulotlar, filtrlar, olamlar
    cart.ts             Savat (cookie'da faqat variant id va miqdor)
    orders.ts           Buyurtma berish va holatlari
    auth.ts             Admin kirishi va sessiyalar
    media.ts            Rasmlarni qayta ishlash (sharp)
    home-data.tsx       Katalogni olam sahifalari uchun tayyorlaydi
    actions/            Server actions: sahifalar shular orqali yozadi
    db/                 Sxema, ulanish, seed
    payment/            Toʻlov provayderlari (hozir faqat yetkazib berishda toʻlov)
  proxy.ts              /admin uchun yoʻnaltirish
tools/demo-media/       Demo kiyim eskizlari generatori (saytga kirmaydi)
tools/assets/           AI promptlari va import skripti (saytga kirmaydi)
assets/incoming/        AI asl fayllari (faqat sizning kompyuteringizda, GitHub'ga chiqmaydi)
public/media/generated/ Generator chizgan rasmlar
public/media/ai/        Siqilgan AI rasmlari va 3D modellar
drizzle/                Bazaning migratsiyalari
tests/unit/             Vitest testlari
docs/                   Loyiha hujjatlari
```

Qoida: sahifalar bazaga toʻgʻridan-toʻgʻri murojaat qilmaydi, faqat `src/server/` funksiyalari orqali ishlaydi.

---

## Asosiy qoidalar

Bu qoidalar `src/server/`da allaqachon amalga oshirilgan va oʻzgartirilmasligi kerak:

- **Pul:** hamma joyda butun soʻm, `integer`. Ustunlar `*_uzs` deb nomlangan.
- **Narxni faqat server hisoblaydi.** Brauzerdan kelgan narx hech qachon oʻqilmaydi. Savat cookie'sida faqat variant id va miqdor saqlanadi.
- **Qoldiq:** buyurtma bitta tranzaksiyada beriladi. Biror qatorda qoldiq yetmasa, butun buyurtma bekor qilinadi.
- **Ikki marta bosish:** har bir rasmiylashtirishning oʻz kaliti bor, shuning uchun takroriy bosish ikkinchi buyurtma yaratmaydi.
- **Buyurtma sahifasi** faqat tasodifiy 32 baytli token orqali ochiladi.
- **Buyurtma holatlari:** qabul qilindi → tasdiqlandi → qadoqlandi → yoʻlda → yetkazildi. Bekor qilish yoki qaytarishda qoldiq faqat bir marta tiklanadi.
- **Xavfsizlik:** admin huquqi har bir server amalida tekshiriladi. Parollar scrypt bilan saqlanadi, sessiya cookie'si HttpOnly. Yuklangan rasm sharp orqali qayta kodlanadi va 10 MB bilan cheklangan.

Batafsil: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Muammolar va yechimlar

**`FATAL ERROR: Zone Allocation failed - process out of memory` yoki `Committing semi space failed`**

Kompyuterda boʻsh xotira yetmayapti. Bu kod xatosi emas. Windows'da C: disk toʻlib qolsa, tizim xotirani kengaytira olmaydi. PGlite 9 MB hajmli WASM fayl, uni V8 optimizatsiya qilganda koʻp xotira talab qiladi. Shu sabab `src/server/db/client.ts` V8'ning optimizatsiya kompilyatorini PGlite uchun oʻchiradi. Shundan keyin ham xato chiqsa:

- C: diskda joy boʻshating (kamida bir necha GB);
- brauzer va oʻyin dasturlari kabi koʻp xotira oladigan dasturlarni yoping;
- serverni qayta ishga tushiring.

**`EADDRINUSE: address already in use :::3100`**

3100 portni boshqa dastur band qilgan. Koʻpincha bu shu loyihaning oldin ochilgan oʻz serveri boʻladi: boshqa terminalni tekshiring. PGlite bir vaqtda faqat bitta jarayonga ruxsat beradi, shuning uchun bitta loyiha uchun ikkita server ochmang.

**`An unexpected Turbopack error occurred` / `failed to create junction point ... Access is denied`**

Turbopack `.next\dev` ichida `pglite`, `pg` va `sharp` paketlariga papka havolasi (junction) yaratadi. Windows buni rad etsa, havola oʻrnida boʻsh papka qoladi va har bir sahifa 500 qaytaradi. Kod bunga aloqador emas, bu buzilgan kesh. Serverni toʻxtating (`Ctrl + C`), keshni oʻchiring va qayta ishga tushiring:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

**Saytni `localhost` orqali oching**

Terminalda `Network: http://26.x.x.x:3100` kabi manzil ham chiqadi. Uni ishlatmang: Next dev rejimida bu manzildan keladigan soʻrovlarni bloklaydi, shuning uchun sahifa avtomatik yangilanmaydi va xatolarning tafsilotlari koʻrinmaydi. Har doim **http://localhost:3100** manzilini oching.

**Sahifa 500 xato bersa yoki maʼlumotlar eskirgan boʻlsa**

Serverni toʻxtating, `.data` papkasini oʻchiring va qayta ishga tushiring. Baza yangidan yaratiladi.

**Shriftlar yuklanmasa**

Birinchi ishga tushirishda internet kerak, chunki `next/font` Google Fonts'dan yuklab oladi.

---

## Qoʻshimcha hujjatlar

| Fayl | Mazmuni |
|---|---|
| [docs/PROJECT-BRIEF.md](docs/PROJECT-BRIEF.md) | Gʻoya, olamlar, qabul qilingan qarorlar, egasi tasdiqlashi kerak boʻlgan narsalar |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Texnik tuzilish, maʼlumotlar modeli, qoidalar |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Yangi dizayn tizimi (hali qoʻllanmagan) |
| [docs/AI-ASSETS.md](docs/AI-ASSETS.md) | AI suratlar va 3D modellarni yaratish tartibi |
| [docs/AI-PROMPTS.md](docs/AI-PROMPTS.md) | Har bir fayl uchun tayyor prompt (avtomatik yaratiladi) |
| [docs/IMPLEMENTATION-PLAN.md](docs/IMPLEMENTATION-PLAN.md) | Ish rejasi va bosqichlar |
| [docs/archive/](docs/archive/) | Eski Lierne loyihasining hujjatlari |
| [AGENTS.md](AGENTS.md) | AI yordamchilar uchun koʻrsatmalar |
