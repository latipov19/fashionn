/** Shared content types. Commerce rows live in src/server/db/schema.ts. */

export const WORLD_SLUGS = ["dark-mode", "soft-signal", "chrome-future", "raw-energy"] as const;
export type WorldSlug = (typeof WORLD_SLUGS)[number];

/** Which part of an outfit a product fills. The Outfit Lab builds on this. */
export const SLOTS = ["top", "bottom", "outerwear", "shoes", "accessory"] as const;
export type Slot = (typeof SLOTS)[number];

/** Demo imagery only: which flat the renderer in tools/demo-media draws. */
export const SILHOUETTES = [
  "tee",
  "hoodie",
  "shirt",
  "bomber",
  "coat",
  "shell",
  "trouser",
  "cargo",
  "skirt",
  "sneaker",
  "boot",
  "tote",
  "sling",
  "cap",
] as const;
export type Silhouette = (typeof SILHOUETTES)[number];

export type SizeChart = { columns: string[]; rows: string[][] };

export type ColorSeed = { slug: string; name: string; hex: string };

export type ProductSeed = {
  handle: string;
  name: string;
  category: string;
  slot: Slot;
  worlds: WorldSlug[];
  /** The price a shopper pays, in whole soʻm. */
  priceUzs: number;
  /** The earlier price, shown struck through. Null when there is no sale. */
  compareAtUzs: number | null;
  sizes: string[];
  colors: ColorSeed[];
  description: string;
  fabric: string;
  fit: string;
  care: string;
  sizeChart: SizeChart;
  silhouette: Silhouette;
};

export const MEDIA_ROLES = ["flat", "detail", "photo"] as const;
export type MediaRole = (typeof MEDIA_ROLES)[number];
export type MediaSource = "generated" | "upload";

export type MediaSrc = { url: string; width: number };

/** One entry in src/content/media.generated.json. tools/demo-media writes these. */
export type GeneratedMediaEntry = {
  /** Stable key, for example `noir-hoodie/graphite/flat`. */
  id: string;
  productHandle: string;
  colorSlug: string;
  role: "flat" | "detail";
  url: string;
  width: number;
  height: number;
  srcSet: MediaSrc[];
  blur: string;
  dominant?: string;
  alt: string;
};

export type GeneratedManifest = { version: 2; items: GeneratedMediaEntry[] };

/** What the site renders. Generated and uploaded media share this shape. */
export type MediaRecord = {
  id: string;
  role: MediaRole;
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
