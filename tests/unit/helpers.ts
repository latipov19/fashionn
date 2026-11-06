import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { PlaceOrderInput } from "@/lib/validation";
import { login } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { colourways, orders, pieces, variants } from "@/server/db/schema";
import { resetRateLimits } from "@/server/rate-limit";
import type { Jar } from "./setup";

const shared = globalThis as typeof globalThis & { __jar: Jar; __ip: string };

export const jar = () => shared.__jar;
export const setIp = (ip: string) => {
  shared.__ip = ip;
};

export const uniqueKey = () => randomBytes(16).toString("base64url");

export async function signIn() {
  resetRateLimits();
  const result = await login({ email: process.env.ADMIN_EMAIL!, password: process.env.ADMIN_PASSWORD! }, "test");
  if (!result.ok) throw new Error("Test sign-in failed");
}

/** The variant for a piece, colourway and size. */
export async function variantOf(slug: string, colour: string, size: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: variants.id, stock: variants.stock })
    .from(variants)
    .innerJoin(pieces, eq(pieces.id, variants.pieceId))
    .innerJoin(colourways, eq(colourways.id, variants.colourwayId))
    .where(and(eq(pieces.slug, slug), eq(colourways.slug, colour), eq(variants.size, size)))
    .limit(1);
  if (!row) throw new Error(`No variant ${slug}/${colour}/${size}`);
  return row;
}

export async function stockOf(id: string): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ stock: variants.stock }).from(variants).where(eq(variants.id, id)).limit(1);
  if (!row) throw new Error("No variant");
  return row.stock;
}

export async function forceStock(id: string, stock: number) {
  const db = await getDb();
  await db.update(variants).set({ stock }).where(eq(variants.id, id));
}

export async function orderCount(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
  return row?.count ?? 0;
}

export function checkoutInput(lines: PlaceOrderInput["lines"], idempotencyKey = uniqueKey()): PlaceOrderInput {
  return {
    email: "Shopper@Example.com",
    phone: "",
    address: {
      fullName: "Ana Shopper",
      line1: "1 Long Street",
      line2: "",
      city: "Portland",
      region: "OR",
      postalCode: "97201",
      country: "United States",
    },
    shippingMethod: "standard",
    idempotencyKey,
    lines,
  };
}
