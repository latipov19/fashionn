import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as catalogIndex } from "@/app/api/catalog/route";
import { commerce } from "@/content/commerce";
import { demoCatalog } from "@/content/catalog.demo";
import { matchRanges } from "@/lib/search";
import type { ShopItem, ShopQuery } from "@/lib/shop";
import { applyShopQuery, EMPTY_QUERY, isFiltered, paramsFromRecord, parsePrice, parseShopQuery, relevance, searchCatalog, SHOP_SORTS, shopFacets, shopHref, sortItems, writeShopQuery } from "@/lib/shop";
import { listProducts } from "@/server/catalog";
import { closeDb, getDb } from "@/server/db/client";
import { cancelOrder, placeOrder } from "@/server/orders";
import { listShopItems, toShopItems } from "@/server/shop";
import { checkoutInput, forceStock, signIn, variantOf } from "./helpers";

let items: ShopItem[];

beforeAll(async () => {
  await getDb();
  items = await listShopItems();
});
afterAll(closeDb);

const handles = (list: { handle: string }[]) => list.map((item) => item.handle);
const query = (patch: Partial<ShopQuery>): ShopQuery => ({ ...EMPTY_QUERY, ...patch });
const run = (patch: Partial<ShopQuery>) => applyShopQuery(items, query(patch));
const params = (search: string) => new URLSearchParams(search);

describe("shop query in the URL", () => {
  it("reads every filter and drops what it does not understand", () => {
    expect(parseShopQuery(params("q=+hudi+&category=hudi,shim,BAD!,hudi&line=dark-mode,nowhere&min=300 000&max=abc&stock=1&new=1&sort=price-desc"))).toEqual({
      q: "hudi",
      categories: ["hudi", "shim"],
      lines: ["dark-mode"],
      min: 300_000,
      max: null,
      inStock: true,
      newOnly: true,
      sort: "price-desc",
    });
    expect(parseShopQuery(params("sort=evil&stock=yes&new=true"))).toEqual(EMPTY_QUERY);
    expect(parseShopQuery(params(`q=${"x".repeat(200)}`)).q).toHaveLength(80);
  });

  it("swaps a minimum above the maximum instead of showing nothing", () => {
    expect(parseShopQuery(params("min=900000&max=300000"))).toMatchObject({ min: 300_000, max: 900_000 });
  });

  it("reads prices typed with spaces and refuses anything else", () => {
    expect(parsePrice("1 290 000")).toBe(1_290_000);
    expect(parsePrice("1 290 000")).toBe(1_290_000);
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("12.5")).toBeNull();
    expect(parsePrice("99999999999")).toBeNull();
    expect(parsePrice("")).toBeNull();
  });

  it("writes only what differs from the defaults and keeps the world", () => {
    const written = writeShopQuery(query({ q: "kargo", categories: ["shim"], sort: "newest" }), "world=raw-energy&q=old&page=2");
    expect(written.get("world")).toBe("raw-energy");
    expect(written.get("page")).toBe("2");
    expect(written.get("q")).toBe("kargo");
    expect(written.get("category")).toBe("shim");
    expect(written.get("sort")).toBe("newest");
    expect(written.has("stock")).toBe(false);
    expect(writeShopQuery(EMPTY_QUERY).toString()).toBe("");
  });

  it("round-trips through the URL", () => {
    const state = query({ q: "Noir hudi", categories: ["hudi", "kurtka"], lines: ["dark-mode", "raw-energy"], min: 100_000, max: 900_000, inStock: true, newOnly: true, sort: "bestselling" });
    expect(parseShopQuery(writeShopQuery(state))).toEqual(state);
  });

  it("builds readable shop links", () => {
    expect(shopHref()).toBe("/shop");
    expect(shopHref({ categories: ["hudi", "shim"] })).toBe("/shop?category=hudi,shim");
    expect(shopHref({ lines: ["soft-signal"] }, "world=soft-signal")).toBe("/shop?world=soft-signal&line=soft-signal");
  });

  it("takes the first of repeated keys from Next's searchParams", () => {
    expect(paramsFromRecord({ q: ["a", "b"], sort: "newest", skip: undefined }).toString()).toBe("q=a&sort=newest");
  });

  it("knows when anything is filtered", () => {
    expect(isFiltered(EMPTY_QUERY)).toBe(false);
    expect(isFiltered(query({ sort: "newest" }))).toBe(false);
    expect(isFiltered(query({ inStock: true }))).toBe(true);
  });
});

describe("search", () => {
  it("finds by name, any case", () => {
    expect(handles(run({ q: "NOIR" }))).toEqual(["noir-oversize-hudi"]);
    expect(handles(run({ q: "bomber" }))).toEqual(["blackout-bomber"]);
  });

  it("finds by category", () => {
    expect(handles(run({ q: "hudi" })).sort()).toEqual(["noir-oversize-hudi", "static-hudi"]);
    expect(run({ q: "poyabzal" })).toHaveLength(demoCatalog.filter((product) => product.category === "Poyabzal").length);
  });

  it("finds by line, which is what VYBEVERSE has for brands", () => {
    const darkMode = demoCatalog.filter((product) => product.worlds.includes("dark-mode")).map((product) => product.handle);
    expect(handles(run({ q: "dark mode" })).sort()).toEqual([...darkMode].sort());
  });

  it("treats every way of typing an Uzbek letter as the same", () => {
    for (const typed of ["zigʻir", "zig'ir", "zig`ir", "zigir", "ZIGʼIR"]) {
      expect(handles(run({ q: typed }))).toContain("still-zigir-koylak");
    }
  });

  it("needs every word to match", () => {
    expect(handles(run({ q: "hudi zaytun" }))).toEqual(["static-hudi"]);
    expect(run({ q: "hudi palto" })).toEqual([]);
    expect(run({ q: "hech-narsa-topilmaydi" })).toEqual([]);
  });

  it("puts names that start with the words first under the default sort", () => {
    const found = run({ q: "kargo" });
    expect(found.every((item) => item.name.toLowerCase().includes("kargo"))).toBe(true);
    const scores = found.map((item) => relevance(item, ["kargo"]));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(relevance({ name: "Shadow Kargo", category: "Shim", lines: [] }, ["kargo"])).toBeGreaterThan(relevance({ name: "Field Ish Kurtka", category: "Kurtka", lines: [] }, ["kargo"]));
  });

  it("keeps the chosen sort when the shopper searched", () => {
    const prices = run({ q: "shim", sort: "price-asc" }).map((item) => item.priceUzs);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe("sorting", () => {
  it("offers seven orders and defaults to featured", () => {
    expect(SHOP_SORTS).toEqual(["featured", "newest", "price-asc", "price-desc", "name-asc", "name-desc", "bestselling"]);
    expect(handles(run({}))).toEqual(demoCatalog.map((product) => product.handle));
  });

  it("orders by price both ways", () => {
    const up = run({ sort: "price-asc" }).map((item) => item.priceUzs);
    expect(up).toEqual([...up].sort((a, b) => a - b));
    const down = run({ sort: "price-desc" }).map((item) => item.priceUzs);
    expect(down).toEqual([...down].sort((a, b) => b - a));
    expect(run({ sort: "price-desc" })[0]?.handle).toBe("quiet-uzun-palto");
  });

  it("orders by name both ways", () => {
    const names = run({ sort: "name-asc" }).map((item) => item.name.toLowerCase());
    expect(names).toEqual([...names].sort());
    expect(run({ sort: "name-asc" })[0]?.handle).toBe("alloy-krossovka");
    expect(handles(run({ sort: "name-desc" }))).toEqual(handles(run({ sort: "name-asc" })).reverse());
  });

  it("orders newest first, ties in the curated order", () => {
    const shuffled: ShopItem[] = items.map((item, index) => ({ ...item, createdAt: index === 5 ? 9e12 : item.createdAt }));
    expect(applyShopQuery(shuffled, query({ sort: "newest" }))[0]?.handle).toBe(items[5]?.handle);
  });

  it("orders best sellers by rank", () => {
    const ranked = items.map((item, index) => ({ ...item, salesRank: items.length - index }));
    expect(handles(applyShopQuery(ranked, query({ sort: "bestselling" })))).toEqual(handles(items).reverse());
  });

  it("sorts catalogue products too, without copying the rules", () => {
    const sorted = sortItems(
      [
        { handle: "b", name: "Beta", priceUzs: 2, sortOrder: 1, createdAt: new Date(1) },
        { handle: "a", name: "alfa", priceUzs: 2, sortOrder: 0, createdAt: new Date(2) },
      ],
      "price-asc",
    );
    expect(handles(sorted)).toEqual(["a", "b"]);
  });
});

describe("filters together", () => {
  it("narrows by category, line, price, stock and newness at once", () => {
    const found = run({ categories: ["shim", "kurtka"], lines: ["chrome-future", "raw-energy"], min: 700_000, max: 1_600_000, inStock: true });
    expect(found.length).toBeGreaterThan(0);
    for (const item of found) {
      expect(["shim", "kurtka"]).toContain(item.categorySlug);
      expect(item.lines.some((line) => line === "chrome-future" || line === "raw-energy")).toBe(true);
      expect(item.priceUzs).toBeGreaterThanOrEqual(700_000);
      expect(item.priceUzs).toBeLessThanOrEqual(1_600_000);
      expect(item.available).toBe(true);
    }
  });

  it("combines search, filters and sort without one undoing another", () => {
    const found = run({ q: "kurtka", lines: ["chrome-future", "raw-energy"], sort: "price-asc" });
    expect(handles(found)).toEqual(["field-ish-kurtka", "mono-shell-kurtka"]);
  });

  it("shows only new arrivals when asked", () => {
    expect(run({ newOnly: true })).toHaveLength(commerce.newArrivalCount);
  });

  it("clearing every filter brings the whole catalogue back", () => {
    expect(run({ ...EMPTY_QUERY })).toHaveLength(items.length);
  });
});

describe("facets", () => {
  it("counts each option against the other filters only", () => {
    const facets = shopFacets(items, query({ categories: ["hudi"] }));
    const shim = facets.categories.find((option) => option.value === "shim");
    expect(shim?.count).toBe(demoCatalog.filter((product) => product.category === "Shim").length);
    const darkMode = facets.lines.find((option) => option.value === "dark-mode");
    expect(darkMode?.count).toBe(1);
  });

  it("keeps options with no match listed, at zero", () => {
    const facets = shopFacets(items, query({ q: "hudi" }));
    expect(facets.categories.find((option) => option.value === "sumka")?.count).toBe(0);
    expect(facets.lines).toHaveLength(4);
  });

  it("spans the catalogue's prices", () => {
    const prices = demoCatalog.map((product) => product.priceUzs);
    expect(shopFacets(items, EMPTY_QUERY).price).toEqual({ min: Math.min(...prices), max: Math.max(...prices) });
  });
});

describe("search overlay", () => {
  it("suggests matching categories and lines with links into the shop", () => {
    const result = searchCatalog(items, "hud");
    expect(result.suggestions).toContainEqual(expect.objectContaining({ kind: "category", value: "hudi", count: 2, href: "/shop?category=hudi" }));
    expect(searchCatalog(items, "chrome").suggestions).toContainEqual(expect.objectContaining({ kind: "line", value: "chrome-future", href: "/shop?line=chrome-future" }));
  });

  it("cuts the products to the limit and reports the full count", () => {
    const result = searchCatalog(items, "shim", 2);
    expect(result.products).toHaveLength(2);
    expect(result.total).toBe(run({ q: "shim" }).length);
  });

  it("returns nothing for an empty query or a miss", () => {
    expect(searchCatalog(items, "   ")).toEqual({ products: [], total: 0, suggestions: [] });
    expect(searchCatalog(items, "qwertyuiop")).toMatchObject({ total: 0, suggestions: [] });
  });

  it("marks the matched part of a name, apostrophes included", () => {
    const name = "Still Zigʻir Koʻylak";
    const [range] = matchRanges(name, "zigir");
    expect(range && name.slice(...range)).toBe("Zigʻir");
    expect(matchRanges("Noir Oversize Hudi", "hudi noir").map((range) => "Noir Oversize Hudi".slice(...range))).toEqual(["Noir", "Hudi"]);
    expect(matchRanges("Calm Keng Shim", "")).toEqual([]);
  });
});

describe("shop records", () => {
  it("lists every published product with an image and a folded search text", async () => {
    expect(items).toHaveLength((await listProducts()).length);
    for (const item of items) {
      expect(item.image?.src).toMatch(/^\/media\//);
      expect(item.search).toBe(item.search.toLowerCase());
    }
  });

  it("never sends sales counts, only a rank", () => {
    for (const item of items) expect(Object.keys(item)).not.toContain("sold");
    expect(new Set(items.map((item) => item.salesRank)).size).toBe(items.length);
  });

  it("marks the most recently added products as new", async () => {
    const products = await listProducts();
    const late = products.map((product, index) => ({ ...product, createdAt: new Date(index === 10 ? Date.now() + 1000 : product.createdAt.getTime()) }));
    const shop = toShopItems(late);
    expect(shop.filter((item) => item.isNew)).toHaveLength(commerce.newArrivalCount);
    expect(shop[10]?.isNew).toBe(true);
  });

  it("ranks best sellers from orders that stand, not cancelled ones", async () => {
    const tote = await variantOf("signal-tote", "sut", "Yagona");
    const bomber = await variantOf("blackout-bomber", "qora", "M");
    await forceStock(tote.id, 10);
    await forceStock(bomber.id, 10);
    const kept = await placeOrder(checkoutInput([{ variantId: tote.id, quantity: 2 }]));
    const dropped = await placeOrder(checkoutInput([{ variantId: bomber.id, quantity: 3 }]));
    if (!kept.ok || !dropped.ok) throw new Error("Expected both orders");

    let ranked = applyShopQuery(await listShopItems(), query({ sort: "bestselling" }));
    expect(handles(ranked).slice(0, 2)).toEqual(["blackout-bomber", "signal-tote"]);

    await signIn();
    await cancelOrder(dropped.order.id);
    ranked = applyShopQuery(await listShopItems(), query({ sort: "bestselling" }));
    expect(ranked[0]?.handle).toBe("signal-tote");
  });

  it("serves the overlay's index as JSON", async () => {
    const response = await catalogIndex();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("max-age=30");
    const body = (await response.json()) as { items: ShopItem[] };
    expect(body.items).toHaveLength(items.length);
  });
});
