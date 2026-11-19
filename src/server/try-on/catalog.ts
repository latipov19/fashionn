import type { Slot } from "@/content/types";
import { formatUzs } from "@/lib/money";
import type { CatalogProduct } from "../catalog";
import { listProducts } from "../catalog";
import { primaryMedia } from "../media";

/** Upper-body garments: what shoulder tracking can place. Bottoms, shoes and bags are left out. */
export const TRY_ON_SLOTS: readonly Slot[] = ["top", "outerwear"];

/** The packshot width used for the overlay and the AI garment image: sharp enough, light to load. */
const OVERLAY_WIDTH = 960;

export type TryOnColor = {
  slug: string;
  name: string;
  hex: string;
  /** The colour's lead image, for thumbnails. */
  thumb: string | null;
  /**
   * A cut-out packshot (transparent background) the AR preview can lay over a body. Only the
   * AI packshots are cut out; drawn sketches and photos with a background are not.
   */
  overlay: string | null;
};

export type TryOnProduct = {
  handle: string;
  name: string;
  category: string;
  price: string;
  isDemo: boolean;
  colors: TryOnColor[];
};

function widthUrl(media: { url: string; srcSet: { url: string; width: number }[] }): string {
  return media.srcSet.find((source) => source.width === OVERLAY_WIDTH)?.url ?? media.url;
}

function toTryOn(product: CatalogProduct): TryOnProduct {
  return {
    handle: product.handle,
    name: product.name,
    category: product.category,
    price: formatUzs(product.priceUzs),
    isDemo: product.isDemo,
    colors: product.colors.map((color) => {
      const lead = primaryMedia(color.media);
      const cutout = color.media.find((item) => item.role === "render" && !item.hidden);
      return { slug: color.slug, name: color.name, hex: color.hex, thumb: lead ? widthUrl(lead) : null, overlay: cutout ? widthUrl(cutout) : null };
    }),
  };
}

/** Published upper-body products from the live catalogue, the ones with a cut-out first. */
export async function listTryOnProducts(): Promise<TryOnProduct[]> {
  const products = (await listProducts()).filter((product) => TRY_ON_SLOTS.includes(product.slot));
  const items = products.map(toTryOn);
  const ready = (item: TryOnProduct) => item.colors.some((color) => color.overlay);
  return [...items.filter(ready), ...items.filter((item) => !ready(item))];
}

/** English nouns for the catalogue's upper-body categories, for models that read a garment description. */
const GARMENT_NOUNS: Record<string, string> = { hudi: "hoodie", kurtka: "jacket", futbolka: "t-shirt", "koʻylak": "shirt", palto: "coat" };

/** A short English description such as "black hoodie", from the category and the colour's lightness. */
export function describeGarment(product: Pick<TryOnProduct, "category" | "colors">, colorSlug: string): string {
  const noun = GARMENT_NOUNS[product.category.trim().toLowerCase()] ?? "top";
  const hex = product.colors.find((color) => color.slug === colorSlug)?.hex;
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return noun;
  const value = Number.parseInt(hex.slice(1), 16);
  const lightness = (0.2126 * ((value >> 16) & 255) + 0.7152 * ((value >> 8) & 255) + 0.0722 * (value & 255)) / 255;
  return lightness < 0.2 ? `black ${noun}` : lightness > 0.82 ? `white ${noun}` : lightness < 0.45 ? `dark grey ${noun}` : noun;
}

/** The image the AI provider receives as the garment: the cut-out when there is one, else the lead image. */
export function garmentImageFor(product: TryOnProduct, colorSlug: string): string | null {
  const color = product.colors.find((candidate) => candidate.slug === colorSlug);
  return color?.overlay ?? color?.thumb ?? null;
}
