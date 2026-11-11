import { ProductCard, leadImage } from "@/components/product/product-card";
import type { Look } from "@/components/world/look-board";
import type { Aperture } from "@/components/world/portal";
import type { ShowroomItem } from "@/components/world/showroom";
import { copy } from "@/content/copy";
import type { WorldSlug } from "@/content/types";
import { worldList, worlds } from "@/content/worlds";
import { pickLook } from "@/lib/look";
import { formatUzs } from "@/lib/money";
import type { CatalogProduct } from "./catalog";
import { primaryMedia } from "./media";

/*
 * Turns catalogue rows into what the world pages show: the portal's product, the drop cards,
 * the showroom arc, the look and the manifesto's counts. Server only; every price is formatted here.
 */

/** Products on the showroom arc. Two either side of the chosen one are in view. */
const SHOWROOM_SIZE = 7;
/** The 3D card's image width: sharp at the card's size on a 2x screen, light to download. */
const SHOWROOM_TEXTURE_WIDTH = 960;
/** Cards on the drop page. */
const DROP_SIZE = 4;

const hasModel = (product: CatalogProduct) => product.colors.some((color) => color.model);

/** The portal holds the world's lead outer layer, so the opening always shows a full garment. */
function heroProduct(shelf: CatalogProduct[]): CatalogProduct | undefined {
  return shelf.find((product) => product.slot === "outerwear" && !product.soldOut) ?? shelf.find((product) => !product.soldOut) ?? shelf[0];
}

export function buildAperture(shelf: CatalogProduct[], slug: WorldSlug): Aperture | null {
  const product = heroProduct(shelf);
  if (!product) return null;
  const image = leadImage(product);
  return {
    href: `/products/${product.handle}`,
    label: `${copy.home.apertureLabel(worlds[slug].name)}: ${product.name}`,
    name: product.name,
    price: formatUzs(product.priceUzs),
    demo: product.isDemo,
    image: image
      ? {
          src: image.url,
          srcSet: image.srcSet.map((source) => `${source.url} ${source.width}w`).join(", "),
          width: image.width,
          height: image.height,
          alt: image.alt,
          blur: image.blur,
        }
      : null,
  };
}

export function buildDrop(shelf: CatalogProduct[]) {
  return shelf.slice(0, DROP_SIZE).map((product) => (
    <li key={product.id}>
      <ProductCard product={product} sizes="(max-width: 640px) 78vw, (max-width: 900px) 50vw, 22vw" />
    </li>
  ));
}

function toShowroomItem(product: CatalogProduct): ShowroomItem {
  // Show the colour that has a model, so the item turns. Otherwise the first colour with an image.
  const color = product.colors.find((candidate) => candidate.model) ?? product.colors.find((candidate) => primaryMedia(candidate.media)) ?? product.colors[0];
  const image = (color && primaryMedia(color.media)) ?? leadImage(product);
  const texture = image ? (image.srcSet.find((source) => source.width === SHOWROOM_TEXTURE_WIDTH) ?? image.srcSet.at(-1) ?? image) : null;
  return {
    key: product.id,
    href: `/products/${product.handle}`,
    name: product.name,
    meta: [product.category, color?.name].filter(Boolean).join(" · "),
    price: formatUzs(product.priceUzs),
    demo: product.isDemo,
    tint: color?.hex ?? "#808080",
    image: image
      ? {
          src: image.url,
          srcSet: image.srcSet.map((source) => `${source.url} ${source.width}w`).join(", "),
          width: image.width,
          height: image.height,
          blur: image.blur,
        }
      : null,
    texture: texture?.url ?? null,
    model: color?.model?.url ?? null,
  };
}

/** The world's curated order, with products that have a 3D model moved to the front. */
export function buildShowroom(shelf: CatalogProduct[]): ShowroomItem[] {
  return [...shelf.filter(hasModel), ...shelf.filter((product) => !hasModel(product))].slice(0, SHOWROOM_SIZE).map(toShowroomItem);
}

export function buildLook(shelf: CatalogProduct[]): Look | null {
  const items = pickLook(shelf);
  if (items.length < 2) return null;
  return {
    pieces: items.map((product) => ({
      key: product.id,
      name: product.name,
      category: product.category,
      price: formatUzs(product.priceUzs),
      card: <ProductCard product={product} compact sizes="(max-width: 900px) 50vw, 18vw" />,
    })),
    total: formatUzs(items.reduce((sum, product) => sum + product.priceUzs, 0)),
    note: copy.home.look.pieces(items.length),
  };
}

/** Real counts for the manifesto: distinct published products, and those with a 3D model. */
export function catalogFacts(shelves: Record<WorldSlug, CatalogProduct[]>) {
  const unique = new Map<string, CatalogProduct>();
  for (const shelf of Object.values(shelves)) for (const product of shelf) unique.set(product.id, product);
  const products = [...unique.values()];
  return { worlds: worldList.length, products: products.length, models: products.filter(hasModel).length };
}
