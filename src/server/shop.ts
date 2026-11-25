import { eq, notInArray, sql } from "drizzle-orm";
import { commerce } from "@/content/commerce";
import type { MediaRecord } from "@/content/types";
import { worlds } from "@/content/worlds";
import { foldText } from "@/lib/search";
import type { ShopImage, ShopItem } from "@/lib/shop";
import type { CatalogProduct } from "./catalog";
import { categorySlug, listProducts } from "./catalog";
import { getDb } from "./db/client";
import { orderItems, orders, variants } from "./db/schema";
import { primaryMedia, visibleMedia } from "./media";

/*
 * The catalogue as the shop page and the search overlay read it: one lean record per published
 * product. Prices, stock and media are current database values; nothing here is invented.
 */

export function toShopImage(media: MediaRecord): ShopImage {
  return {
    src: media.url,
    srcSet: media.srcSet.map((source) => `${source.url} ${source.width}w`).join(", "),
    width: media.width,
    height: media.height,
    alt: media.alt,
    blur: media.blur,
  };
}

/** The lead image of the first colour that has one, and a second view for hover: that colour's next image, or the next colour's lead. */
function cardImages(product: CatalogProduct): { image: ShopImage | null; hoverImage: ShopImage | null } {
  const index = product.colors.findIndex((color) => primaryMedia(color.media));
  if (index === -1) return { image: null, hoverImage: null };
  const lead = product.colors[index]!;
  const first = primaryMedia(lead.media)!;
  const second =
    visibleMedia(lead.media).find((media) => media.id !== first.id && media.role !== "detail") ??
    product.colors
      .slice(index + 1)
      .map((color) => primaryMedia(color.media))
      .find(Boolean) ??
    null;
  return { image: toShopImage(first), hoverImage: second ? toShopImage(second) : null };
}

/** Units sold per product, from orders that still stand. Cancelled and returned orders do not count. */
async function unitsSold(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db
    .select({ productId: variants.productId, sold: sql<number>`sum(${orderItems.quantity})::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(variants, eq(variants.id, orderItems.variantId))
    .where(notInArray(orders.status, ["canceled", "returned"]))
    .groupBy(variants.productId);
  return new Map(rows.map((row) => [row.productId, Number(row.sold) || 0]));
}

/** Pure, so the rules for "new" and the sales order can be tested without a database. */
export function toShopItems(products: readonly CatalogProduct[], sold: ReadonlyMap<string, number> = new Map()): ShopItem[] {
  const curated = (a: CatalogProduct, b: CatalogProduct) => a.sortOrder - b.sortOrder || (a.handle < b.handle ? -1 : 1);

  const bySales = [...products].sort((a, b) => (sold.get(b.id) ?? 0) - (sold.get(a.id) ?? 0) || curated(a, b));
  const salesRank = new Map(bySales.map((product, rank) => [product.id, rank]));

  const newest = [...products].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || curated(a, b));
  const fresh = new Set(newest.slice(0, commerce.newArrivalCount).map((product) => product.id));

  return products.map((product) => {
    const lineNames = product.worlds.map((world) => worlds[world].name);
    return {
      id: product.id,
      handle: product.handle,
      name: product.name,
      category: product.category,
      categorySlug: categorySlug(product.category),
      lines: product.worlds,
      priceUzs: product.priceUzs,
      compareAtUzs: product.compareAtUzs,
      ...cardImages(product),
      colors: product.colors.map(({ slug, name, hex }) => ({ slug, name, hex })),
      createdAt: product.createdAt.getTime(),
      sortOrder: product.sortOrder,
      salesRank: salesRank.get(product.id) ?? products.length,
      isNew: fresh.has(product.id),
      isDemo: product.isDemo,
      available: !product.soldOut,
      search: foldText([product.name, product.category, ...lineNames, ...product.colors.map((color) => color.name), product.description, product.fabric].join(" ")),
    };
  });
}

/** Every published product for the shop, in the curated order. */
export async function listShopItems(): Promise<ShopItem[]> {
  const [products, sold] = await Promise.all([listProducts(), unitsSold()]);
  return toShopItems(products, sold);
}
