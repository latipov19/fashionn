/** Content types from brief section 13.1, plus the media manifest shape from 9.4. */

export const ROOMS = ["I", "II", "III"] as const;
export type Room = (typeof ROOMS)[number];

export const HOURS = ["morning", "noon", "evening"] as const;
export type Hour = (typeof HOURS)[number];

export const FRAME_CLASSES = ["wide", "mid", "small"] as const;
export type FrameClass = (typeof FRAME_CLASSES)[number];

export const WEAVES = ["plain", "twill22", "herringbone", "hopsack", "satin5"] as const;
export type Weave = (typeof WEAVES)[number];

export const HANG_MODES = ["sleeveBar", "shoulderRod", "waistBar", "overBar"] as const;
export type HangMode = (typeof HANG_MODES)[number];

export const TEMPLATES = ["tee", "vest", "trouser", "skirt", "rect"] as const;
export type Template = (typeof TEMPLATES)[number];

export type Cloth = {
  id: string;
  label: string;
  weave: Weave;
  composition: string;
  gsm: number;
  warpPerCm: number;
  weftPerCm: number;
  bend: number; // 0 to 1
  roughness: number; // 0 to 1
  sheen: number; // 0 to 1
  fuzz: number; // 0 to 1
  wrap: number; // 0.1 to 0.4
};

export const SEAM_PATHS = ["shoulder", "sleeve", "side", "centreBack", "centreFront", "yoke", "inseam"] as const;
export type SeamPath = (typeof SEAM_PATHS)[number];

export const COLLAR_STYLES = ["band", "camp", "shawl", "funnel"] as const;
export type CollarStyle = (typeof COLLAR_STYLES)[number];

export type Detail =
  | { kind: "seam"; path: SeamPath }
  | { kind: "hem"; cm: number }
  | { kind: "placket"; widthCm: number; lengthCm?: number }
  | { kind: "collar"; style: CollarStyle }
  | { kind: "button"; count: number; diaMm: number; hex: string }
  | { kind: "pocket"; style: "patch" | "welt"; xCm: number; yCm: number; wCm: number; hCm: number }
  | { kind: "waistband"; heightCm: number }
  | { kind: "fly" }
  | { kind: "tie"; lengthCm: number }
  | { kind: "fringe"; cm: number };

export type Cut = {
  template: Template;
  lengthCm: number;
  bodyWidthCm: number;
  spanCm: number;
  sleeveDepthCm: number;
  neckWidthCm: number;
  neckDropCm: number;
};

export type Colourway = { id: string; name: string; hex: string; lining: string };

export type Piece = {
  slug: string;
  peg: string;
  name: string;
  category: string;
  room: Room;
  hour: Hour;
  frameClass: FrameClass;
  hang: HangMode;
  priceUsd: number;
  sizes: string[];
  colourways: Colourway[];
  clothId: string;
  description: string;
  cut: Cut;
  gatherPct: number;
  seed: number;
  details: Detail[];
};

export const MEDIA_ROLES = ["room", "cloth", "photo"] as const;
export type MediaRole = (typeof MEDIA_ROLES)[number];
export type MediaSource = "generated" | "upload";

export type MediaSrc = { url: string; width: number };

/** One entry in src/content/media.generated.json. The pipeline writes these. */
export type GeneratedMediaEntry = {
  /** Stable key, for example `lintel-coat/chalk/room/morning`. */
  id: string;
  pieceSlug: string;
  /** The colourway id from the content module, for example `chalk`. */
  colourwayId: string;
  role: "room" | "cloth";
  hour?: Hour;
  url: string;
  width: number;
  height: number;
  srcSet: MediaSrc[];
  blur: string;
  dominant?: string;
  alt: string;
};

export type GeneratedManifest = { version: 1; items: GeneratedMediaEntry[] };

/** What the site renders. Generated and uploaded media share this shape. */
export type MediaRecord = {
  id: string;
  role: MediaRole;
  hour: Hour | null;
  source: MediaSource;
  url: string;
  width: number;
  height: number;
  srcSet: MediaSrc[];
  blur: string;
  dominant: string | null;
  alt: string;
  position: number;
  hidden: boolean;
};
