import { eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { commerce } from "@/content/commerce";
import type { MediaRecord } from "@/content/types";
import type { CartLine } from "@/lib/validation";
import { cartLineSchema } from "@/lib/validation";
import { getDb } from "./db/client";
import { colourways, pieces, variants } from "./db/schema";
import { loadMediaForOwners, primaryMedia } from "./media";

export const CART_COOKIE = "lierne_cart";
const THIRTY_DAYS = 30 * 24 * 60 * 60;

/**
 * Reads the cookie defensively. It holds only variant ids and quantities, and it can be
 * edited by the visitor, so anything else in it is dropped and every price is re-read.
 */
export function parseCartCookie(raw: string | undefined): CartLine[] {
  if (!raw || raw.length > 4096) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];

  const lines = new Map<string, number>();
  for (const entry of value) {
    if (!Array.isArray(entry)) continue;
    const parsed = cartLineSchema.safeParse({ variantId: entry[0], quantity: entry[1] });
    if (!parsed.success) continue;
    const { variantId, quantity } = parsed.data;
    if (!lines.has(variantId) && lines.size >= commerce.maxCartLines) continue;
    lines.set(variantId, Math.min(commerce.maxLineQuantity, (lines.get(variantId) ?? 0) + quantity));
  }
  return [...lines].map(([variantId, quantity]) => ({ variantId, quantity }));
}

export function serializeCart(lines: readonly CartLine[]): string {
  return JSON.stringify(lines.slice(0, commerce.maxCartLines).map((line) => [line.variantId, line.quantity]));
}

/** The cart lines in the cookie, after cleaning. Nothing is looked up. */
export async function readCartCookie(): Promise<CartLine[]> {
  const store = await cookies();
  return parseCartCookie(store.get(CART_COOKIE)?.value);
}

/** Only callable from a server action or route handler. Next refuses it during render. */
export async function writeCartCookie(lines: readonly CartLine[]): Promise<void> {
  const store = await cookies();
  if (lines.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, serializeCart(lines), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export type CartViewLine = {
  variantId: string;
  pieceSlug: string;
  pieceName: string;
  peg: string;
  colourwayName: string;
  size: string;
  /** Quantity that can actually be bought now. Zero means the line is unavailable. */
  quantity: number;
  /** Quantity asked for in the cookie. */
  requestedQuantity: number;
  stock: number;
  unitPriceCents: number;
  lineTotalCents: number;
  image: MediaRecord | null;
};

export type CartView = {
  lines: CartViewLine[];
  /** Total pieces, for the header count. */
  count: number;
  subtotalCents: number;
  /** True when any line was reduced or is no longer available. */
  changed: boolean;
};

export type PurchasableVariant = {
  variantId: string;
  stock: number;
  sku: string;
  size: string;
  priceCents: number;
  pieceId: string;
  pieceSlug: string;
  pieceName: string;
  peg: string;
  colourwayId: string;
  colourwaySlug: string;
  colourwayName: string;
  /** False when unpublished, or the colourway or size was removed. */
  purchasable: boolean;
};

type Selectable = Pick<Awaited<ReturnType<typeof getDb>>, "select">;

/** Current facts for a set of variants, keyed by id. Unknown ids are simply missing. */
export async function loadVariants(variantIds: readonly string[], db: Selectable): Promise<Map<string, PurchasableVariant>> {
  const result = new Map<string, PurchasableVariant>();
  if (variantIds.length === 0) return result;
  const rows = await db
    .select({ variant: variants, piece: pieces, colourway: colourways })
    .from(variants)
    .innerJoin(pieces, eq(pieces.id, variants.pieceId))
    .innerJoin(colourways, eq(colourways.id, variants.colourwayId))
    .where(inArray(variants.id, [...variantIds]));

  for (const { variant, piece, colourway } of rows) {
    result.set(variant.id, {
      variantId: variant.id,
      stock: variant.stock,
      sku: variant.sku,
      size: variant.size,
      priceCents: piece.priceCents,
      pieceId: piece.id,
      pieceSlug: piece.slug,
      pieceName: piece.name,
      peg: piece.peg,
      colourwayId: colourway.id,
      colourwaySlug: colourway.slug,
      colourwayName: colourway.name,
      purchasable: piece.published && colourway.active && piece.sizes.includes(variant.size),
    });
  }
  return result;
}

/** The priced cart for rendering, from current database values. Safe during render. */
export async function getCart(): Promise<CartView> {
  const cookieLines = await readCartCookie();
  const db = await getDb();
  const facts = await loadVariants(
    cookieLines.map((line) => line.variantId),
    db,
  );

  const known = cookieLines.flatMap((line) => {
    const fact = facts.get(line.variantId);
    return fact ? [{ line, fact }] : [];
  });

  const media = await loadMediaForOwners(
    known.map(({ fact }) => ({ pieceSlug: fact.pieceSlug, colourwaySlug: fact.colourwaySlug, colourwayId: fact.colourwayId })),
    db,
  );

  const lines: CartViewLine[] = known.map(({ line, fact }) => {
    const available = fact.purchasable ? fact.stock : 0;
    const quantity = Math.min(line.quantity, available);
    return {
      variantId: fact.variantId,
      pieceSlug: fact.pieceSlug,
      pieceName: fact.pieceName,
      peg: fact.peg,
      colourwayName: fact.colourwayName,
      size: fact.size,
      quantity,
      requestedQuantity: line.quantity,
      stock: available,
      unitPriceCents: fact.priceCents,
      lineTotalCents: fact.priceCents * quantity,
      image: primaryMedia(media.get(fact.colourwayId) ?? []),
    };
  });

  return {
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    changed: known.length !== cookieLines.length || lines.some((line) => line.quantity !== line.requestedQuantity),
  };
}
