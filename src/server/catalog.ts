import { asc, eq, inArray } from "drizzle-orm";
import { commerce } from "@/content/commerce";
import { stockLabel } from "@/content/copy";
import type { MediaRecord, ModelEntry, SizeChart, Slot, WorldSlug } from "@/content/types";
import { worlds as worldContent, worldList } from "@/content/worlds";
import { matchesQuery } from "@/lib/search";
import type { CatalogFilters, ParsedCatalogFilters } from "@/lib/validation";
import { catalogFiltersSchema } from "@/lib/validation";
import { requireAdmin } from "./auth";
import type { Executor } from "./db/client";
import { getDb } from "./db/client";
import { productColors, products, productWorlds, variants } from "./db/schema";
import { loadMediaForOwners, modelFor } from "./media";

export type CatalogVariant = { id: string; size: string; stock: number; sku: string };

export type CatalogColor = {
  id: string;
  slug: string;
  name: string;
  hex: string;
  position: number;
  active: boolean;
  /** Ordered by the product's size list. */
  variants: CatalogVariant[];
  /** Merged generated and uploaded media, in order, hidden items removed. */
  media: MediaRecord[];
  /** The colour's 3D model, when one has been imported. */
  model: ModelEntry | null;
};

export type CatalogProduct = {
  id: string;
  handle: string;
  name: string;
  category: string;
  slot: Slot;
  worlds: WorldSlug[];
  priceUzs: number;
  compareAtUzs: number | null;
  sizes: string[];
  description: string;
  fabric: string;
  fit: string;
  care: string;
  sizeChart: SizeChart;
  isDemo: boolean;
  published: boolean;
  sortOrder: number;
  createdAt: Date;
  colors: CatalogColor[];
  /** True when no active colour has stock in any listed size. */
  soldOut: boolean;
};

export const categorySlug = (category: string) =>
  category
    .trim()
    .toLowerCase()
    .replace(/[ʻʼ']/g, "")
    .replace(/[^a-z0-9]+/g, "-");

function hasStock(color: CatalogColor, size?: string) {
  return color.variants.some((variant) => variant.stock > 0 && (!size || variant.size === size));
}

function searchableText(product: CatalogProduct): string {
  return [
    product.name,
    product.category,
    product.description,
    product.fabric,
    ...product.colors.map((color) => color.name),
    ...product.worlds.map((world) => worldContent[world].name),
  ].join(" ");
}

/** Pure filter and sort, so the rules can be tested without a database. */
export function filterProducts<T extends CatalogProduct>(items: readonly T[], filters: ParsedCatalogFilters): T[] {
  const matches = items.filter((product) => {
    if (filters.world && !product.worlds.includes(filters.world)) return false;
    if (filters.category && categorySlug(product.category) !== filters.category) return false;
    if (filters.min !== undefined && product.priceUzs < filters.min) return false;
    if (filters.max !== undefined && product.priceUzs > filters.max) return false;
    if (filters.q && !matchesQuery(searchableText(product), filters.q)) return false;
    const candidates = filters.color ? product.colors.filter((color) => color.slug === filters.color) : product.colors;
    if (candidates.length === 0) return false;
    // A size filter means "can I buy this size", so a sold-out size does not match.
    if (filters.size && !candidates.some((color) => hasStock(color, filters.size))) return false;
    return true;
  });

  const featured = (a: T, b: T) => a.sortOrder - b.sortOrder || a.handle.localeCompare(b.handle);
  const sorted = [...matches];
  switch (filters.sort) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "price-asc":
      return sorted.sort((a, b) => a.priceUzs - b.priceUzs || featured(a, b));
    case "price-desc":
      return sorted.sort((a, b) => b.priceUzs - a.priceUzs || featured(a, b));
    case "newest":
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || featured(a, b));
    case "featured":
      return sorted.sort(featured);
  }
}

type ProductRow = typeof products.$inferSelect;

/** A fixed number of queries for any number of products. There is no N+1 here. */
async function hydrate(rows: ProductRow[], conn: Executor, includeInactive: boolean): Promise<CatalogProduct[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [colorRows, variantRows, worldRows] = await Promise.all([
    conn.select().from(productColors).where(inArray(productColors.productId, ids)).orderBy(asc(productColors.position)),
    conn.select().from(variants).where(inArray(variants.productId, ids)),
    conn.select().from(productWorlds).where(inArray(productWorlds.productId, ids)),
  ]);

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const usable = colorRows.filter((color) => includeInactive || color.active);
  const media = await loadMediaForOwners(
    usable.map((color) => ({
      productHandle: rowById.get(color.productId)?.handle ?? "",
      colorSlug: color.slug,
      colorId: color.id,
    })),
    conn,
  );

  return rows.map((row) => {
    const colors: CatalogColor[] = usable
      .filter((color) => color.productId === row.id)
      .map((color) => ({
        id: color.id,
        slug: color.slug,
        name: color.name,
        hex: color.hex,
        position: color.position,
        active: color.active,
        variants: row.sizes.flatMap((size) => {
          const variant = variantRows.find((v) => v.colorId === color.id && v.size === size);
          return variant ? [{ id: variant.id, size, stock: variant.stock, sku: variant.sku }] : [];
        }),
        media: (media.get(color.id) ?? []).filter((item) => includeInactive || !item.hidden),
        model: modelFor(row.handle, color.slug),
      }));

    return {
      id: row.id,
      handle: row.handle,
      name: row.name,
      category: row.category,
      slot: row.slot,
      worlds: worldRows.filter((world) => world.productId === row.id).map((world) => world.world),
      priceUzs: row.priceUzs,
      compareAtUzs: row.compareAtUzs,
      sizes: row.sizes,
      description: row.description,
      fabric: row.fabric,
      fit: row.fit,
      care: row.care,
      sizeChart: row.sizeChart,
      isDemo: row.isDemo,
      published: row.published,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      colors,
      soldOut: !colors.some((color) => hasStock(color)),
    };
  });
}

async function publishedProducts(): Promise<CatalogProduct[]> {
  const db = await getDb();
  const rows = await db.select().from(products).where(eq(products.published, true)).orderBy(asc(products.sortOrder));
  return hydrate(rows, db, false);
}

/** Published products after filters and sort. Unknown filter values are ignored. */
export async function listProducts(filters: CatalogFilters = {}): Promise<CatalogProduct[]> {
  return filterProducts(await publishedProducts(), catalogFiltersSchema.parse(filters));
}

/** A published product, or null. */
export async function getProductByHandle(handle: string): Promise<CatalogProduct | null> {
  const db = await getDb();
  const rows = await db.select().from(products).where(eq(products.handle, handle)).limit(1);
  const [product] = await hydrate(
    rows.filter((row) => row.published),
    db,
    false,
  );
  return product ?? null;
}

/** Sorts each world by its curated position. Reads the catalog once. */
async function worldShelves(limit?: number): Promise<Record<WorldSlug, CatalogProduct[]>> {
  const db = await getDb();
  const [items, memberships] = await Promise.all([
    publishedProducts(),
    db.select().from(productWorlds).orderBy(asc(productWorlds.position)),
  ]);
  const byId = new Map(items.map((product) => [product.id, product]));
  const shelves = Object.fromEntries(worldList.map((world) => [world.slug, [] as CatalogProduct[]])) as Record<WorldSlug, CatalogProduct[]>;
  for (const { productId, world } of memberships) {
    const product = byId.get(productId);
    if (product && (limit === undefined || shelves[world].length < limit)) shelves[world].push(product);
  }
  return shelves;
}

/** A world's published products in their curated order. */
export async function listWorldProducts(world: WorldSlug, limit?: number): Promise<CatalogProduct[]> {
  return (await worldShelves(limit))[world];
}

/** Every world with its curated products, for the home page. */
export const listAllWorldProducts = (limit?: number) => worldShelves(limit);

/** Up to `limit` others from the product's first world. */
export async function listRelatedProducts(product: Pick<CatalogProduct, "handle" | "worlds">, limit = 4): Promise<CatalogProduct[]> {
  const world = product.worlds[0];
  if (!world) return [];
  const items = await listWorldProducts(world);
  return items.filter((item) => item.handle !== product.handle).slice(0, limit);
}

export type Facet = { value: string; label: string };

export type CatalogFacets = {
  worlds: Facet[];
  categories: Facet[];
  sizes: Facet[];
  colors: (Facet & { hex: string })[];
  price: { min: number; max: number };
};

/** Filter options drawn from what is published. */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  const items = await publishedProducts();
  const categories = new Map<string, string>();
  const sizes = new Map<string, string>();
  const colors = new Map<string, { label: string; hex: string }>();
  for (const product of items) {
    categories.set(categorySlug(product.category), product.category);
    for (const size of product.sizes) sizes.set(size, size);
    for (const color of product.colors) colors.set(color.slug, { label: color.name, hex: color.hex });
  }
  const prices = items.map((product) => product.priceUzs);
  return {
    worlds: worldList.map((world) => ({ value: world.slug, label: world.name })),
    categories: [...categories].map(([value, label]) => ({ value, label })),
    sizes: [...sizes.keys()].map((value) => ({ value, label: value })),
    colors: [...colors].map(([value, color]) => ({ value, ...color })),
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  };
}

/** Text for the stock line in the buy box. */
export const variantStockLabel = (stock: number) => stockLabel(stock, commerce.lowStockAt);

/* Admin reads. Each one checks the session itself. */

/** Every product, drafts included, with hidden media and removed colours. */
export async function adminListProducts(): Promise<CatalogProduct[]> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(products).orderBy(asc(products.sortOrder));
  return hydrate(rows, db, true);
}

export async function adminGetProduct(id: string): Promise<CatalogProduct | null> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const [product] = await hydrate(rows, db, true);
  return product ?? null;
}
