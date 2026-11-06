import { asc, eq, inArray } from "drizzle-orm";
import { commerce } from "@/content/commerce";
import { stockLabel } from "@/content/copy";
import { roomMeta } from "@/content/rooms";
import type { Cloth, Cut, Detail, FrameClass, HangMode, Hour, MediaRecord, Room } from "@/content/types";
import { ROOMS } from "@/content/types";
import type { CatalogFilters, ParsedCatalogFilters } from "@/lib/validation";
import { catalogFiltersSchema } from "@/lib/validation";
import { requireAdmin } from "./auth";
import type { Executor } from "./db/client";
import { getDb } from "./db/client";
import { cloths, colourways, pieces, variants } from "./db/schema";
import { loadMediaForOwners } from "./media";

export type CatalogVariant = { id: string; size: string; stock: number; sku: string };

export type CatalogColourway = {
  id: string;
  slug: string;
  name: string;
  hex: string;
  lining: string;
  position: number;
  active: boolean;
  /** Ordered by the piece's size list. */
  variants: CatalogVariant[];
  /** Merged generated and uploaded media, in order, hidden items removed. */
  media: MediaRecord[];
};

export type CatalogPiece = {
  id: string;
  slug: string;
  peg: string;
  name: string;
  category: string;
  room: Room;
  hour: Hour;
  frameClass: FrameClass;
  hang: HangMode;
  priceCents: number;
  sizes: string[];
  clothId: string;
  cloth: Cloth;
  description: string;
  cut: Cut;
  gatherPct: number;
  seed: number;
  details: Detail[];
  published: boolean;
  sortOrder: number;
  colourways: CatalogColourway[];
  /** True when no active colourway has stock in any listed size. */
  soldOut: boolean;
};

export const FRAME_WIDTH_CM: Record<FrameClass, number> = { wide: 160, mid: 112, small: 72 };
export const RAIL_ROW_CM = 400;

/**
 * Greedy, in display order: a piece joins the current row if it fits within 400 cm of frame
 * width, otherwise it starts a new row. 160 + 160 + 72 and 160 + 112 + 112 both fit.
 */
export function packRailRows<T extends { frameClass: FrameClass }>(items: readonly T[], capacityCm = RAIL_ROW_CM): T[][] {
  const rows: T[][] = [];
  let used = 0;
  for (const item of items) {
    const width = FRAME_WIDTH_CM[item.frameClass];
    const current = rows.at(-1);
    if (current && used + width <= capacityCm) {
      current.push(item);
      used += width;
    } else {
      rows.push([item]);
      used = width;
    }
  }
  return rows;
}

export const categorySlug = (category: string) => category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

function hasStock(colourway: CatalogColourway, size?: string) {
  return colourway.variants.some((variant) => variant.stock > 0 && (!size || variant.size === size));
}

/** Pure filter and sort, so the rules can be tested without a database. */
export function filterPieces<T extends CatalogPiece>(items: readonly T[], filters: ParsedCatalogFilters): T[] {
  const matches = items.filter((piece) => {
    if (filters.room && piece.room !== filters.room) return false;
    if (filters.type && categorySlug(piece.category) !== filters.type) return false;
    const candidates = filters.colour ? piece.colourways.filter((c) => c.slug === filters.colour) : piece.colourways;
    if (candidates.length === 0) return false;
    // A size filter means "can I buy this size", so a sold-out size does not match.
    if (filters.size && !candidates.some((colourway) => hasStock(colourway, filters.size))) return false;
    return true;
  });

  const byPeg = (a: T, b: T) => a.sortOrder - b.sortOrder || a.peg.localeCompare(b.peg);
  const sorted = [...matches];
  switch (filters.sort) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "price-asc":
      return sorted.sort((a, b) => a.priceCents - b.priceCents || byPeg(a, b));
    case "price-desc":
      return sorted.sort((a, b) => b.priceCents - a.priceCents || byPeg(a, b));
    case "peg":
      return sorted.sort(byPeg);
  }
}

type PieceRow = typeof pieces.$inferSelect;

/** Three queries for any number of pieces, plus the media pair. There is no N+1 here. */
async function hydrate(rows: PieceRow[], conn: Executor, includeInactive: boolean): Promise<CatalogPiece[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [clothRows, colourRows, variantRows] = await Promise.all([
    conn.select().from(cloths),
    conn.select().from(colourways).where(inArray(colourways.pieceId, ids)).orderBy(asc(colourways.position)),
    conn.select().from(variants).where(inArray(variants.pieceId, ids)),
  ]);

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const usable = colourRows.filter((colour) => includeInactive || colour.active);
  const media = await loadMediaForOwners(
    usable.map((colour) => ({
      pieceSlug: rowById.get(colour.pieceId)?.slug ?? "",
      colourwaySlug: colour.slug,
      colourwayId: colour.id,
    })),
    conn,
  );

  return rows.map((row) => {
    const pieceColourways: CatalogColourway[] = usable
      .filter((colour) => colour.pieceId === row.id)
      .map((colour) => ({
        id: colour.id,
        slug: colour.slug,
        name: colour.name,
        hex: colour.hex,
        lining: colour.lining,
        position: colour.position,
        active: colour.active,
        variants: row.sizes.flatMap((size) => {
          const variant = variantRows.find((v) => v.colourwayId === colour.id && v.size === size);
          return variant ? [{ id: variant.id, size, stock: variant.stock, sku: variant.sku }] : [];
        }),
        media: (media.get(colour.id) ?? []).filter((item) => includeInactive || !item.hidden),
      }));

    const cloth = clothRows.find((candidate) => candidate.id === row.clothId);
    if (!cloth) throw new Error(`Piece ${row.slug} has no cloth`);

    return {
      id: row.id,
      slug: row.slug,
      peg: row.peg,
      name: row.name,
      category: row.category,
      room: row.room,
      hour: row.hour,
      frameClass: row.frameClass,
      hang: row.hang,
      priceCents: row.priceCents,
      sizes: row.sizes,
      clothId: row.clothId,
      cloth: cloth as Cloth,
      description: row.description,
      cut: row.cut,
      gatherPct: row.gatherPct,
      seed: row.seed,
      details: row.details,
      published: row.published,
      sortOrder: row.sortOrder,
      colourways: pieceColourways,
      soldOut: !pieceColourways.some((colour) => hasStock(colour)),
    };
  });
}

async function publishedPieces(): Promise<CatalogPiece[]> {
  const db = await getDb();
  const rows = await db.select().from(pieces).where(eq(pieces.published, true)).orderBy(asc(pieces.sortOrder));
  return hydrate(rows, db, false);
}

/** Published pieces after filters and sort. Unknown filter values are ignored. */
export async function listPieces(filters: CatalogFilters = {}): Promise<CatalogPiece[]> {
  return filterPieces(await publishedPieces(), catalogFiltersSchema.parse(filters));
}

/** A published piece, or null. */
export async function getPieceBySlug(slug: string): Promise<CatalogPiece | null> {
  const db = await getDb();
  const rows = await db.select().from(pieces).where(eq(pieces.slug, slug)).limit(1);
  const [piece] = await hydrate(
    rows.filter((row) => row.published),
    db,
    false,
  );
  return piece ?? null;
}

export type ShopRoom = {
  room: Room;
  meta: (typeof roomMeta)[Room];
  pieces: CatalogPiece[];
  /** Pieces packed into rail rows of up to 400 cm. */
  rows: CatalogPiece[][];
};

/** One entry per room with matches, for the Long Section. Empty rooms are left out. */
export async function listShopRooms(filters: CatalogFilters = {}): Promise<ShopRoom[]> {
  const items = await listPieces(filters);
  return ROOMS.flatMap((room) => {
    const inRoom = items.filter((piece) => piece.room === room);
    return inRoom.length ? [{ room, meta: roomMeta[room], pieces: inRoom, rows: packRailRows(inRoom) }] : [];
  });
}

/** Up to `limit` other published pieces from the room, for "From the same room". */
export async function listRoomPieces(room: Room, excludeSlug?: string, limit = 3): Promise<CatalogPiece[]> {
  const items = await listPieces({ room });
  return items.filter((piece) => piece.slug !== excludeSlug).slice(0, limit);
}

export type CatalogFacets = {
  rooms: { value: Room; label: string }[];
  types: { value: string; label: string }[];
  sizes: { value: string; label: string }[];
  colours: { value: string; label: string; hex: string }[];
};

/** Filter options drawn from what is published. */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  const items = await publishedPieces();
  const types = new Map<string, string>();
  const sizes = new Map<string, string>();
  const colours = new Map<string, { label: string; hex: string }>();
  for (const piece of items) {
    types.set(categorySlug(piece.category), piece.category);
    for (const size of piece.sizes) sizes.set(size, size);
    for (const colour of piece.colourways) colours.set(colour.slug, { label: colour.name, hex: colour.hex });
  }
  return {
    rooms: ROOMS.map((room) => ({ value: room, label: roomMeta[room].label })),
    types: [...types].map(([value, label]) => ({ value, label })),
    sizes: [...sizes.keys()].map((value) => ({ value, label: value })),
    colours: [...colours].map(([value, colour]) => ({ value, ...colour })),
  };
}

/** Text for the stock line on the product placard. */
export const variantStockLabel = (stock: number) => stockLabel(stock, commerce.lowStockAt);

/* Admin reads. Each one checks the session itself. */

/** Every piece, drafts included, with hidden media and removed colourways. */
export async function adminListPieces(): Promise<CatalogPiece[]> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(pieces).orderBy(asc(pieces.sortOrder));
  return hydrate(rows, db, true);
}

export async function adminGetPiece(id: string): Promise<CatalogPiece | null> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(pieces).where(eq(pieces.id, id)).limit(1);
  const [piece] = await hydrate(rows, db, true);
  return piece ?? null;
}

/** The cloth list for the piece form. */
export async function adminListCloths(): Promise<Cloth[]> {
  await requireAdmin();
  const db = await getDb();
  return (await db.select().from(cloths).orderBy(asc(cloths.label))) as Cloth[];
}
