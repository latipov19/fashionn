import type { WorldSlug } from "@/content/types";
import { worldList, worlds } from "@/content/worlds";
import { foldText, matchesTokens, queryTokens } from "./search";

/*
 * Search, filters and sort for the shop page and the header's search overlay. Pure and free of
 * server imports, so the browser runs exactly the code the server used for the first paint and
 * a filter change never waits for the network. The URL is the state: parse it, apply it, write
 * it back.
 */

export const SHOP_SORTS = ["featured", "newest", "price-asc", "price-desc", "name-asc", "name-desc", "bestselling"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];
export const DEFAULT_SORT: ShopSort = "featured";

export type ShopImage = { src: string; srcSet: string; width: number; height: number; alt: string; blur: string };

/** One published product as the shop needs it. Built on the server by src/server/shop.ts. */
export type ShopItem = {
  id: string;
  handle: string;
  name: string;
  category: string;
  categorySlug: string;
  /** The worlds the product belongs to. VYBEVERSE's worlds are its lines. */
  lines: WorldSlug[];
  priceUzs: number;
  compareAtUzs: number | null;
  image: ShopImage | null;
  /** A second view for the card's hover, when the product has one. */
  hoverImage: ShopImage | null;
  colors: { slug: string; name: string; hex: string }[];
  /** Milliseconds since the epoch. */
  createdAt: number;
  /** The curated order: 0 leads. */
  sortOrder: number;
  /** Position by units sold, 0 is the best seller. Ties keep the curated order. No counts leave the server. */
  salesRank: number;
  isNew: boolean;
  isDemo: boolean;
  /** Some active colour has stock in some listed size. */
  available: boolean;
  /** Name, category, lines, colours, description and fabric, folded once on the server. */
  search: string;
};

export type ShopQuery = {
  q: string;
  categories: string[];
  lines: WorldSlug[];
  min: number | null;
  max: number | null;
  inStock: boolean;
  newOnly: boolean;
  sort: ShopSort;
};

export const EMPTY_QUERY: ShopQuery = { q: "", categories: [], lines: [], min: null, max: null, inStock: false, newOnly: false, sort: DEFAULT_SORT };

/** Query string names. `world` is left alone: it retints the site and has nothing to do with filtering. */
const PARAMS = { q: "q", categories: "category", lines: "line", min: "min", max: "max", inStock: "stock", newOnly: "new", sort: "sort" } as const;

export const MAX_QUERY_LENGTH = 80;
const MAX_PRICE = 2_000_000_000;
const SLUG = /^[a-z0-9-]{1,60}$/;
const WORLD_SET = new Set<string>(worldList.map((world) => world.slug));

type ParamReader = { get(name: string): string | null };

/** Next's `searchParams` object as something with `get`, keeping only the first of repeated keys. */
export function paramsFromRecord(record: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params.set(key, first);
  }
  return params;
}

const list = (value: string | null) => [...new Set((value ?? "").split(",").map((part) => part.trim()).filter(Boolean))];

/** A typed price such as `590 000` or `590000`. Anything else means "no limit". */
export function parsePrice(value: string | null | undefined): number | null {
  const compact = (value ?? "").replace(/[\s  ]/g, "");
  if (!/^\d{1,10}$/.test(compact)) return null;
  const amount = Number(compact);
  return amount <= MAX_PRICE ? amount : null;
}

/** Reads the shop's state from a query string. Unknown or malformed values are dropped, so an old link still opens. */
export function parseShopQuery(params: ParamReader): ShopQuery {
  let min = parsePrice(params.get(PARAMS.min));
  let max = parsePrice(params.get(PARAMS.max));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const sort = params.get(PARAMS.sort);
  return {
    q: (params.get(PARAMS.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    categories: list(params.get(PARAMS.categories)).filter((slug) => SLUG.test(slug)).slice(0, 20),
    lines: list(params.get(PARAMS.lines)).filter((slug): slug is WorldSlug => WORLD_SET.has(slug)),
    min,
    max,
    inStock: params.get(PARAMS.inStock) === "1",
    newOnly: params.get(PARAMS.newOnly) === "1",
    sort: SHOP_SORTS.includes(sort as ShopSort) ? (sort as ShopSort) : DEFAULT_SORT,
  };
}

/** Writes the state over `base`, keeping any other parameter (such as `world`). Defaults are left out. */
export function writeShopQuery(query: ShopQuery, base?: URLSearchParams | string): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const name of Object.values(PARAMS)) params.delete(name);
  const q = query.q.trim();
  if (q) params.set(PARAMS.q, q);
  if (query.categories.length) params.set(PARAMS.categories, query.categories.join(","));
  if (query.lines.length) params.set(PARAMS.lines, query.lines.join(","));
  if (query.min !== null) params.set(PARAMS.min, String(query.min));
  if (query.max !== null) params.set(PARAMS.max, String(query.max));
  if (query.inStock) params.set(PARAMS.inStock, "1");
  if (query.newOnly) params.set(PARAMS.newOnly, "1");
  if (query.sort !== DEFAULT_SORT) params.set(PARAMS.sort, query.sort);
  return params;
}

/** A link to the shop showing `query`. Commas stay readable in the address bar. */
export function shopHref(query: Partial<ShopQuery> = {}, base?: URLSearchParams | string): string {
  const search = writeShopQuery({ ...EMPTY_QUERY, ...query }, base).toString().replace(/%2C/g, ",");
  return search ? `/shop?${search}` : "/shop";
}

export const isFiltered = (query: ShopQuery) =>
  query.q !== "" || query.categories.length > 0 || query.lines.length > 0 || query.min !== null || query.max !== null || query.inStock || query.newOnly;

/* Matching */

type Facet = "categories" | "lines" | "price" | "inStock" | "newOnly";

function matches(item: ShopItem, query: ShopQuery, tokens: readonly string[], skip?: Facet): boolean {
  if (tokens.length && !matchesTokens(item.search, tokens)) return false;
  if (skip !== "categories" && query.categories.length && !query.categories.includes(item.categorySlug)) return false;
  if (skip !== "lines" && query.lines.length && !item.lines.some((line) => query.lines.includes(line))) return false;
  if (skip !== "price" && query.min !== null && item.priceUzs < query.min) return false;
  if (skip !== "price" && query.max !== null && item.priceUzs > query.max) return false;
  if (skip !== "inStock" && query.inStock && !item.available) return false;
  if (skip !== "newOnly" && query.newOnly && !item.isNew) return false;
  return true;
}

/**
 * How well an item answers the words typed: a name word that starts with the word counts most,
 * then a name that contains it, then its category or line, then anything else it matched.
 */
export function relevance(item: Pick<ShopItem, "name" | "category" | "lines">, tokens: readonly string[], phrase = tokens.join(" ")): number {
  const name = foldText(item.name);
  const words = name.split(/\s+/);
  const category = foldText(item.category);
  const lines = item.lines.map((line) => foldText(worlds[line].name)).join(" ");
  let score = phrase && name.startsWith(phrase) ? 6 : 0;
  for (const token of tokens) {
    if (words.some((word) => word.startsWith(token))) score += 4;
    else if (name.includes(token)) score += 2;
    else if (category.includes(token) || lines.includes(token)) score += 1.5;
    else score += 0.5;
  }
  return score;
}

/* Sorting */

/** What a sort reads. The admin catalog's products fit it as well as shop items. */
export type Sortable = { handle: string; name: string; priceUzs: number; sortOrder: number; createdAt: number | Date; salesRank?: number };

const byCurated = (a: Sortable, b: Sortable) => a.sortOrder - b.sortOrder || (a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0);
/** Folded and compared by code unit, so the server and every browser agree on the order and hydration never differs. */
const byName = (a: Sortable, b: Sortable) => {
  const left = foldText(a.name);
  const right = foldText(b.name);
  return left < right ? -1 : left > right ? 1 : 0;
};

const COMPARE: Record<ShopSort, (a: Sortable, b: Sortable) => number> = {
  featured: byCurated,
  newest: (a, b) => Number(b.createdAt) - Number(a.createdAt) || byCurated(a, b),
  "price-asc": (a, b) => a.priceUzs - b.priceUzs || byCurated(a, b),
  "price-desc": (a, b) => b.priceUzs - a.priceUzs || byCurated(a, b),
  "name-asc": (a, b) => byName(a, b) || byCurated(a, b),
  "name-desc": (a, b) => byName(b, a) || byCurated(a, b),
  bestselling: (a, b) => (a.salesRank ?? 0) - (b.salesRank ?? 0) || byCurated(a, b),
};

/** A sorted copy. `score` puts the best matches first when the shopper searched and kept the default sort. */
export function sortItems<T extends Sortable>(items: readonly T[], sort: ShopSort, score?: (item: T) => number): T[] {
  const compare = COMPARE[sort];
  if (!score || sort !== DEFAULT_SORT) return [...items].sort(compare);
  const scores = new Map(items.map((item) => [item, score(item)]));
  return [...items].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || compare(a, b));
}

/** The items that pass every filter, in the chosen order. */
export function applyShopQuery(items: readonly ShopItem[], query: ShopQuery): ShopItem[] {
  const tokens = queryTokens(query.q);
  const found = items.filter((item) => matches(item, query, tokens));
  return sortItems(found, query.sort, tokens.length ? (item) => relevance(item, tokens) : undefined);
}

/* Facets */

export type FacetOption<T extends string = string> = { value: T; label: string; count: number };

export type ShopFacets = {
  categories: FacetOption[];
  lines: (FacetOption<WorldSlug> & { swatch: string })[];
  /** How many would show with the toggle on, everything else kept. */
  inStock: number;
  newOnly: number;
  price: { min: number; max: number };
};

/**
 * Every option with the number of products it would show, counted against the other filters
 * only, so ticking a second category shows how many it adds. Options that match nothing stay
 * listed with a zero, so the panel does not jump while the shopper narrows the search.
 */
export function shopFacets(items: readonly ShopItem[], query: ShopQuery): ShopFacets {
  const tokens = queryTokens(query.q);
  const categoryLabels = new Map<string, string>();
  const categoryCounts = new Map<string, number>();
  const lineCounts = new Map<WorldSlug, number>();
  let inStock = 0;
  let newOnly = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = 0;

  for (const item of items) {
    if (!categoryLabels.has(item.categorySlug)) categoryLabels.set(item.categorySlug, item.category);
    min = Math.min(min, item.priceUzs);
    max = Math.max(max, item.priceUzs);
    if (matches(item, query, tokens, "categories")) categoryCounts.set(item.categorySlug, (categoryCounts.get(item.categorySlug) ?? 0) + 1);
    if (matches(item, query, tokens, "lines")) for (const line of item.lines) lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1);
    if (item.available && matches(item, query, tokens, "inStock")) inStock += 1;
    if (item.isNew && matches(item, query, tokens, "newOnly")) newOnly += 1;
  }

  return {
    categories: [...categoryLabels].map(([value, label]) => ({ value, label, count: categoryCounts.get(value) ?? 0 })),
    lines: worldList.map((world) => ({ value: world.slug, label: world.name, swatch: world.theme.bg, count: lineCounts.get(world.slug) ?? 0 })),
    inStock,
    newOnly,
    price: { min: Number.isFinite(min) ? min : 0, max },
  };
}

/* The header's search overlay */

export type SearchSuggestion = { kind: "category" | "line"; value: string; label: string; count: number; href: string };

export type SearchResult = {
  products: ShopItem[];
  /** Every product that matched, before the cut to `limit`. */
  total: number;
  suggestions: SearchSuggestion[];
};

/**
 * Type-ahead for the overlay: the best matching products, and the categories and lines whose
 * names match what was typed, each linking to the shop already filtered.
 */
export function searchCatalog(items: readonly ShopItem[], text: string, limit = 6): SearchResult {
  const tokens = queryTokens(text);
  if (tokens.length === 0) return { products: [], total: 0, suggestions: [] };

  const found = applyShopQuery(items, { ...EMPTY_QUERY, q: text });
  const labelMatches = (label: string) => {
    const folded = foldText(label);
    return tokens.some((token) => folded.split(/\s+/).some((word) => word.startsWith(token))) || folded.includes(tokens.join(" "));
  };

  const categories = new Map<string, SearchSuggestion>();
  const lines = new Map<string, SearchSuggestion>();
  for (const item of items) {
    if (labelMatches(item.category)) {
      const entry = categories.get(item.categorySlug);
      if (entry) entry.count += 1;
      else categories.set(item.categorySlug, { kind: "category", value: item.categorySlug, label: item.category, count: 1, href: shopHref({ categories: [item.categorySlug] }) });
    }
    for (const line of item.lines) {
      const name = worlds[line].name;
      if (!labelMatches(name)) continue;
      const entry = lines.get(line);
      if (entry) entry.count += 1;
      else lines.set(line, { kind: "line", value: line, label: name, count: 1, href: shopHref({ lines: [line] }) });
    }
  }

  return { products: found.slice(0, limit), total: found.length, suggestions: [...categories.values(), ...lines.values()].slice(0, 4) };
}
