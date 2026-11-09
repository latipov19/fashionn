import type { WorldSlug } from "./types";
import { WORLD_SLUGS } from "./types";

/**
 * The only place world colours are defined. CSS variables, the 3D scene and the contrast
 * test all read from here, so a world is one object and never a second stylesheet.
 */
export type Theme = {
  bg: string;
  bgRaised: string;
  bgSunken: string;
  fg: string;
  fgMuted: string;
  line: string;
  accent: string;
  accentFg: string;
  danger: string;
  success: string;
};

export type DisplayVoice = {
  family: "condensed" | "serif" | "sans";
  weight: number;
  tracking: string;
  transform: "uppercase" | "none";
  leading: number;
  /** Degrees of slant applied to display type. */
  slant: number;
  /** Hero size relative to the condensed voice. Wide faces need less to fill the same column. */
  scale: number;
};

/** What the Sunray Portal does in this world. Colour here is the blade material. */
export type PortalLook = {
  blade: string;
  metalness: number;
  roughness: number;
  /** Radians each pleat leans away from the ring plane. */
  twist: number;
  /** 0 is a clean circle. Higher values give an uneven outer edge. */
  jitter: number;
  /** Number of soft scallops around the outer edge. 0 is none. */
  scallops: number;
  key: { color: string; intensity: number; position: [number, number, number] };
  ambient: number;
  environment: number;
};

export type World = {
  slug: WorldSlug;
  name: string;
  /** Two digit index shown beside the name. */
  index: string;
  headline: string;
  lead: string;
  mood: string;
  theme: Theme;
  voice: DisplayVoice;
  portal: PortalLook;
};

const darkDanger = "#FFA698";
const darkSuccess = "#9FDDAE";

export const worlds: Record<WorldSlug, World> = {
  "dark-mode": {
    slug: "dark-mode",
    name: "DARK MODE",
    index: "01",
    headline: "Tun keskin kesilgan.",
    lead: "Qora, grafit va aniq siluetlar. Koʻcha uslubi yorugʻlik tushgan joydan boshlanadi.",
    mood: "Koʻcha uslubi",
    theme: {
      bg: "#0B0B0D",
      bgRaised: "#17171B",
      bgSunken: "#050506",
      fg: "#F2F0EC",
      fgMuted: "#A6A6AC",
      line: "#6E6E76",
      accent: "#E8E4DA",
      accentFg: "#0B0B0D",
      danger: darkDanger,
      success: darkSuccess,
    },
    voice: { family: "condensed", weight: 900, tracking: "-0.01em", transform: "uppercase", leading: 0.9, slant: 0, scale: 1 },
    portal: {
      blade: "#1C1C20",
      metalness: 0.35,
      roughness: 0.42,
      twist: 0.62,
      jitter: 0,
      scallops: 0,
      key: { color: "#FFFFFF", intensity: 5.2, position: [-3.4, 3.2, 3.6] },
      ambient: 0.1,
      environment: 0.55,
    },
  },
  "soft-signal": {
    slug: "soft-signal",
    name: "SOFT SIGNAL",
    index: "02",
    headline: "Jimlik ham gapiradi.",
    lead: "Iliq tosh ranglari, yengil matolar va shoshilmaydigan shakllar.",
    mood: "Sokin minimalizm",
    theme: {
      bg: "#EDE6DA",
      bgRaised: "#F6F1E8",
      bgSunken: "#E2D9CA",
      fg: "#26211B",
      fgMuted: "#5F564B",
      line: "#8C8171",
      accent: "#6E5237",
      accentFg: "#FBF7F0",
      danger: "#A12018",
      success: "#1F6B40",
    },
    voice: { family: "serif", weight: 400, tracking: "-0.01em", transform: "none", leading: 1.02, slant: 0, scale: 0.92 },
    portal: {
      blade: "#E4DACA",
      metalness: 0,
      roughness: 0.82,
      twist: 0.3,
      jitter: 0,
      scallops: 12,
      key: { color: "#FFE9CC", intensity: 2.6, position: [2.6, 3.4, 4.4] },
      ambient: 0.55,
      environment: 0.75,
    },
  },
  "chrome-future": {
    slug: "chrome-future",
    name: "CHROME FUTURE",
    index: "03",
    headline: "Kelajak kumushdan.",
    lead: "Koʻmir fon, oʻlchangan kumush yaltiroq va har kunga moʻljallangan texnik kiyim.",
    mood: "Texnik kiyim",
    theme: {
      bg: "#1B1D21",
      bgRaised: "#25282D",
      bgSunken: "#141518",
      fg: "#E9ECEF",
      fgMuted: "#AAB0B8",
      line: "#777D86",
      accent: "#C9CED6",
      accentFg: "#15171A",
      danger: darkDanger,
      success: darkSuccess,
    },
    voice: { family: "sans", weight: 300, tracking: "0.04em", transform: "uppercase", leading: 1, slant: 0, scale: 0.6 },
    portal: {
      blade: "#C8CDD4",
      metalness: 1,
      roughness: 0.2,
      twist: 0.78,
      jitter: 0,
      scallops: 0,
      key: { color: "#E6EEFF", intensity: 3, position: [3.2, 2.2, 4] },
      ambient: 0.08,
      environment: 1.5,
    },
  },
  "raw-energy": {
    slug: "raw-energy",
    name: "RAW ENERGY",
    index: "04",
    headline: "Xom. Tirik. Harakatda.",
    lead: "Zaytun rang, sanoat teksturasi va qatlam-qatlam kiyinish erkinligi.",
    mood: "Eksperimental qatlamlar",
    theme: {
      bg: "#363B28",
      bgRaised: "#434932",
      bgSunken: "#2B2F20",
      fg: "#EEEBDD",
      fgMuted: "#CFCEB8",
      line: "#8F9574",
      accent: "#D8C26B",
      accentFg: "#23261A",
      danger: darkDanger,
      success: darkSuccess,
    },
    voice: { family: "condensed", weight: 900, tracking: "0", transform: "uppercase", leading: 0.86, slant: -6, scale: 1 },
    portal: {
      blade: "#6F7650",
      metalness: 0.1,
      roughness: 0.92,
      twist: 0.5,
      jitter: 0.55,
      scallops: 0,
      key: { color: "#FFE3A6", intensity: 4.4, position: [-2.6, 1.4, 4.2] },
      ambient: 0.22,
      environment: 0.5,
    },
  },
};

export const worldList: World[] = WORLD_SLUGS.map((slug) => worlds[slug]);

export const isWorldSlug = (value: unknown): value is WorldSlug =>
  typeof value === "string" && (WORLD_SLUGS as readonly string[]).includes(value);

/** Shop Fast and the utility pages. Calm on purpose, so products and prices lead. */
export const neutralTheme: Theme = {
  bg: "#F3F1EC",
  bgRaised: "#FBFAF7",
  bgSunken: "#E7E4DD",
  fg: "#141416",
  fgMuted: "#57575D",
  line: "#85857F",
  accent: "#141416",
  accentFg: "#FBFAF7",
  danger: "#A12018",
  success: "#1F6B40",
};

export const neutralVoice: DisplayVoice = {
  family: "condensed",
  weight: 800,
  tracking: "0",
  transform: "uppercase",
  leading: 0.95,
  slant: 0,
  scale: 1,
};

const familyVar: Record<DisplayVoice["family"], string> = {
  condensed: "var(--font-condensed-stack)",
  serif: "var(--font-serif-stack)",
  sans: "var(--font-sans-stack)",
};

/** Neutral blade for pages outside a world. */
const neutralBlade = "#3A3A3F";

/** Mixes two hex colours. `t` 0 is `a`, 1 is `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [x, y] = [parse(a), parse(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Lit and shaded faces of a pleat. The SVG poster draws with these, the 3D scene lights its own. */
export const portalShades = (blade: string) => ({ hi: mixHex(blade, "#FFFFFF", 0.3), lo: mixHex(blade, "#000000", 0.45) });

function declarations(theme: Theme, voice: DisplayVoice, blade: string): string {
  const shades = portalShades(blade);
  return [
    `--portal-blade:${blade}`,
    `--portal-hi:${shades.hi}`,
    `--portal-lo:${shades.lo}`,
    `--bg:${theme.bg}`,
    `--bg-raised:${theme.bgRaised}`,
    `--bg-sunken:${theme.bgSunken}`,
    `--fg:${theme.fg}`,
    `--fg-muted:${theme.fgMuted}`,
    `--line:${theme.line}`,
    `--accent:${theme.accent}`,
    `--accent-fg:${theme.accentFg}`,
    `--danger:${theme.danger}`,
    `--success:${theme.success}`,
    `--display-family:${familyVar[voice.family]}`,
    `--display-weight:${voice.weight}`,
    `--display-tracking:${voice.tracking}`,
    `--display-transform:${voice.transform}`,
    `--display-leading:${voice.leading}`,
    `--display-slant:${voice.slant}deg`,
    `--display-scale:${voice.scale}`,
    `color-scheme:${isDark(theme.bg) ? "dark" : "light"}`,
  ].join(";");
}

/**
 * Generated once for the root layout. `:root` carries the neutral theme. A page enters a world
 * by rendering `data-world-root="<slug>"` anywhere inside it: `:root:has()` then retints the
 * whole document, header and footer included, from the first server-rendered paint.
 */
export function themeCss(): string {
  const rules = worldList.map(
    (world) => `:root:has([data-world-root="${world.slug}"]),[data-world="${world.slug}"]{${declarations(world.theme, world.voice, world.portal.blade)}}`,
  );
  return `:root,[data-world="neutral"]{${declarations(neutralTheme, neutralVoice, neutralBlade)}}${rules.join("")}`;
}

/* Contrast helpers. Used by the tests and by isDark above. */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG 2.x contrast ratio. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.2;
}
