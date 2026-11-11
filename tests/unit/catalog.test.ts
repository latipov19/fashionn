import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoCatalog, demoStock } from "@/content/catalog.demo";
import { WORLD_SLUGS } from "@/content/types";
import {
  categorySlug,
  filterProducts,
  getCatalogFacets,
  getProductByHandle,
  listAllWorldProducts,
  listProducts,
  listRelatedProducts,
  listWorldProducts,
} from "@/server/catalog";
import { closeDb, getDb } from "@/server/db/client";
import { adminUsers, newsletterSignups, productColors, products, productWorlds, variants } from "@/server/db/schema";
import { ensureSeeded, makeSku } from "@/server/db/seed";
import { modelFor } from "@/server/media";
import { subscribe } from "@/server/newsletter";
import { forceStock, variantOf } from "./helpers";

beforeAll(async () => {
  await getDb();
});
afterAll(closeDb);

type Table = typeof products | typeof productColors | typeof variants | typeof productWorlds | typeof adminUsers;
const count = async (table: Table) => {
  const db = await getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(table);
  return row?.count;
};

const handles = (items: { handle: string }[]) => items.map((item) => item.handle);
/** The demo catalogue's own order is the curated, featured order. */
const demoOrder = (keep: (product: (typeof demoCatalog)[number]) => boolean) => demoCatalog.filter(keep).map((product) => product.handle);

describe("seed", () => {
  it("creates the catalogue from the content module", async () => {
    expect(await count(products)).toBe(demoCatalog.length);
    expect(await count(productColors)).toBe(demoCatalog.reduce((sum, product) => sum + product.colors.length, 0));
    expect(await count(variants)).toBe(demoCatalog.reduce((sum, product) => sum + product.colors.length * product.sizes.length, 0));
    expect(await count(productWorlds)).toBe(demoCatalog.reduce((sum, product) => sum + product.worlds.length, 0));
    expect(await count(adminUsers)).toBe(1);
  });

  it("seeds the deterministic demo stock, never negative, with readable SKUs", async () => {
    const db = await getDb();
    const rows = await db
      .select({ stock: variants.stock, sku: variants.sku, size: variants.size, handle: products.handle, color: productColors.slug })
      .from(variants)
      .innerJoin(products, eq(products.id, variants.productId))
      .innerJoin(productColors, eq(productColors.id, variants.colorId));
    for (const row of rows) {
      expect(row.stock).toBe(demoStock(row.handle, row.color, row.size));
      expect(row.stock).toBeGreaterThanOrEqual(0);
      expect(row.sku).toBe(makeSku(row.handle, row.color, row.size));
    }
    expect(makeSku("noir-oversize-hudi", "qora", "XL")).toBe("NOIR-OVERSIZE-HUDI-QORA-XL");
  });

  it("marks every seeded product as a demo", async () => {
    const db = await getDb();
    const rows = await db.select({ isDemo: products.isDemo, published: products.published }).from(products);
    expect(rows.every((row) => row.isDemo && row.published)).toBe(true);
  });

  it("does not seed twice", async () => {
    await ensureSeeded(await getDb());
    expect(await count(products)).toBe(demoCatalog.length);
  });
});

describe("catalogue reads", () => {
  it("hydrates colours, sizes, media and models in the curated order", async () => {
    const items = await listProducts();
    expect(handles(items)).toEqual(demoOrder(() => true));
    const hudi = items.find((product) => product.handle === "noir-oversize-hudi");
    expect(hudi).toMatchObject({ priceUzs: 590_000, compareAtUzs: null, category: "Hudi", slot: "top", worlds: ["dark-mode"], soldOut: false });
    expect(hudi?.colors.map((color) => color.slug)).toEqual(["qora", "grafit"]);
    expect(hudi?.colors[0]?.variants.map((variant) => variant.size)).toEqual(["S", "M", "L", "XL"]);
    expect(hudi?.colors[0]?.media.length).toBeGreaterThan(0);
    expect(hudi?.colors[0]?.model?.url).toBe(modelFor("noir-oversize-hudi", "qora")?.url);
  });

  it("gets a product by handle and hides unpublished products everywhere", async () => {
    expect((await getProductByHandle("static-hudi"))?.name).toBe("Static Yuvilgan Hudi");
    expect(await getProductByHandle("no-such-product")).toBeNull();

    const db = await getDb();
    await db.update(products).set({ published: false }).where(eq(products.handle, "static-hudi"));
    expect(await getProductByHandle("static-hudi")).toBeNull();
    expect(handles(await listProducts())).not.toContain("static-hudi");
    expect(handles(await listWorldProducts("raw-energy"))).not.toContain("static-hudi");
    await db.update(products).set({ published: true }).where(eq(products.handle, "static-hudi"));
  });

  it("marks a product sold out only when no colour has any stock", async () => {
    const db = await getDb();
    const [cap] = await db.select({ id: products.id }).from(products).where(eq(products.handle, "pulse-kepka"));
    const rows = await db.select({ id: variants.id, stock: variants.stock }).from(variants).where(inArray(variants.productId, [cap!.id]));
    await Promise.all(rows.slice(1).map((row) => forceStock(row.id, 0)));
    expect((await getProductByHandle("pulse-kepka"))?.soldOut).toBe(false);
    await forceStock(rows[0]!.id, 0);
    expect((await getProductByHandle("pulse-kepka"))?.soldOut).toBe(true);
    await Promise.all(rows.map((row) => forceStock(row.id, row.stock)));
  });
});

describe("worlds", () => {
  it("shelves every world in its curated order", async () => {
    const shelves = await listAllWorldProducts();
    for (const slug of WORLD_SLUGS) {
      expect(handles(shelves[slug])).toEqual(demoOrder((product) => product.worlds.includes(slug)));
    }
    expect(handles(await listWorldProducts("chrome-future"))).toEqual(handles(shelves["chrome-future"]));
  });

  it("limits each shelf, and a product can stand in two worlds", async () => {
    const shelves = await listAllWorldProducts(2);
    for (const slug of WORLD_SLUGS) expect(shelves[slug].length).toBeLessThanOrEqual(2);
    expect(handles(shelves["dark-mode"])).toEqual(["noir-oversize-hudi", "blackout-bomber"]);
    expect(handles(await listWorldProducts("chrome-future"))[0]).toBe("night-runner");
  });

  it("relates products from the same world, never the product itself", async () => {
    const product = (await getProductByHandle("blackout-bomber"))!;
    const related = handles(await listRelatedProducts(product, 3));
    expect(related).toEqual(["noir-oversize-hudi", "shadow-kargo", "cut-line-futbolka"]);
    expect(await listRelatedProducts({ handle: "x", worlds: [] })).toEqual([]);
  });
});

describe("catalogue filters", () => {
  it("filters by world and category", async () => {
    expect(handles(await listProducts({ world: "soft-signal" }))).toEqual(demoOrder((product) => product.worlds.includes("soft-signal")));
    expect(categorySlug("Koʻylak")).toBe("koylak");
    expect(handles(await listProducts({ category: "hudi" }))).toEqual(["noir-oversize-hudi", "static-hudi"]);
  });

  it("filters by size, and only sizes in stock count", async () => {
    expect(handles(await listProducts({ size: "Yagona" }))).toEqual(["signal-tote", "orbit-sling", "pulse-kepka"]);
    const boots = await Promise.all(["loy", "qora"].map((color) => variantOf("grit-botinka", color, "40")));
    await Promise.all(boots.map((variant) => forceStock(variant.id, 0)));
    expect(handles(await listProducts({ size: "40" }))).toEqual(["night-runner", "alloy-krossovka"]);
    await Promise.all(boots.map((variant) => forceStock(variant.id, variant.stock)));
    expect(handles(await listProducts({ size: "40" }))).toEqual(["night-runner", "alloy-krossovka", "grit-botinka"]);
  });

  it("applies size and colour to the same colour", async () => {
    // Noir Oversize Hudi has no grafit in S, but has qora in S.
    expect(handles(await listProducts({ color: "grafit", size: "S" }))).toEqual(["shadow-kargo"]);
    expect(handles(await listProducts({ color: "qora", size: "S" }))).toContain("noir-oversize-hudi");
    expect(handles(await listProducts({ color: "kumush" }))).toEqual(demoOrder((product) => product.colors.some((color) => color.slug === "kumush")));
  });

  it("filters by price and by Uzbek text typed any way", async () => {
    expect(handles(await listProducts({ min: 1_000_000 }))).toEqual(demoOrder((product) => product.priceUzs >= 1_000_000));
    expect(handles(await listProducts({ min: 300_000, max: 400_000 }))).toEqual(["signal-tote", "grid-termo-futbolka"]);
    expect(handles(await listProducts({ q: "zigʻir koʻylak" }))).toContain("still-zigir-koylak");
    expect(handles(await listProducts({ q: "zigir koylak" }))).toContain("still-zigir-koylak");
    expect(await listProducts({ q: "hech-narsa-topilmaydi" })).toEqual([]);
  });

  it("sorts", async () => {
    const ascending = (await listProducts({ sort: "price-asc" })).map((product) => product.priceUzs);
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    expect((await listProducts({ sort: "price-desc" }))[0]?.handle).toBe("quiet-uzun-palto");
    expect((await listProducts({ sort: "name" }))[0]?.handle).toBe("alloy-krossovka");
  });

  it("ignores bad filter values instead of failing", async () => {
    const items = await listProducts({ world: "nowhere" as never, sort: "evil" as never, min: "abc" as never });
    expect(handles(items)).toEqual(demoOrder(() => true));
  });

  it("filterProducts is pure", async () => {
    const items = await listProducts();
    const first = items[0]?.handle;
    filterProducts(items, { sort: "name" });
    expect(items[0]?.handle).toBe(first);
  });

  it("builds facets from what is published", async () => {
    const facets = await getCatalogFacets();
    expect(facets.worlds.map((world) => world.value)).toEqual([...WORLD_SLUGS]);
    expect(facets.categories).toContainEqual({ value: "hudi", label: "Hudi" });
    expect(facets.sizes.map((size) => size.value)).toContain("Yagona");
    expect(facets.colors.find((color) => color.value === "kumush")).toEqual({ value: "kumush", label: "Kumush", hex: "#AEB3BA" });
    expect(facets.price).toEqual({ min: 190_000, max: 1_890_000 });
  });
});

describe("newsletter", () => {
  it("stores an address once, in lower case, and hides repeats", async () => {
    expect(await subscribe({ email: "Reader@Example.com" })).toEqual({ ok: true });
    expect(await subscribe({ email: "reader@example.com" })).toEqual({ ok: true });
    const db = await getDb();
    const rows = await db.select().from(newsletterSignups).where(eq(newsletterSignups.email, "reader@example.com"));
    expect(rows).toHaveLength(1);
  });

  it("refuses a bad address", async () => {
    expect(await subscribe({ email: "nope" })).toMatchObject({ ok: false, code: "invalid" });
    expect(await subscribe({ email: 42 })).toMatchObject({ ok: false, code: "invalid" });
  });
});
