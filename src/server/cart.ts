import { eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { commerce } from "@/content/commerce";
import type { MediaRecord } from "@/content/types";
import type { CartLine } from "@/lib/validation";
import { cartLineSchema } from "@/lib/validation";
import { getDb } from "./db/client";
import { productColors, products, variants } from "./db/schema";
import { loadMediaForOwners, primaryMedia } from "./media";

export const CART_COOKIE = "vv_cart";
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
  productHandle: string;
  productName: string;
  colorName: string;
  size: string;
  /** Quantity that can actually be bought now. Zero means the line is unavailable. */
  quantity: number;
  /** Quantity asked for in the cookie. */
  requestedQuantity: number;
  stock: number;
  unitPriceUzs: number;
  lineTotalUzs: number;
  image: MediaRecord | null;
};

export type CartView = {
  lines: CartViewLine[];
  /** Total products, for the header count. */
  count: number;
  subtotalUzs: number;
  /** True when any line was reduced or is no longer available. */
  changed: boolean;
};

export type PurchasableVariant = {
  variantId: string;
  stock: number;
  sku: string;
  size: string;
  priceUzs: number;
  productId: string;
  productHandle: string;
  productName: string;
  colorId: string;
  colorSlug: string;
  colorName: string;
  /** False when unpublished, or the color or size was removed. */
  purchasable: boolean;
};

type Selectable = Pick<Awaited<ReturnType<typeof getDb>>, "select">;

/** Current facts for a set of variants, keyed by id. Unknown ids are simply missing. */
export async function loadVariants(variantIds: readonly string[], db: Selectable): Promise<Map<string, PurchasableVariant>> {
  const result = new Map<string, PurchasableVariant>();
  if (variantIds.length === 0) return result;
  const rows = await db
    .select({ variant: variants, product: products, color: productColors })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(productColors, eq(productColors.id, variants.colorId))
    .where(inArray(variants.id, [...variantIds]));

  for (const { variant, product, color } of rows) {
    result.set(variant.id, {
      variantId: variant.id,
      stock: variant.stock,
      sku: variant.sku,
      size: variant.size,
      priceUzs: product.priceUzs,
      productId: product.id,
      productHandle: product.handle,
      productName: product.name,
      colorId: color.id,
      colorSlug: color.slug,
      colorName: color.name,
      purchasable: product.published && color.active && product.sizes.includes(variant.size),
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
    known.map(({ fact }) => ({ productHandle: fact.productHandle, colorSlug: fact.colorSlug, colorId: fact.colorId })),
    db,
  );

  const lines: CartViewLine[] = known.map(({ line, fact }) => {
    const available = fact.purchasable ? fact.stock : 0;
    const quantity = Math.min(line.quantity, available);
    return {
      variantId: fact.variantId,
      productHandle: fact.productHandle,
      productName: fact.productName,
      colorName: fact.colorName,
      size: fact.size,
      quantity,
      requestedQuantity: line.quantity,
      stock: available,
      unitPriceUzs: fact.priceUzs,
      lineTotalUzs: fact.priceUzs * quantity,
      image: primaryMedia(media.get(fact.colorId) ?? []),
    };
  });

  return {
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalUzs: lines.reduce((sum, line) => sum + line.lineTotalUzs, 0),
    changed: known.length !== cookieLines.length || lines.some((line) => line.quantity !== line.requestedQuantity),
  };
}
