/**
 * Demo garment flats. Draws every product colour in src/content/catalog.demo.ts as a flat
 * technical illustration, writes three WebP widths to public/media/generated and records
 * them in src/content/media.generated.json. Run with `npm run media:generate`.
 *
 * These are illustrations, not photos. They never imply fit or fabric behaviour, carry a
 * DEMO mark in the corner, and are replaced by owner photography through admin uploads.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { demoCatalog } from "../../src/content/catalog.demo";
import type { GeneratedManifest, GeneratedMediaEntry, Silhouette } from "../../src/content/types";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT_DIR = path.join(ROOT, "public", "media", "generated");
const MANIFEST = path.join(ROOT, "src", "content", "media.generated.json");
const URL_BASE = "/media/generated";
const WIDTHS = [480, 960, 1600] as const;
const W = 400;
const H = 500;

/* Colour helpers */

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex([0, 1, 2].map((i) => x[i]! + (y[i]! - x[i]!) * t) as Rgb);
};
const luminance = (hex: string) => {
  const c = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};

/* Geometry helpers. Garments are drawn in a 400 x 500 box. */

type Pt = [number, number];

/** Samples a quadratic curve, so curved outlines can still be mirrored as point lists. */
function q(from: Pt, control: Pt, to: Pt, steps = 10): Pt[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps;
    const u = 1 - t;
    return [u * u * from[0] + 2 * u * t * control[0] + t * t * to[0], u * u * from[1] + 2 * u * t * control[1] + t * t * to[1]];
  });
}

const d = (points: Pt[], close = true) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}${close ? "Z" : ""}`;

/** Right half, from the top centre clockwise to the bottom centre, mirrored into a closed outline. */
function sym(right: Pt[]): string {
  const left = [...right].reverse().map(([x, y]) => [2 * 200 - x, y] as Pt);
  return d([...right, ...left]);
}

/** A detail line drawn on both sides of the centre. */
const both = (points: Pt[]) => [d(points, false), d(points.map(([x, y]) => [400 - x, y] as Pt), false)];

type Drawing = {
  /** Filled outlines, drawn in order. */
  shapes: string[];
  /** Seams and edges. */
  lines?: string[];
  /** Stitching, drawn dashed. */
  stitches?: string[];
  /** Small solid marks such as buttons and eyelets. */
  dots?: Pt[];
  /** Straps drawn as thick bands in the garment colour. */
  straps?: string[];
  /** SVG transform for the whole drawing. */
  transform?: string;
};

const drawings: Record<Silhouette, () => Drawing> = {
  tee: () => ({
    shapes: [sym([[200, 94], ...q([200, 94], [228, 92], [240, 62]), [302, 80], [354, 150], [324, 174], [293, 140], [297, 440], [200, 444]])],
    lines: [...both(q([200, 106], [232, 104], [247, 68])), ...both([[346, 140], [318, 162]])],
    stitches: [d([[106, 428], [294, 428]], false), ...both([[341, 134], [313, 156]])],
  }),
  hoodie: () => ({
    shapes: [
      sym([[200, 36], ...q([200, 36], [252, 34], [266, 72]), [276, 118], [312, 128], [350, 176], [384, 388], [382, 416], [344, 418], [340, 390], [300, 206], [300, 432], [302, 458], [200, 458]]),
    ],
    lines: [
      ...both([[200, 60], ...q([200, 60], [240, 62], [246, 112]), ...q([246, 112], [232, 140], [200, 144])]),
      d([[162, 318], [238, 318], [262, 402], [138, 402], [162, 318]], false),
      ...both([[238, 318], [248, 356]]),
      ...both([[384, 388], [340, 390]]),
      d([[100, 432], [300, 432]], false),
    ],
    stitches: [d([[166, 330], [234, 330]], false)],
    straps: [d([[186, 146], [182, 214]], false), d([[214, 146], [218, 214]], false)],
  }),
  shirt: () => ({
    shapes: [sym([[200, 80], [232, 58], [300, 82], [342, 160], [362, 404], [326, 410], [318, 216], [297, 172], [298, 404], ...q([298, 404], [282, 452], [200, 460])])],
    lines: [
      ...both([[200, 98], [232, 58], [228, 106], [200, 98]]),
      d([[192, 98], [192, 460]], false),
      d([[208, 98], [208, 460]], false),
      d([[128, 172], [170, 172], [170, 216], [149, 224], [128, 216], [128, 172]], false),
      ...both([[360, 378], [324, 382]]),
    ],
    stitches: [d([[128, 180], [170, 180]], false)],
    dots: [130, 180, 230, 280, 330, 380, 430].map((y) => [200, y] as Pt),
  }),
  bomber: () => ({
    shapes: [sym([[200, 66], ...q([200, 66], [226, 64], [240, 52]), [306, 92], [348, 170], [380, 384], [378, 414], [340, 416], [338, 388], [302, 206], [306, 402], [302, 438], [200, 438]])],
    lines: [
      ...both(q([200, 80], [230, 78], [250, 58])),
      d([[96, 404], [304, 404]], false),
      ...both([[380, 386], [338, 388]]),
      d([[52, 232], [80, 230], [82, 268], [54, 270], [52, 232]], false),
    ],
    stitches: [d([[196, 72], [196, 438]], false), d([[204, 72], [204, 438]], false), ...both([[262, 230], [278, 300]])],
  }),
  coat: () => ({
    shapes: [sym([[200, 98], [226, 60], [296, 82], [338, 170], [372, 398], [338, 404], [302, 206], [306, 300], [322, 470], [200, 474]])],
    lines: [
      ...both([[210, 98], [246, 150], [222, 168], [204, 252]]),
      d([[214, 252], [214, 474]], false),
      ...both([[248, 352], [290, 340]]),
      ...both([[370, 374], [336, 380]]),
    ],
    stitches: [...both([[252, 360], [288, 349]])],
    dots: [[172, 282], [228, 282], [172, 342], [228, 342]],
  }),
  shell: () => ({
    shapes: [
      sym([[200, 32], ...q([200, 32], [254, 30], [268, 66]), [276, 120], [314, 130], [352, 178], [386, 394], [384, 418], [346, 420], [344, 394], [302, 208], [306, 444], ...q([306, 444], [260, 458], [200, 454])]),
    ],
    lines: [
      ...both([[200, 56], ...q([200, 56], [242, 58], [248, 112]), ...q([248, 112], [234, 138], [200, 142])]),
      ...both([[236, 196], [282, 252]]),
      ...both([[386, 394], [344, 394]]),
      ...both([[322, 150], [354, 300]]),
    ],
    stitches: [d([[197, 142], [197, 454]], false), d([[203, 142], [203, 454]], false), d([[96, 432], [304, 432]], false)],
    dots: [[282, 252], [118, 252]],
  }),
  trouser: () => ({
    shapes: [sym([[200, 48], [282, 48], [284, 78], [302, 150], [326, 452], [214, 458], [200, 190]])],
    lines: [
      d([[116, 78], [284, 78]], false),
      d([[200, 78], [200, 158], ...q([200, 158], [200, 176], [216, 178])], false),
      ...both([[282, 86], [298, 140]]),
    ],
    stitches: [...both([[262, 120], [270, 446]])],
    dots: [[200, 64]],
  }),
  cargo: () => ({
    shapes: [sym([[200, 48], [278, 48], [280, 78], [298, 150], [304, 300], [292, 438], [294, 458], [216, 460], [212, 300], [200, 196]])],
    lines: [
      d([[120, 78], [280, 78]], false),
      d([[200, 78], [200, 160], ...q([200, 160], [200, 178], [214, 180])], false),
      ...both([[264, 230], [304, 230], [304, 312], [264, 312], [264, 230]]),
      ...both([[264, 248], [304, 248]]),
      ...both([[216, 438], [292, 438]]),
    ],
    stitches: [...both([[214, 300], [302, 300]])],
    dots: [[200, 64], [284, 239], [116, 239]],
  }),
  skirt: () => ({
    shapes: [sym([[200, 64], [262, 64], [264, 92], [336, 448], ...q([336, 448], [270, 462], [200, 460])])],
    lines: [d([[136, 92], [264, 92]], false), ...both([[222, 92], [234, 458]]), ...both([[244, 92], [270, 454]]), ...both([[256, 92], [304, 452]])],
    stitches: [d([[200, 92], [200, 160]], false)],
    dots: [[200, 78]],
  }),
  sneaker: () => ({
    transform: "translate(200 258) scale(1.12) translate(-212 -262)",
    shapes: [
      d([[72, 318], [70, 252], ...q([70, 252], [72, 214], [100, 204]), ...q([100, 204], [128, 214], [150, 212]), [184, 190], [206, 196], ...q([206, 196], [252, 234], [298, 256]), ...q([298, 256], [352, 268], [356, 304]), [358, 318]]),
      d([[62, 318], [364, 318], ...q([364, 318], [370, 338], [346, 344]), [80, 344], ...q([80, 344], [58, 342], [62, 318])]),
    ],
    lines: [
      d([[298, 260], ...q([298, 260], [322, 286], [328, 318])], false),
      d([[64, 331], [366, 331]], false),
      d([[112, 210], ...q([112, 210], [124, 262], [116, 318])], false),
      d([[134, 304], ...q([134, 304], [196, 296], [250, 244])], false),
    ],
    stitches: [d([[78, 308], [352, 308]], false), d([[148, 296], ...q([148, 296], [200, 288], [244, 252])], false)],
    dots: [[202, 206], [218, 218], [234, 229], [250, 239], [266, 247]],
  }),
  boot: () => ({
    shapes: [
      d([[112, 112], [190, 112], [196, 260], ...q([196, 260], [214, 294], [268, 304]), [320, 314], ...q([320, 314], [352, 322], [352, 350]), [352, 362], [96, 362], [96, 330], ...q([96, 330], [100, 240], [112, 112])]),
      d([[88, 362], [360, 362], [360, 386], [88, 386]]),
    ],
    lines: [d([[100, 374], [348, 374]], false), d([[112, 122], [190, 122]], false)],
    stitches: [d([[100, 354], [348, 354]], false), d([[180, 124], [186, 260]], false)],
    dots: [140, 168, 196, 224, 252].map((y) => [190, y] as Pt),
  }),
  tote: () => ({
    straps: [d([[146, 176], ...q([146, 176], [146, 72], [200, 72]), ...q([200, 72], [254, 72], [254, 176])], false)],
    shapes: [d([[108, 170], [292, 170], [308, 440], [92, 440]])],
    lines: [d([[100, 300], [300, 300]], false)],
    stitches: [d([[110, 188], [290, 188]], false), d([[96, 424], [304, 424]], false)],
  }),
  sling: () => ({
    straps: [d([[140, 230], ...q([140, 230], [108, 70], [200, 62]), ...q([200, 62], [292, 70], [260, 230])], false)],
    shapes: [
      d([[120, 252], ...q([120, 252], [120, 212], [160, 212]), [262, 212], ...q([262, 212], [300, 212], [300, 252]), [300, 318], ...q([300, 318], [300, 352], [262, 352]), [160, 352], ...q([160, 352], [120, 352], [120, 318])]),
      d([[112, 140], [134, 136], [138, 160], [116, 164]]),
    ],
    lines: [d([[132, 246], [288, 246]], false)],
    stitches: [d([[134, 336], [286, 336]], false)],
    dots: [[276, 246]],
  }),
  cap: () => ({
    shapes: [
      d([[214, 300], ...q([214, 300], [296, 282], [370, 300]), ...q([370, 300], [382, 318], [358, 326]), ...q([358, 326], [286, 330], [214, 318])]),
      d([[92, 304], ...q([92, 304], [92, 160], [206, 150]), ...q([206, 150], [318, 156], [328, 294]), [328, 304]]),
    ],
    lines: [
      d([[206, 152], ...q([206, 152], [154, 200], [146, 304])], false),
      d([[206, 152], ...q([206, 152], [262, 200], [270, 304])], false),
      d([[92, 292], [328, 292]], false),
    ],
    stitches: [d([[226, 308], ...q([226, 308], [292, 298], [362, 310])], false)],
    dots: [[206, 150], [164, 200], [250, 202]],
  }),
};

function svgFor(silhouette: Silhouette, hex: string): string {
  const drawing = drawings[silhouette]();
  const dark = luminance(hex) < 0.12;
  const light = luminance(hex) > 0.5;
  const ground = light ? "#D3CDC2" : "#E7E3DC";
  // Seams must read on any fill: lighter lines on very dark cloth, darker lines elsewhere.
  const edge = dark ? mix(hex, "#FFFFFF", 0.32) : mix(hex, "#000000", 0.42);
  const seam = dark ? mix(hex, "#FFFFFF", 0.22) : mix(hex, "#000000", 0.3);
  const strapEdge = dark ? mix(hex, "#FFFFFF", 0.28) : mix(hex, "#000000", 0.4);

  const straps = (drawing.straps ?? [])
    .map(
      (p) =>
        `<path d="${p}" fill="none" stroke="${strapEdge}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="${p}" fill="none" stroke="${hex}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const shapes = drawing.shapes
    .map(
      (p) =>
        `<path d="${p}" fill="${hex}"/>` +
        `<path d="${p}" fill="url(#shade)"/>` +
        `<path d="${p}" fill="none" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>`,
    )
    .join("");
  const lines = (drawing.lines ?? []).map((p) => `<path d="${p}" fill="none" stroke="${seam}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`).join("");
  const stitches = (drawing.stitches ?? []).map((p) => `<path d="${p}" fill="none" stroke="${seam}" stroke-width="1.3" stroke-dasharray="4 3.2" stroke-linecap="round"/>`).join("");
  const dots = (drawing.dots ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${seam}"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.12"/>
    <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.16"/>
  </linearGradient>
  <radialGradient id="ground" cx="0.5" cy="0.42" r="0.75">
    <stop offset="0" stop-color="${mix(ground, "#FFFFFF", 0.35)}"/>
    <stop offset="1" stop-color="${ground}"/>
  </radialGradient>
  <filter id="lift" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="7"/>
    <feOffset dx="0" dy="8" result="blur"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.22"/></feComponentTransfer>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#ground)"/>
<g transform="${drawing.transform ?? ""}"><g filter="url(#lift)">${straps}${shapes}</g>
<g>${lines}${stitches}${dots}</g></g>
<text x="18" y="${H - 16}" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" letter-spacing="2.2" fill="${mix(ground, "#000000", 0.45)}">DEMO</text>
</svg>`;
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  const items: GeneratedMediaEntry[] = [];

  for (const product of demoCatalog) {
    for (const color of product.colors) {
      const svg = Buffer.from(svgFor(product.silhouette, color.hex));
      const base = sharp(svg);
      const stem = `${product.handle}-${color.slug}`;
      await Promise.all(
        WIDTHS.map((width) =>
          base
            .clone()
            .resize(width, Math.round(width * 1.25))
            .webp({ quality: 84, effort: 5 })
            .toFile(path.join(OUT_DIR, `${stem}-${width}.webp`)),
        ),
      );
      const blur = await base.clone().resize(16, 20).webp({ quality: 40 }).toBuffer();
      items.push({
        id: `${product.handle}/${color.slug}/flat`,
        productHandle: product.handle,
        colorSlug: color.slug,
        role: "flat",
        url: `${URL_BASE}/${stem}-960.webp`,
        width: 960,
        height: 1200,
        srcSet: WIDTHS.map((width) => ({ url: `${URL_BASE}/${stem}-${width}.webp`, width })),
        blur: `data:image/webp;base64,${blur.toString("base64")}`,
        dominant: color.hex,
        alt: `${product.name}, ${color.name.toLowerCase()}: kod orqali chizilgan namuna rasm, haqiqiy foto emas`,
      });
    }
  }

  const manifest: GeneratedManifest = { version: 2, items };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${items.length} flats (${items.length * WIDTHS.length} files) to public/media/generated.`);
}

await main();
