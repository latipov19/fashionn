/**
 * Writes docs/AI-PROMPTS.md: one copy-ready prompt for every asset the store needs, built from
 * the catalogue so names, colours and looks always match the database. Also creates the
 * assets/incoming folders the files go into. Run with `npm run assets:brief`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoCatalog } from "../../src/content/catalog.demo";
import type { ProductSeed, Silhouette, WorldSlug } from "../../src/content/types";
import { WORLD_SLUGS } from "../../src/content/types";
import { worlds } from "../../src/content/worlds";
import { pickLook } from "../../src/lib/look";

const ROOT = path.resolve(import.meta.dirname, "../..");
const INCOMING = path.join(ROOT, "assets", "incoming");
const OUT = path.join(ROOT, "docs", "AI-PROMPTS.md");

/** English garment descriptions. AI image models follow English far more reliably. */
const garment: Record<string, string> = {
  "noir-oversize-hudi": "oversized heavyweight hoodie in 420 gsm cotton fleece, wide dropped shoulders, kangaroo pocket, ribbed cuffs and hem, clean minimal silhouette, no drawstrings",
  "blackout-bomber": "smooth nylon bomber jacket with ribbed knit collar, cuffs and hem, structured padded lining, centre front zip, cropped straight fit",
  "shadow-kargo": "wide-leg cargo trousers in 300 gsm cotton twill, flat-sewn side cargo pockets, low rise, sharp clean silhouette",
  "cut-line-futbolka": "boxy heavyweight T-shirt in 240 gsm cotton, dense ribbed crew neck, slightly dropped shoulders",
  "night-runner": "low-top running sneaker with breathable mesh upper, synthetic leather overlays and a thick cushioned EVA midsole",
  "still-zigir-koylak": "relaxed lightweight linen shirt with a soft collar, concealed button placket and slightly long length",
  "calm-keng-shim": "high-waisted wide-leg trousers in a lyocell and linen blend, front pleats, fluid drape",
  "quiet-uzun-palto": "below-the-knee wool coat with concealed button front, soft natural shoulders, relaxed fit for layering",
  "drift-midi-yubka": "high-waisted midi skirt in viscose, softly flaring A-line",
  "signal-tote": "large tote bag in heavy 400 gsm cotton canvas with two shoulder handles, big enough for a laptop",
  "mono-shell-kurtka": "three-layer waterproof shell jacket with hood, taped seams and water-resistant zips, straight fit with room for layering",
  "vector-texnik-shim": "stretch technical trousers in polyamide and elastane, articulated knees, tapered leg, mid rise",
  "grid-termo-futbolka": "quick-dry grid-knit performance T-shirt in polyester and elastane, slim fit",
  "orbit-sling": "compact chest sling bag in recycled nylon with a quick-release magnetic buckle and adjustable strap",
  "alloy-krossovka": "sneaker with metallic-finish synthetic panels, mesh inserts and a sculpted rigid rubber sole",
  "field-ish-kurtka": "washed cotton canvas work jacket (chore coat) with four patch pockets and metal buttons, boxy fit",
  "rivet-kargo": "durable cotton ripstop cargo trousers with metal rivets and double-layer knees, wide leg, mid rise",
  "static-hudi": "oversized stone-washed cotton hoodie in 400 gsm, softly uneven washed colour, ribbed cuffs and hem",
  "pulse-kepka": "six-panel washed cotton baseball cap with curved brim and an adjustable metal buckle strap at the back",
  "grit-botinka": "high leather boot with deep lug rubber sole and metal lace hooks",
};

const colourName: Record<string, string> = {
  qora: "black",
  grafit: "graphite grey",
  sut: "off-white milk",
  tosh: "warm stone beige",
  qum: "sand",
  komir: "charcoal",
  kumush: "silver grey",
  zaytun: "olive green",
  loy: "clay brown",
  kul: "ash grey",
};

/** How each kind of item is framed. Image-to-3D tools work best from these views. */
function view(silhouette: Silhouette): string {
  switch (silhouette) {
    case "sneaker":
    case "boot":
      return "a single shoe in a three-quarter side view, toe pointing to the right, slightly from above";
    case "tote":
    case "sling":
    case "cap":
      return "a three-quarter front view, slightly from above";
    default:
      return "a straight front view in ghost-mannequin style (invisible mannequin, the garment holds the shape of a body, no mannequin visible)";
  }
}

const PACKSHOT_STYLE =
  "Professional e-commerce studio packshot. Single item only, centred, the whole item visible with generous empty margin, nothing cropped. " +
  "Soft, even studio lighting from the front left with gentle fill, realistic fabric texture and stitching, true-to-life colour. " +
  "Transparent background (PNG with alpha). If transparency is not available, a plain pure white seamless background. " +
  "No people, no hanger, no props, no logos, no text, no watermark. Photorealistic, sharp focus, 4:5 portrait framing.";

/** One model per world, so the Try the Look lineup reads as four distinct people. */
const model: Record<WorldSlug, string> = {
  "dark-mode": "a young Central Asian man in his early twenties with short dark hair and a neutral, calm expression",
  "soft-signal": "a young Central Asian woman in her mid twenties with dark hair in a low bun and a soft, calm expression",
  "chrome-future": "a young Central Asian man in his mid twenties with short cropped hair and a focused expression",
  "raw-energy": "a young Central Asian woman in her early twenties with shoulder-length dark hair and a confident expression",
};

const heroScene: Record<WorldSlug, string> = {
  "dark-mode": "a city street at night, a single hard directional light cutting diagonally across the frame, deep blacks and graphite tones, wet asphalt reflections",
  "soft-signal": "a calm warm-stone interior with soft morning light through a tall window, off-white, sand and stone tones, airy and quiet",
  "chrome-future": "brushed steel and glass architecture under cool, controlled light, charcoal and polished silver tones, precise and clean",
  "raw-energy": "an industrial concrete space with olive and clay tones, raw textures, a sense of movement with slight motion blur",
};

const piece = (product: ProductSeed) => {
  const colour = product.colors[0]!;
  return `the ${colourName[colour.slug] ?? colour.name} (${colour.hex}) ${garment[product.handle]}`;
};

function packshotPrompt(product: ProductSeed, colourSlug: string, hex: string): string {
  return `${view(product.silhouette)[0]!.toUpperCase()}${view(product.silhouette).slice(1)} of a single ${garment[product.handle]}, colour ${colourName[colourSlug] ?? colourSlug} (${hex}). ${PACKSHOT_STYLE}`;
}

function lookPrompt(world: WorldSlug, pieces: ProductSeed[]): string {
  return (
    `Full-body fashion lookbook photo of ${model[world]}, standing straight and facing the camera, arms relaxed at the sides, feet slightly apart, ` +
    `the entire body visible from head to toe with margin above and below. Wearing ${pieces.map(piece).join("; ")}. ` +
    "Soft, even studio lighting and a subtle contact shadow under the feet. Transparent background (PNG with alpha); if not available, a plain light grey seamless background. " +
    "Photorealistic, natural skin texture, sharp focus, 2:3 portrait. No logos, no text, no watermark."
  );
}

function heroPrompt(world: WorldSlug, pieces: ProductSeed[], format: "wide" | "tall"): string {
  const frame =
    format === "wide"
      ? "16:9 landscape, the person in the right half, calm negative space in the left third for a headline"
      : "9:16 portrait, the person in the lower two thirds, calm negative space in the top third for a headline";
  return (
    `Cinematic editorial fashion photograph in ${heroScene[world]}. ${model[world][0]!.toUpperCase()}${model[world].slice(1)} wearing ${pieces.map(piece).join("; ")}. ` +
    `${frame}. Shot on a full-frame camera, natural film grain, photorealistic. No logos, no text, no watermark.`
  );
}

const shelf = (world: WorldSlug) => demoCatalog.filter((product) => product.worlds.includes(world));

async function main() {
  const lines: string[] = [];
  const out = (text = "") => lines.push(text);

  out("# AI promptlari");
  out();
  out("> Bu fayl `npm run assets:brief` buyrugʻi bilan katalogdan avtomatik yaratiladi. Qoʻlda tahrirlamang: oʻzgarish kerak boʻlsa, `tools/assets/brief.ts`ni oʻzgartirib, buyruqni qayta ishga tushiring.");
  out();
  out("Ish tartibi va qoidalar: [AI-ASSETS.md](AI-ASSETS.md). Promptlar ingliz tilida, chunki AI modellar ingliz tilini aniqroq tushunadi. Har bir promptni toʻliq, oʻzgartirmasdan nusxalang.");
  out();

  let packshots = 0;
  out("## 1. Mahsulot suratlari (packshot)");
  out();
  out("Har bir rang uchun bitta surat. Faylni koʻrsatilgan nom bilan saqlang. 3D model kerak boʻlsa, oʻsha suratni Meshy yoki Tripo'ga bering va GLB faylni yoniga xuddi shu nom bilan, `.glb` kengaytmasida saqlang.");
  out();
  for (const product of demoCatalog) {
    out(`### ${product.name}`);
    out();
    for (const colour of product.colors) {
      packshots++;
      out(`**${colour.name}** → \`assets/incoming/products/${product.handle}/${colour.slug}.png\``);
      out();
      out("```text");
      out(packshotPrompt(product, colour.slug, colour.hex));
      out("```");
      out();
    }
  }

  out("## 2. Try the Look: toʻliq obrazdagi odamlar");
  out();
  out("Har bir olam uchun bitta odam, oʻsha olamning toʻliq obrazida. Shu toʻrt surat bosh sahifadagi \"Try the Look\" qatorini tashkil qiladi.");
  out();
  for (const world of WORLD_SLUGS) {
    const pieces = pickLook(shelf(world));
    out(`### ${worlds[world].name}`);
    out();
    out(`Obrazda: ${pieces.map((product) => `${product.name} (${product.colors[0]!.name})`).join(", ")}.`);
    out();
    out(`→ \`assets/incoming/looks/${world}.png\``);
    out();
    out("```text");
    out(lookPrompt(world, pieces));
    out("```");
    out();
  }

  out("## 3. Hero suratlari");
  out();
  out("Har bir olam uchun ikkita: kompyuter uchun keng (16:9) va telefon uchun tik (9:16). Odam oʻsha olamning obrazida boʻladi.");
  out();
  for (const world of WORLD_SLUGS) {
    const pieces = pickLook(shelf(world));
    out(`### ${worlds[world].name}`);
    out();
    for (const format of ["wide", "tall"] as const) {
      out(`${format === "wide" ? "Keng" : "Tik"} → \`assets/incoming/heroes/${world}-${format}.jpg\``);
      out();
      out("```text");
      out(heroPrompt(world, pieces, format));
      out("```");
      out();
    }
  }

  out("## Jami");
  out();
  out(`| Tur | Soni |`);
  out(`|---|---|`);
  out(`| Mahsulot suratlari | ${packshots} |`);
  out(`| 3D modellar (ixtiyoriy, har bir surat uchun) | ${packshots} gacha |`);
  out(`| Try the Look suratlari | ${WORLD_SLUGS.length} |`);
  out(`| Hero suratlari | ${WORLD_SLUGS.length * 2} |`);
  out();

  await writeFile(OUT, `${lines.join("\n")}\n`);

  // Folders for the incoming files. They are local only; see .gitignore.
  for (const product of demoCatalog) await mkdir(path.join(INCOMING, "products", product.handle), { recursive: true });
  await mkdir(path.join(INCOMING, "looks"), { recursive: true });
  await mkdir(path.join(INCOMING, "heroes"), { recursive: true });

  const missing = demoCatalog.filter((product) => !garment[product.handle]).map((product) => product.handle);
  if (missing.length) throw new Error(`No English description for: ${missing.join(", ")}. Add them to tools/assets/brief.ts.`);
  console.log(`Wrote docs/AI-PROMPTS.md: ${packshots} packshots, ${WORLD_SLUGS.length} looks, ${WORLD_SLUGS.length * 2} heroes.`);
}

await main();
