"use server";

import { revalidatePath } from "next/cache";
import { commerce } from "@/content/commerce";
import { copy } from "@/content/copy";
import { addToCartSchema, removeCartLineSchema, updateCartLineSchema } from "@/lib/validation";
import type { CartLine } from "@/lib/validation";
import { loadVariants, readCartCookie, writeCartCookie } from "../cart";
import { getDb } from "../db/client";

export type CartActionState =
  | { status: "idle" }
  | { status: "added" | "updated" | "removed"; message?: string }
  | { status: "error"; message: string };

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : undefined;
}

/** All three take (previous state, FormData), so they work with useActionState and no JS. */
export async function addToCartAction(_previous: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = addToCartSchema.safeParse({ variantId: value(formData, "variantId"), quantity: value(formData, "quantity") });
  if (!parsed.success) return { status: "error", message: copy.micro.addFailed };
  const { variantId, quantity } = parsed.data;

  try {
    const db = await getDb();
    const fact = (await loadVariants([variantId], db)).get(variantId);
    const stock = fact?.purchasable ? fact.stock : 0;
    if (stock <= 0) return { status: "error", message: copy.micro.soldOut };

    const lines = await readCartCookie();
    const existing = lines.find((line) => line.variantId === variantId);
    if (!existing && lines.length >= commerce.maxCartLines) return { status: "error", message: copy.cart.full };

    const wanted = (existing?.quantity ?? 0) + quantity;
    const limit = Math.min(stock, commerce.maxLineQuantity);
    const next: CartLine[] = existing
      ? lines.map((line) => (line.variantId === variantId ? { variantId, quantity: Math.min(wanted, limit) } : line))
      : [...lines, { variantId, quantity: Math.min(wanted, limit) }];

    await writeCartCookie(next);
    revalidatePath("/", "layout");
    return wanted > limit
      ? { status: "added", message: copy.micro.onlyLeft(limit) }
      : { status: "added", message: copy.micro.added };
  } catch (error) {
    console.error("addToCartAction failed", error);
    return { status: "error", message: copy.micro.addFailed };
  }
}

/** Sets a line to `quantity`, capped at stock. Zero removes the line. */
export async function updateCartLineAction(_previous: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = updateCartLineSchema.safeParse({ variantId: value(formData, "variantId"), quantity: value(formData, "quantity") });
  if (!parsed.success) return { status: "error", message: copy.cart.couldNotUpdate };
  const { variantId, quantity } = parsed.data;

  try {
    const lines = await readCartCookie();
    if (quantity === 0) {
      await writeCartCookie(lines.filter((line) => line.variantId !== variantId));
      revalidatePath("/", "layout");
      return { status: "removed" };
    }

    const db = await getDb();
    const fact = (await loadVariants([variantId], db)).get(variantId);
    const stock = fact?.purchasable ? fact.stock : 0;
    if (stock <= 0) {
      await writeCartCookie(lines.filter((line) => line.variantId !== variantId));
      revalidatePath("/", "layout");
      return { status: "error", message: copy.micro.soldOut };
    }

    const capped = Math.min(quantity, stock);
    await writeCartCookie(lines.map((line) => (line.variantId === variantId ? { variantId, quantity: capped } : line)));
    revalidatePath("/", "layout");
    return capped < quantity
      ? { status: "updated", message: copy.micro.onlyLeft(capped) }
      : { status: "updated" };
  } catch (error) {
    console.error("updateCartLineAction failed", error);
    return { status: "error", message: copy.cart.couldNotUpdate };
  }
}

export async function removeCartLineAction(_previous: CartActionState, formData: FormData): Promise<CartActionState> {
  const parsed = removeCartLineSchema.safeParse({ variantId: value(formData, "variantId") });
  if (!parsed.success) return { status: "error", message: copy.cart.couldNotUpdate };
  const lines = await readCartCookie();
  await writeCartCookie(lines.filter((line) => line.variantId !== parsed.data.variantId));
  revalidatePath("/", "layout");
  return { status: "removed" };
}
