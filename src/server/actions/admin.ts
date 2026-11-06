"use server";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { copy } from "@/content/copy";
import type { WorldSlug } from "@/content/types";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import type { CreateProductInput, UpdateProductInput } from "@/lib/validation";
import {
  createProductSchema,
  fieldErrors,
  hideMediaSchema,
  MAX_UPLOAD_BYTES,
  reorderMediaSchema,
  reorderProductsSchema,
  revertMediaSchema,
  setOrderStatusSchema,
  setPublishedSchema,
  setStockSchema,
  updateProductSchema,
  uploadMediaSchema,
} from "@/lib/validation";
import { UnauthorizedError, requireAdmin } from "../auth";
import type { Tx } from "../db/client";
import { getDb } from "../db/client";
import { makeSku } from "../db/seed";
import type { OrderStatus } from "../db/schema";
import { mediaOverrides, productColors, productMedia, products, productWorlds, variants } from "../db/schema";
import { UploadRejectedError, firstPosition, getAllMediaFor, isGeneratedFor, processUpload } from "../media";
import { setOrderStatus as changeStatus } from "../orders";
import { getStorage } from "../storage/provider";

const errors = copy.admin.errors;

const fail = (code: ActionFailure["code"], message: string, extra?: Record<string, string>): ActionFailure => ({
  ok: false,
  code,
  message,
  ...(extra ? { fieldErrors: extra } : {}),
});

function invalid(error: z.ZodError): ActionFailure {
  return fail("validation", errors.validation, fieldErrors(error));
}

/**
 * Every action below runs through this wrapper. The session check happens before anything
 * else, on the server, and expected refusals turn into results rather than thrown errors.
 */
async function guarded<T>(work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await requireAdmin();
    const result = await work();
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("unauthorized", errors.unauthorized);
    if (isUniqueViolation(error, "products_handle_key")) return fail("conflict", errors.handleTaken, { handle: errors.handleTaken });
    console.error("Admin action failed", error);
    return fail("error", errors.generic);
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (let current = error; current && typeof current === "object"; current = (current as { cause?: unknown }).cause) {
    const { code, constraint: name, message } = current as { code?: string; constraint?: string; message?: string };
    if (code === "23505" && (name === constraint || message?.includes(constraint))) return true;
  }
  return false;
}

/** Adds and updates colours, and marks removed ones inactive. Past orders keep theirs. */
async function syncColors(tx: Tx, productId: string, list: readonly { slug: string; name: string; hex: string }[]) {
  const slugs = list.map((color) => color.slug);
  await tx
    .update(productColors)
    .set({ active: false })
    .where(and(eq(productColors.productId, productId), notInArray(productColors.slug, slugs)));
  for (const [position, color] of list.entries()) {
    await tx
      .insert(productColors)
      .values({ productId, ...color, position, active: true })
      .onConflictDoUpdate({
        target: [productColors.productId, productColors.slug],
        set: { name: color.name, hex: color.hex, position, active: true },
      });
  }
}

/** Creates any missing variant at zero stock. Existing stock is never touched here. */
async function syncVariants(tx: Tx, productId: string, productHandle: string, sizes: readonly string[]) {
  const colors = await tx.select().from(productColors).where(eq(productColors.productId, productId));
  const rows = colors.flatMap((color) =>
    sizes.map((size) => ({
      productId,
      colorId: color.id,
      size,
      stock: 0,
      sku: makeSku(productHandle, color.slug, size),
    })),
  );
  if (rows.length) await tx.insert(variants).values(rows).onConflictDoNothing();
}

/** Replaces world membership. A new member joins the end of each world's order. */
async function syncWorlds(tx: Tx, productId: string, worlds: readonly WorldSlug[]) {
  await tx.delete(productWorlds).where(eq(productWorlds.productId, productId));
  for (const world of worlds) {
    const [last] = await tx
      .select({ next: sql<number>`coalesce(max(${productWorlds.position}), -1)::int + 1` })
      .from(productWorlds)
      .where(eq(productWorlds.world, world));
    await tx.insert(productWorlds).values({ productId, world, position: last?.next ?? 0 });
  }
}

/* Products */

export async function createProduct(input: CreateProductInput): Promise<ActionResult<{ id: string; handle: string }>> {
  return guarded(async () => {
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { colors, worlds, ...fields } = parsed.data;

    const db = await getDb();
    return db.transaction(async (tx) => {
      const [order] = await tx.select({ next: sql<number>`coalesce(max(${products.sortOrder}), -1)::int + 1` }).from(products);
      const [row] = await tx
        .insert(products)
        .values({ ...fields, sortOrder: order?.next ?? 0 })
        .returning({ id: products.id, handle: products.handle });
      if (!row) return fail("error", errors.generic);

      await syncColors(tx, row.id, colors);
      await syncVariants(tx, row.id, row.handle, fields.sizes);
      await syncWorlds(tx, row.id, worlds);
      return { ok: true, data: row };
    });
  });
}

/** Updates only the fields sent. The handle is fixed, because links and media use it. */
export async function updateProduct(input: UpdateProductInput): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, colors, worlds, ...fields } = parsed.data;

    const db = await getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning({ id: products.id, handle: products.handle, sizes: products.sizes });
      if (!row) return fail("not_found", errors.notFound);

      if (colors) await syncColors(tx, id, colors);
      if (colors || fields.sizes) await syncVariants(tx, id, row.handle, row.sizes);
      if (worlds) await syncWorlds(tx, id, worlds);
      return { ok: true, data: { id } };
    });
  });
}

export async function setProductPublished(input: { id: string; published: boolean }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = setPublishedSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [row] = await db
      .update(products)
      .set({ published: parsed.data.published, updatedAt: new Date() })
      .where(eq(products.id, parsed.data.id))
      .returning({ id: products.id });
    return row ? { ok: true, data: undefined } : fail("not_found", errors.notFound);
  });
}

/** `ids` is the full new order. Products left out keep their old position value. */
export async function reorderProducts(input: { ids: string[] }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = reorderProductsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of parsed.data.ids.entries()) {
        await tx.update(products).set({ sortOrder }).where(eq(products.id, id));
      }
    });
    return { ok: true, data: undefined };
  });
}

export async function setStock(input: { variantId: string; stock: number }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = setStockSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [row] = await db
      .update(variants)
      .set({ stock: parsed.data.stock })
      .where(eq(variants.id, parsed.data.variantId))
      .returning({ id: variants.id });
    return row ? { ok: true, data: undefined } : fail("not_found", errors.notFound);
  });
}

/* Media */

async function ownerOf(productId: string, colorId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ productHandle: products.handle, colorSlug: productColors.slug })
    .from(productColors)
    .innerJoin(products, eq(products.id, productColors.productId))
    .where(and(eq(productColors.id, colorId), eq(productColors.productId, productId)))
    .limit(1);
  return row ?? null;
}

/**
 * FormData fields: `file`, `productId`, `colorId`, `alt`, and optional `focalX` and `focalY`
 * (0 to 1, default 0.5). The new image goes first, so it replaces the demo flat straight away.
 */
export async function uploadMedia(formData: FormData): Promise<ActionResult<{ id: string; url: string }>> {
  return guarded(async () => {
    const parsed = uploadMediaSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return invalid(parsed.error);
    const { productId, colorId, focalX, focalY, alt } = parsed.data;

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("validation", errors.fileRequired, { file: errors.fileRequired });
    if (file.size > MAX_UPLOAD_BYTES) return fail("validation", errors.fileTooLarge, { file: errors.fileTooLarge });

    const owner = await ownerOf(productId, colorId);
    if (!owner) return fail("not_found", errors.notFound);

    let processed;
    try {
      processed = await processUpload(Buffer.from(await file.arrayBuffer()), focalX, focalY);
    } catch (error) {
      if (error instanceof UploadRejectedError) {
        const message = error.reason === "too_small" ? errors.fileTooSmall : errors.fileNotImage;
        return fail("validation", message, { file: message });
      }
      throw error;
    }

    const storage = getStorage();
    const written: string[] = [];
    try {
      const srcSet = [];
      for (const image of processed.images) {
        const { url } = await storage.put(image.name, image.bytes, "image/webp");
        written.push(url);
        srcSet.push({ url, width: image.width });
      }
      const largest = processed.images.at(-1);
      const url = written.at(-1);
      if (!largest || !url) return fail("error", errors.generic);

      const db = await getDb();
      const current = await getAllMediaFor({ handle: owner.productHandle }, { id: colorId, slug: owner.colorSlug }, db);
      const [row] = await db
        .insert(productMedia)
        .values({
          productId,
          colorId,
          role: "photo",
          url,
          width: largest.width,
          height: largest.height,
          srcSet,
          blur: processed.blur,
          dominant: processed.dominant,
          alt,
          position: firstPosition(current),
        })
        .returning({ id: productMedia.id });
      if (!row) throw new Error("Upload row was not created");
      return { ok: true, data: { id: row.id, url } };
    } catch (error) {
      await Promise.all(written.map((url) => storage.remove(url).catch(() => undefined)));
      throw error;
    }
  });
}

/** Hides or shows an upload or a generated image. */
export async function hideMedia(input: { colorId: string; mediaId: string; hidden: boolean }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = hideMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { colorId, mediaId, hidden } = parsed.data;
    const db = await getDb();

    if (z.uuid().safeParse(mediaId).success) {
      const [row] = await db
        .update(productMedia)
        .set({ hidden })
        .where(and(eq(productMedia.id, mediaId), eq(productMedia.colorId, colorId)))
        .returning({ id: productMedia.id });
      return row ? { ok: true, data: undefined } : fail("not_found", errors.notFound);
    }

    const [color] = await db
      .select({ productHandle: products.handle, colorSlug: productColors.slug })
      .from(productColors)
      .innerJoin(products, eq(products.id, productColors.productId))
      .where(eq(productColors.id, colorId))
      .limit(1);
    if (!color || !isGeneratedFor(mediaId, color.productHandle, color.colorSlug)) return fail("not_found", errors.notFound);

    await db
      .insert(mediaOverrides)
      .values({ mediaKey: mediaId, colorId, hidden })
      .onConflictDoUpdate({ target: mediaOverrides.mediaKey, set: { hidden } });
    return { ok: true, data: undefined };
  });
}

/** `orderedIds` holds upload ids and generated keys. The first one leads everywhere. */
export async function reorderMedia(input: { productId: string; colorId: string; orderedIds: string[] }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = reorderMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { productId, colorId, orderedIds } = parsed.data;

    const owner = await ownerOf(productId, colorId);
    if (!owner) return fail("not_found", errors.notFound);

    const db = await getDb();
    const current = await getAllMediaFor({ handle: owner.productHandle }, { id: colorId, slug: owner.colorSlug }, db);
    const known = new Map(current.map((item) => [item.id, item]));
    if (orderedIds.some((id) => !known.has(id))) return fail("not_found", errors.notFound);

    // Anything left out of the list follows the listed items in its current order.
    const rest = current.filter((item) => !orderedIds.includes(item.id)).map((item) => item.id);
    await db.transaction(async (tx) => {
      for (const [position, id] of [...orderedIds, ...rest].entries()) {
        if (known.get(id)?.source === "upload") {
          await tx.update(productMedia).set({ position }).where(eq(productMedia.id, id));
        } else {
          await tx
            .insert(mediaOverrides)
            .values({ mediaKey: id, colorId, position })
            .onConflictDoUpdate({ target: mediaOverrides.mediaKey, set: { position } });
        }
      }
    });
    return { ok: true, data: undefined };
  });
}

/** Hides every upload for the colour and clears hide and order on the generated files. */
export async function revertToGenerated(input: { productId: string; colorId: string }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = revertMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { productId, colorId } = parsed.data;

    const owner = await ownerOf(productId, colorId);
    if (!owner) return fail("not_found", errors.notFound);

    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.update(productMedia).set({ hidden: true }).where(eq(productMedia.colorId, colorId));
      await tx.delete(mediaOverrides).where(eq(mediaOverrides.colorId, colorId));
    });
    return { ok: true, data: undefined };
  });
}

/* Orders */

export async function updateOrderStatus(input: { orderId: string; status: OrderStatus }): Promise<ActionResult<{ status: OrderStatus }>> {
  return guarded(async () => {
    const parsed = setOrderStatusSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const result = await changeStatus(parsed.data.orderId, parsed.data.status);
    if (result.ok) return { ok: true, data: { status: result.status } };
    if (result.code === "not_found") return fail("not_found", errors.notFound);
    return fail("invalid_transition", errors.invalidStatus(result.from, result.to));
  });
}

/* Convenience for the stock screen: set many at once in one transaction. */

export async function setStockMany(input: { items: { variantId: string; stock: number }[] }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = z.object({ items: z.array(setStockSchema).min(1).max(500) }).safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const ids = parsed.data.items.map((item) => item.variantId);
    const found = await db.select({ id: variants.id }).from(variants).where(inArray(variants.id, ids));
    if (found.length !== new Set(ids).size) return fail("not_found", errors.notFound);
    await db.transaction(async (tx) => {
      for (const item of parsed.data.items) {
        await tx.update(variants).set({ stock: item.stock }).where(eq(variants.id, item.variantId));
      }
    });
    return { ok: true, data: undefined };
  });
}
