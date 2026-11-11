# AI materiallar: yoʻriqnoma

Kim uchun: saytdagi kiyim suratlari, obrazlar va 3D modellarni AI xizmatlarida yaratadigan odam.

Doʻkonda hozircha haqiqiy kiyim yoʻq. Shuning uchun mahsulot suratlari, toʻliq obrazdagi odamlar, hero suratlari va 3D modellar AI orqali yaratiladi. Saytda ularning barchasi **DEMO** deb belgilanadi. Haqiqiy kiyim paydo boʻlganda ular almashtiriladi, kod oʻzgarmaydi.

---

## 1. Nimalar kerak

| Tur | Soni | Qayerda koʻrinadi | Talab |
|---|---|---|---|
| Mahsulot surati (packshot) | 37 (har bir rang) | Kartalar, portal ichi, 3D karusel | PNG, shaffof fon, uzun tomoni kamida 1200 px |
| 3D model | 37 tagacha (ixtiyoriy) | Mahsulotni aylantirib koʻrish | GLB, PBR teksturali |
| Toʻliq obraz (Try the Look) | 4 (har bir olam) | Bosh sahifadagi odamlar qatori | PNG, shaffof fon, boʻyi kamida 1600 px |
| Hero | 8 (har bir olam uchun keng va tik) | Bosh sahifaning birinchi ekrani | Keng: kamida 2400×1350, tik: kamida 1080×1920 |

Har bir faylning aniq nomi va prompti: **[AI-PROMPTS.md](AI-PROMPTS.md)**.

## 2. Qaysi xizmatlar

- **Suratlar uchun:** shaffof fonli PNG bera oladigan rasm AI'si (masalan, ChatGPT'dagi rasm yaratish). Boshqa xizmatlar ham boʻladi. Muhimi, **hamma suratni bitta xizmatda, bir xil sozlamalar bilan** yarating.
- **Fon shaffof chiqmasa:** fonni olib tashlaydigan xizmatdan oʻtkazing (masalan, remove.bg yoki Photoroom).
- **3D uchun:** surat asosida 3D yaratadigan xizmat (masalan, Meshy yoki Tripo, "Image to 3D" boʻlimi). Kirish rasmi sifatida tayyor mahsulot suratini bering. PBR teksturalarni yoqing, poligon soni taxminan 50 000 boʻlsin, GLB formatida yuklab oling.

**Tijoriy foydalanish:** har bir xizmatning shartlarini tekshiring. Baʼzi bepul tariflarda natijani tijoriy maqsadda ishlatish yoki muallifni koʻrsatmasdan ishlatish mumkin emas. Sayt ochiq ishga tushishidan oldin barcha materiallar tijoriy foydalanishga ruxsat berilgan tarifda yaratilgan boʻlishi kerak.

## 3. Ish tartibi

1. **Bitta mahsulotdan boshlang:** *Noir Oversize Hudi*, qora rang. Natija yoqmasa, qolganlariga oʻtmang. Avval promptni birga toʻgʻrilaymiz.
2. `docs/AI-PROMPTS.md`dan promptni **toʻliq, oʻzgartirmasdan** nusxalang va xizmatga bering. 2–4 ta variant yarating.
3. Eng yaxshisini tanlang (qoidalar 4-boʻlimda) va koʻrsatilgan nom bilan saqlang, masalan:
   `assets/incoming/products/noir-oversize-hudi/qora.png`
4. 3D kerak boʻlsa, ikki yoʻl bor:
   - **Meshy yoki Tripo:** oʻsha PNG'ni 3D xizmatiga bering va GLB'ni yoniga xuddi shu nom bilan saqlang: `assets/incoming/products/noir-oversize-hudi/qora.glb`
   - **Akkauntsiz, terminaldan:** `npm run assets:shape -- noir-oversize-hudi` PNG'ni Hugging Face'dagi Tencent Hunyuan3D-2 ga yuboradi va teksturasiz shaklni `assets/incoming/shapes/` ga saqlaydi. Keyin `npm run assets:texture` shu shaklni har bir rangning PNG'si bilan bo'yaydi: old tomoniga surat tushadi, orqasi mato rangida boʻladi. Bitta shakl mahsulotning barcha ranglariga yetadi. Bepul GPU limiti kuniga bir necha shaklga yetadi; `.env.local`ga `HF_TOKEN` qoʻyilsa koʻpayadi.
5. Terminalda ishga tushiring:
   ```bash
   npm run assets:import
   ```
6. Saytni yangilang. Yangi surat eskizdan oldinga chiqadi. 3D model bosh sahifadagi **3D Showroom** boʻlimida chiqadi: modeli bor mahsulot karuselda birinchi turadi va aylanadi.

Papkalar boʻlmasa yoki katalog oʻzgargan boʻlsa, avval `npm run assets:brief` buyrugʻini ishga tushiring. U promptlarni va papkalarni qayta yaratadi.

## 4. Qaysi variantni tanlash kerak

**Tanlang**, agar:
- rang promptdagi rangga yaqin boʻlsa (promptda HEX kodi bor);
- buyum toʻliq koʻrinsa, chetlari kesilmagan boʻlsa;
- choklar, choʻntaklar va yoqa tavsifdagidek boʻlsa;
- fon toza va shaffof boʻlsa.

**Rad eting**, agar:
- suratda logotip, yozuv yoki suv belgisi boʻlsa;
- qoʻl, manekin yoki ilgich koʻrinib qolsa;
- bitta oʻrniga bir nechta buyum chiqsa;
- shakl buzilgan boʻlsa (masalan, yeng oʻrnida uchinchi yeng yoki qiyshiq tugmalar).

**Bir xillik — eng muhim qoida.** Barcha mahsulot suratlari bitta "fotosessiya"dan chiqqandek koʻrinishi kerak: bir xil yorugʻlik, burchak va masofa. Shuning uchun promptlardagi umumiy qism hamma joyda bir xil. Uni oʻzgartirmang.

## 5. Import nima qiladi

`npm run assets:import`:

- **Suratlar:** atrofdagi boʻsh joyni qirqadi va buyumni hammasida bir xil chetlik bilan 4:5 ramkaga joylaydi. Shaffoflikni saqlaydi. 480, 960 va 1600 px kenglikdagi WebP nusxalar va yuklanish paytida koʻrinadigan xira oldindan koʻrinishni yasaydi.
- **Obrazlar:** xuddi shunday, lekin 2:3 ramkada.
- **Hero:** keng va tik formatlarga moslab qirqadi.
- **3D:** modelni markazlaydi, teksturalarni WebP'ga oʻtkazadi va Meshopt bilan siqadi. Fayl 3 MB dan katta boʻlsa, teksturalarni kichraytirib qayta urinadi. Sinovda 7.8 MB lik model 1.8 MB ga tushdi.
- Natijalarni `public/media/ai` papkasiga, roʻyxatni `src/content/media.ai.json`ga yozadi.
- Oxirida holatni koʻrsatadi, masalan: `packshots 1/37, 3D models 1, looks 0/4, heroes 0/8`.

**Ogohlantirishlar:**
- `is not a colour of …` — fayl nomida rang notoʻgʻri. Kerakli nomlar ogohlantirishda yozilgan.
- `no such product` — papka nomi notoʻgʻri.
- `the item is only …px` — surat juda kichik, kattaroq oʻlchamda qayta yarating.
- `still … MB after optimisation` — 3D model juda ogʻir. Poligonlarni kamaytirib qayta yarating.

**Asl fayllar** (`assets/incoming`) katta boʻlgani uchun GitHub'ga yuklanmaydi. GitHub'ga faqat siqilgan nusxalar (`public/media/ai`) chiqadi. Asl fayllarni oʻzingizda saqlab qoʻying.

## 6. Qoidalar

- **Hamma narsa DEMO.** Bu materiallar haqiqiy mahsulot emas. Sayt ularni avtomatik "DEMO" deb belgilaydi va rasm tavsifida "AI orqali yaratilgan namuna rasm, haqiqiy foto emas" deb yozadi.
- **Boshqa birovning modeli boʻlsa, muallifini yozing.** Internetdan olingan model yoki surat (masalan, CC BY litsenziyali) [public/media/ai/CREDITS.md](../public/media/ai/CREDITS.md) fayliga muallifi, manbasi va litsenziyasi bilan yoziladi. Hozir u yerda bitta sinov modeli bor: Night Runner oʻrnidagi krossovka (Shopify, CC BY 4.0). Oʻzingiz yaratgan model kelganda u almashtiriladi va qatori oʻchiriladi.
- **Haqiqiy odamlar va brendlar yoʻq.** Promptlarda tanilgan odamlarning ismi, boshqa brendlar yoki logotiplar ishlatilmaydi.
- **Haqiqiy kiyim kelganda** haqiqiy foto yuklanadi. U avtomatik ravishda AI suratidan oldinga chiqadi (`DESIGN-SYSTEM.md`, 9-boʻlim).
