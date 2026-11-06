/**
 * One spec drives the cut sheet. Sizing rule from brief 13.1: the spec is the middle size,
 * and each size step changes body width by 4 cm, length by 1.5 cm and span by 3 cm.
 *
 * Assumption: lists with an even count have no true middle, so `M` is the middle size
 * wherever it is listed, and otherwise the lower of the two centre sizes is used.
 * Trouser sizes are waist in inches, and each listed size counts as one step.
 *
 * Output is a string so the same drawing can stand in for a missing image.
 * All values are numbers from the spec or escaped, so it is safe to set as inner HTML.
 */
import type { Cut, Detail } from "@/content/types";

export const STEP_BODY_CM = 4;
export const STEP_LENGTH_CM = 1.5;
export const STEP_SPAN_CM = 3;

export function middleSizeIndex(sizes: readonly string[]): number {
  const m = sizes.indexOf("M");
  return m >= 0 ? m : Math.floor((sizes.length - 1) / 2);
}

/** Steps from the middle size. Zero when the size is not in the list. */
export function sizeStep(sizes: readonly string[], size: string): number {
  const index = sizes.indexOf(size);
  return index < 0 ? 0 : index - middleSizeIndex(sizes);
}

export function cutForSize(cut: Cut, sizes: readonly string[], size: string): Cut {
  const step = sizeStep(sizes, size);
  return {
    ...cut,
    bodyWidthCm: cut.bodyWidthCm + step * STEP_BODY_CM,
    lengthCm: cut.lengthCm + step * STEP_LENGTH_CM,
    spanCm: cut.spanCm + step * STEP_SPAN_CM,
  };
}

export type Measurement = { key: string; label: string; value: string };

export type CutSheet = {
  size: string;
  cut: Cut;
  /** A complete `<svg>` element. Style hooks are in globals.css under `.cut-sheet`. */
  svg: string;
  measurements: Measurement[];
};

export type CutSheetInput = {
  name?: string;
  cut: Cut;
  sizes: readonly string[];
  details?: readonly Detail[];
};

const cm = (value: number) => `${Number(value.toFixed(1))} cm`;
const n = (value: number) => Number(value.toFixed(2));

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function measurementsFor(cut: Cut, size: string): Measurement[] {
  const row = (key: string, label: string, value: number): Measurement => ({ key, label, value: cm(value) });
  switch (cut.template) {
    case "trouser":
      return [
        { key: "waistSize", label: "Waist size", value: `${size} in` },
        row("waist", "Waist, laid flat", cut.bodyWidthCm),
        row("length", "Length", cut.lengthCm),
        row("span", "Width at hem, both legs", cut.spanCm),
      ];
    case "skirt":
      return [row("width", "Panel width", cut.bodyWidthCm), row("length", "Length", cut.lengthCm)];
    case "rect":
      return [
        row("width", "Width", cut.spanCm),
        row("length", "Length", cut.lengthCm),
        ...(cut.neckWidthCm > 0 ? [row("neckWidth", "Neck slit", cut.neckWidthCm)] : []),
      ];
    case "vest":
      return [
        row("length", "Length", cut.lengthCm),
        row("body", "Body width", cut.bodyWidthCm),
        row("neckWidth", "Neck width", cut.neckWidthCm),
      ];
    case "tee":
      return [
        row("length", "Length", cut.lengthCm),
        row("body", "Body width", cut.bodyWidthCm),
        row("span", "Sleeve span", cut.spanCm),
        row("sleeveDepth", "Sleeve depth", cut.sleeveDepthCm),
        row("neckWidth", "Neck width", cut.neckWidthCm),
      ];
  }
}

/** Outline in centimetres. The origin is the centre of the top edge. */
function outline(cut: Cut): string {
  const L = cut.lengthCm;
  const b = cut.bodyWidthCm / 2;
  const s = cut.spanCm / 2;
  const d = cut.sleeveDepthCm;
  const nw = cut.neckWidthCm / 2;
  const nd = cut.neckDropCm;
  const neck = nw > 0 ? `L${n(nw)} 0Q${n(nw * 0.6)} ${n(nd)} 0 ${n(nd)}Q${n(-nw * 0.6)} ${n(nd)} ${n(-nw)} 0` : "";

  switch (cut.template) {
    case "tee":
      return `M${n(-s)} 0V${n(d)}H${n(-b)}V${n(L)}H${n(b)}V${n(d)}H${n(s)}V0${neck}Z`;
    case "vest": {
      const shoulder = b * 0.78;
      const arm = Math.min(L * 0.38, 26);
      return (
        `M${n(-shoulder)} 0Q${n(-shoulder)} ${n(arm * 0.7)} ${n(-b)} ${n(arm)}V${n(L)}H${n(b)}V${n(arm)}` +
        `Q${n(shoulder)} ${n(arm * 0.7)} ${n(shoulder)} 0${neck}Z`
      );
    }
    case "trouser": {
      const gap = 3;
      const rise = L * 0.3;
      return `M${n(-b)} 0H${n(b)}L${n(s)} ${n(L)}H${n(gap / 2)}L0 ${n(rise)}L${n(-gap / 2)} ${n(L)}H${n(-s)}Z`;
    }
    case "skirt":
      return `M${n(-b)} 0H${n(b)}V${n(L)}H${n(-b)}Z`;
    case "rect": {
      const w = s;
      const slit = nw > 0 ? `M${n(-nw)} ${n(nd)}H${n(nw)}` : "";
      return `M${n(-w)} 0H${n(w)}V${n(L)}H${n(-w)}Z${slit}`;
    }
  }
}

function detailLines(cut: Cut, details: readonly Detail[]): string {
  const halfAtHem = cut.template === "tee" || cut.template === "vest" ? cut.bodyWidthCm / 2 : cut.spanCm / 2;
  const halfAtTop = cut.template === "trouser" ? cut.bodyWidthCm / 2 : halfAtHem;
  const out: string[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    out.push(`<line class="cut-detail" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`);

  for (const detail of details) {
    switch (detail.kind) {
      case "hem": {
        const y = cut.lengthCm - detail.cm;
        if (cut.template === "trouser") {
          // Each leg keeps its own hem line, so the fork stays clear.
          line(-halfAtHem, y, -2, y);
          line(2, y, halfAtHem, y);
        } else {
          line(-halfAtHem, y, halfAtHem, y);
        }
        break;
      }
      case "waistband":
        line(-halfAtTop, detail.heightCm, halfAtTop, detail.heightCm);
        break;
      case "placket": {
        const top = cut.neckDropCm;
        const bottom = detail.lengthCm ? top + detail.lengthCm : cut.lengthCm;
        line(-detail.widthCm / 2, top, -detail.widthCm / 2, bottom);
        line(detail.widthCm / 2, top, detail.widthCm / 2, bottom);
        break;
      }
      case "pocket": {
        for (const side of [-1, 1]) {
          const x = side < 0 ? -detail.xCm - detail.wCm : detail.xCm;
          out.push(
            `<rect class="cut-detail" x="${n(x)}" y="${n(detail.yCm)}" width="${n(detail.wCm)}" height="${n(detail.hCm)}"/>`,
          );
        }
        break;
      }
      case "fringe":
        line(-halfAtHem, detail.cm, halfAtHem, detail.cm);
        line(-halfAtHem, cut.lengthCm - detail.cm, halfAtHem, cut.lengthCm - detail.cm);
        break;
      default:
        break;
    }
  }
  return out.join("");
}

type Dim = { x1: number; y1: number; x2: number; y2: number; label: string };

function dimension({ x1, y1, x2, y2, label }: Dim, fontSize: number): string {
  const tick = fontSize * 0.35;
  const vertical = x1 === x2;
  const tickAt = (x: number, y: number) =>
    `<line x1="${n(x - tick)}" y1="${n(y + tick)}" x2="${n(x + tick)}" y2="${n(y - tick)}"/>`;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const text = vertical
    ? `<text font-size="${n(fontSize)}" text-anchor="middle" transform="translate(${n(midX + fontSize * 1.1)} ${n(midY)}) rotate(-90)">${escapeXml(label)}</text>`
    : `<text font-size="${n(fontSize)}" text-anchor="middle" x="${n(midX)}" y="${n(midY - fontSize * 0.5)}">${escapeXml(label)}</text>`;
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>${tickAt(x1, y1)}${tickAt(x2, y2)}${text}`;
}

export function generateCutSheet(input: CutSheetInput, size: string): CutSheet {
  const cut = cutForSize(input.cut, input.sizes, size);
  const measurements = measurementsFor(cut, size);

  const halfWidth = Math.max(cut.spanCm, cut.bodyWidthCm) / 2;
  const longest = Math.max(halfWidth * 2, cut.lengthCm);
  const fontSize = longest * 0.04;
  const offset = fontSize * 1.8;
  const margin = offset + fontSize * 2.4;

  // Each width line sits against the edge it measures. Trousers are widest at the hem.
  const topWidth = cut.template === "trouser" ? cut.bodyWidthCm : halfWidth * 2;
  const bottomWidth = cut.template === "tee" ? cut.bodyWidthCm : cut.template === "trouser" ? cut.spanCm : null;
  const widthDim = (width: number, y: number): Dim => ({ x1: -width / 2, y1: y, x2: width / 2, y2: y, label: cm(width) });

  const dims: Dim[] = [
    widthDim(topWidth, -offset),
    { x1: halfWidth + offset, y1: 0, x2: halfWidth + offset, y2: cut.lengthCm, label: cm(cut.lengthCm) },
  ];
  if (bottomWidth !== null) dims.push(widthDim(bottomWidth, cut.lengthCm + offset * 1.6));

  // A square sheet, so a scarf and a cape sit at matching text sizes side by side.
  const side = longest + margin * 2;
  const viewBox = [n(-side / 2), n(cut.lengthCm / 2 - side / 2), n(side), n(side)].join(" ");

  const summary = measurements.map((row) => `${row.label} ${row.value}`).join(", ");
  const title = `${input.name ? `${input.name}, ` : ""}size ${size}. ${summary}.`;

  const svg =
    `<svg class="cut-sheet" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${escapeXml(title)}">` +
    `<path class="cut-outline" d="${outline(cut)}"/>` +
    detailLines(cut, input.details ?? []) +
    `<g class="cut-dims">${dims.map((dim) => dimension(dim, fontSize)).join("")}</g>` +
    `</svg>`;

  return { size, cut, svg, measurements };
}
