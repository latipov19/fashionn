import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cloths as clothContent } from "@/content/cloths";
import { pieces as pieceContent } from "@/content/pieces";
import { roomMeta } from "@/content/rooms";
import { separation } from "@/lib/colour";
import {
  FRAME_WIDTH_CM,
  filterPieces,
  getCatalogFacets,
  getPieceBySlug,
  listPieces,
  listRoomPieces,
  listShopRooms,
  packRailRows,
} from "@/server/catalog";
import { closeDb, getDb } from "@/server/db/client";
import { adminUsers, cloths, colourways, newsletterSignups, pieces, variants } from "@/server/db/schema";
import { ensureSeeded } from "@/server/db/seed";
import { subscribe } from "@/server/newsletter";
import { forceStock, variantOf } from "./helpers";

beforeAll(async () => {
  await getDb();
});
afterAll(closeDb);

const count = async (table: typeof pieces | typeof cloths | typeof colourways | typeof variants | typeof adminUsers) => {
  const db = await getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(table);
  return row?.count;
};

describe("seed", () => {
  it("creates the catalog from the content modules", async () => {
    expect(await count(pieces)).toBe(12);
    expect(await count(cloths)).toBe(10);
    expect(await count(colourways)).toBe(26);
    const expected = pieceContent.reduce((sum, piece) => sum + piece.colourways.length * piece.sizes.length, 0);
    expect(await count(variants)).toBe(expected);
    expect(await count(adminUsers)).toBe(1);
  });

  it("seeds 8 per size per colourway and stores cut and details as JSON", async () => {
    const db = await getDb();
    const stock = await db.select({ stock: variants.stock }).from(variants);
    expect(stock.every((row) => row.stock === 8)).toBe(true);
    const [row] = await db.select().from(pieces).where(eq(pieces.slug, "lintel-coat"));
    expect(row).toMatchObject({ priceCents: 92_000, peg: "I.01", gatherPct: 6, seed: 1101 });
    expect(row?.cut).toEqual(pieceContent[0]?.cut);
    expect(row?.details).toEqual(pieceContent[0]?.details);
  });

  it("does not seed twice", async () => {
    await ensureSeeded(await getDb());
    expect(await count(pieces)).toBe(12);
  });

  it("every seed colourway passes the separation rule in 9.6", () => {
    for (const piece of pieceContent) {
      for (const colourway of piece.colourways) {
        const result = separation(colourway.hex, roomMeta[piece.room].pigment);
        expect(result.passes, `${piece.name} ${colourway.name} dE ${result.deltaE.toFixed(1)} dL ${result.deltaL.toFixed(1)}`).toBe(true);
      }
    }
    expect(separation("#6E2C1E", "#6E2C1E").passes).toBe(false);
  });

  it("content has unique ids and every piece names a real cloth", () => {
    expect(new Set(pieceContent.map((piece) => piece.slug)).size).toBe(12);
    expect(new Set(pieceContent.map((piece) => piece.peg)).size).toBe(12);
    const clothIds = new Set(clothContent.map((cloth) => cloth.id));
    expect(pieceContent.every((piece) => clothIds.has(piece.clothId))).toBe(true);
  });
});

describe("rail packing", () => {
  const frames = (...classes: ("wide" | "mid" | "small")[]) => classes.map((frameClass) => ({ frameClass }));
  const widths = (rows: { frameClass: "wide" | "mid" | "small" }[][]) =>
    rows.map((row) => row.map((item) => FRAME_WIDTH_CM[item.frameClass]));

  it("fills a row up to exactly 400 cm where it can", () => {
    expect(widths(packRailRows(frames("wide", "wide", "small")))).toEqual([[160, 160, 72]]);
    expect(widths(packRailRows(frames("wide", "mid", "mid")))).toEqual([[160, 112, 112]]);
  });

  it("starts a new row when the next piece would pass 400 cm", () => {
    expect(widths(packRailRows(frames("wide", "wide", "wide")))).toEqual([[160, 160], [160]]);
    expect(widths(packRailRows(frames("wide", "wide", "mid", "small")))).toEqual([[160, 160], [112, 72]]);
  });

  it("keeps display order and handles empty and single inputs", () => {
    expect(packRailRows([])).toEqual([]);
    expect(widths(packRailRows(frames("small")))).toEqual([[72]]);
    const items = [{ frameClass: "wide" as const, id: 1 }, { frameClass: "mid" as const, id: 2 }];
    expect(packRailRows(items).flat().map((item) => item.id)).toEqual([1, 2]);
  });

  it("never passes 400 cm on the real catalog", async () => {
    for (const { rows } of await listShopRooms()) {
      for (const row of rows) {
        expect(row.reduce((sum, piece) => sum + FRAME_WIDTH_CM[piece.frameClass], 0)).toBeLessThanOrEqual(400);
      }
    }
  });
});

describe("catalog filters", () => {
  const slugs = (items: { slug: string }[]) => items.map((item) => item.slug);

  it("lists all 12 in peg order by default", async () => {
    const items = await listPieces();
    expect(items).toHaveLength(12);
    expect(items[0]).toMatchObject({ slug: "lintel-coat", priceCents: 92_000, soldOut: false });
    expect(items[0]?.cloth.label).toBe("Heavy wool twill");
    expect(items[0]?.colourways.map((c) => c.slug)).toEqual(["chalk", "soot", "slate"]);
    expect(items[0]?.colourways[0]?.variants.map((v) => v.size)).toEqual(["S", "M", "L", "XL"]);
    expect(items.at(-1)?.slug).toBe("cornice-scarf");
  });

  it("filters by room", async () => {
    expect(slugs(await listPieces({ room: "III" }))).toEqual(["arcade-trouser", "nave-dress", "apse-skirt", "cornice-scarf"]);
  });

  it("filters by type", async () => {
    expect(slugs(await listPieces({ type: "coats" }))).toEqual(["lintel-coat", "transom-cape"]);
  });

  it("filters by size, and only sizes in stock count", async () => {
    expect(slugs(await listPieces({ size: "One size" }))).toEqual(["transom-cape", "cornice-scarf"]);
    expect(slugs(await listPieces({ size: "32" }))).toEqual(["arcade-trouser"]);

    const trouserVariants = await Promise.all(
      ["stone", "clay", "pewter"].map((colour) => variantOf("arcade-trouser", colour, "36")),
    );
    await Promise.all(trouserVariants.map((variant) => forceStock(variant.id, 0)));
    expect(await listPieces({ size: "36" })).toEqual([]);
    await Promise.all(trouserVariants.map((variant) => forceStock(variant.id, 8)));
  });

  it("filters by colour, and size and colour apply to the same colourway", async () => {
    expect(slugs(await listPieces({ colour: "chalk" }))).toEqual(["lintel-coat"]);
    const chalk = await variantOf("lintel-coat", "chalk", "XL");
    await forceStock(chalk.id, 0);
    expect(await listPieces({ colour: "chalk", size: "XL" })).toEqual([]);
    expect(slugs(await listPieces({ colour: "soot", size: "XL" }))).toEqual(["lintel-coat"]);
    await forceStock(chalk.id, 8);
  });

  it("combines filters and returns nothing when nothing matches", async () => {
    expect(slugs(await listPieces({ room: "I", type: "jackets", size: "XL" }))).toEqual(["jamb-jacket", "purlin-vest"]);
    expect(await listPieces({ room: "I", type: "dresses" })).toEqual([]);
  });

  it("sorts", async () => {
    const asc = (await listPieces({ sort: "price-asc" })).map((piece) => piece.priceCents);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect((await listPieces({ sort: "price-desc" }))[0]?.slug).toBe("lintel-coat");
    expect((await listPieces({ sort: "name" }))[0]?.slug).toBe("apse-skirt");
  });

  it("ignores bad filter values instead of failing", async () => {
    const items = await listPieces({ room: "IX" as never, sort: "evil" as never });
    expect(items).toHaveLength(12);
    expect(items[0]?.slug).toBe("lintel-coat");
  });

  it("filterPieces is pure", async () => {
    const items = await listPieces();
    const first = items[0]?.slug;
    filterPieces(items, { sort: "name" });
    expect(items[0]?.slug).toBe(first);
  });
});

describe("catalog reads", () => {
  it("gets a piece by slug and hides unpublished pieces everywhere", async () => {
    expect((await getPieceBySlug("nave-dress"))?.peg).toBe("III.02");
    expect(await getPieceBySlug("no-such-piece")).toBeNull();

    const db = await getDb();
    await db.update(pieces).set({ published: false }).where(eq(pieces.slug, "nave-dress"));
    expect(await getPieceBySlug("nave-dress")).toBeNull();
    expect((await listPieces()).map((piece) => piece.slug)).not.toContain("nave-dress");
    await db.update(pieces).set({ published: true }).where(eq(pieces.slug, "nave-dress"));
  });

  it("groups by room with rows, and leaves out empty rooms", async () => {
    const all = await listShopRooms();
    expect(all.map((entry) => entry.room)).toEqual(["I", "II", "III"]);
    expect(all[0]?.meta.ground).toBe("oxide");
    expect(all[0]?.rows.map((row) => row.length)).toEqual([2, 2]);
    expect(all[2]?.rows.map((row) => row.map((piece) => piece.slug))).toEqual([
      ["arcade-trouser", "nave-dress", "apse-skirt"],
      ["cornice-scarf"],
    ]);
    expect((await listShopRooms({ type: "trousers" })).map((entry) => entry.room)).toEqual(["III"]);
  });

  it("lists other pieces from the room", async () => {
    expect((await listRoomPieces("II", "mullion-shirt")).map((piece) => piece.slug)).toEqual([
      "clerestory-overshirt",
      "frieze-tunic",
      "spandrel-top",
    ]);
  });

  it("builds facets from what is published", async () => {
    const facets = await getCatalogFacets();
    expect(facets.rooms).toHaveLength(3);
    expect(facets.types.map((type) => type.value)).toContain("accessories");
    expect(facets.sizes.map((size) => size.value)).toContain("One size");
    expect(facets.colours.find((colour) => colour.value === "chalk")).toEqual({ value: "chalk", label: "Chalk", hex: "#DAD2C2" });
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
