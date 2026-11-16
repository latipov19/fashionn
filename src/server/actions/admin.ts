"use server";

import { and, count, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { z } from "zod";
import { copy } from "@/content/copy";
import type { WorldSlug } from "@/content/types";
import type { ActionResult } from "@/lib/action-result";
import type { CreateProductInput, StockReason, UpdateProductInput } from "@/lib/validation";
import {
  adjustStockSchema,
  bulkProductsSchema,
  createProductSchema,
  deleteProductSchema,
  hideMediaSchema,
  MAX_UPLOAD_BYTES,
  productIdSchema,
  reorderMediaSchema,
  reorderProductsSchema,
  revertMediaSchema,
  setOrderStatusSchema,
  setPublishedSchema,
  setStockSchema,
  updateProductSchema,
  uploadMediaSchema,
} from "@/lib/validation";
import { recordActivity } from "../admin/activity";
import { fail, guarded, invalid } from "../admin/guard";
import type { AdminSession } from "../auth";
import type { Tx } from "../db/client";
import { getDb } from "../db/client";
import { makeSku } from "../db/seed";
import type { OrderStatus } from "../db/schema";
import { inventoryAdjustments, mediaOverrides, orderItems, orders, productColors, productMedia, products, productWorlds, variants } from "../db/schema";
import { UploadRejectedError, firstPosition, getAllMediaFor, isGeneratedFor, processUpload } from "../media";
import { setOrderStatus as changeStatus } from "../orders";
import { getStorage } from "../storage/provider";

const errors = copy.admin.errors;

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
  return guarded("catalog", async (session) => {
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
      await recordActivity(tx, session, { action: "product.created", targetType: "product", targetId: row.id, targetLabel: fields.name, meta: { handle: row.handle } });
      return { ok: true, data: row };
    });
  });
}

/** Updates only the fields sent. The handle is fixed, because links and media use it. */
export async function updateProduct(input: UpdateProductInput): Promise<ActionResult<{ id: string }>> {
  return guarded("catalog", async (session) => {
    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, colors, worlds, ...fields } = parsed.data;

    const db = await getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({ ...fields, ...(fields.published ? { archivedAt: null } : {}), updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning({ id: products.id, handle: products.handle, name: products.name, sizes: products.sizes });
      if (!row) return fail("not_found", errors.notFound);

      if (colors) await syncColors(tx, id, colors);
      if (colors || fields.sizes) await syncVariants(tx, id, row.handle, row.sizes);
      if (worlds) await syncWorlds(tx, id, worlds);
      const changed = [...Object.keys(fields), ...(colors ? ["colors"] : []), ...(worlds ? ["worlds"] : [])];
      await recordActivity(tx, session, { action: "product.updated", targetType: "product", targetId: id, targetLabel: row.name, meta: { fields: changed.join(", ") } });
      return { ok: true, data: { id } };
    });
  });
}

/** Publishing also brings an archived product back. */
export async function setProductPublished(input: { id: string; published: boolean }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
    const parsed = setPublishedSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, published } = parsed.data;
    const db = await getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({ published, ...(published ? { archivedAt: null } : {}), updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning({ id: products.id, name: products.name });
      if (!row) return fail("not_found", errors.notFound);
      await recordActivity(tx, session, { action: published ? "product.published" : "product.unpublished", targetType: "product", targetId: id, targetLabel: row.name });
      return { ok: true, data: undefined };
    });
  });
}

/** Publish, unpublish or archive up to 100 products in one transaction. */
export async function bulkProducts(input: { ids: string[]; op: "publish" | "unpublish" | "archive" }): Promise<ActionResult<{ count: number }>> {
  return guarded("catalog", async (session) => {
    const parsed = bulkProductsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { ids, op } = parsed.data;
    const db = await getDb();
    return db.transaction(async (tx) => {
      const now = new Date();
      const set =
        op === "publish" ? { published: true, archivedAt: null, updatedAt: now } : op === "unpublish" ? { published: false, updatedAt: now } : { published: false, archivedAt: now, updatedAt: now };
      const where = op === "archive" ? and(inArray(products.id, ids), isNull(products.archivedAt)) : inArray(products.id, ids);
      const rows = await tx.update(products).set(set).where(where).returning({ id: products.id, name: products.name });
      const action = op === "publish" ? "product.published" : op === "unpublish" ? "product.unpublished" : "product.archived";
      for (const row of rows) await recordActivity(tx, session, { action, targetType: "product", targetId: row.id, targetLabel: row.name, meta: { bulk: true } });
      return { ok: true, data: { count: rows.length } };
    });
  });
}

/** Off the shop and out of the working lists. Orders and history stay. */
export async function archiveProduct(input: { id: string }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
    const parsed = productIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .update(products)
        .set({ published: false, archivedAt: now, updatedAt: now })
        .where(eq(products.id, parsed.data.id))
        .returning({ id: products.id, name: products.name });
      if (!row) return fail("not_found", errors.notFound);
      await recordActivity(tx, session, { action: "product.archived", targetType: "product", targetId: row.id, targetLabel: row.name });
      return { ok: true, data: undefined };
    });
  });
}

/** Back from the archive as a draft. Publishing is a separate, deliberate step. */
export async function restoreProduct(input: { id: string }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
    const parsed = productIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(eq(products.id, parsed.data.id))
        .returning({ id: products.id, name: products.name });
      if (!row) return fail("not_found", errors.notFound);
      await recordActivity(tx, session, { action: "product.restored", targetType: "product", targetId: row.id, targetLabel: row.name });
      return { ok: true, data: undefined };
    });
  });
}

function isForeignKeyViolation(error: unknown): boolean {
  for (let current = error; current && typeof current === "object"; current = (current as { cause?: unknown }).cause) {
    if ((current as { code?: string }).code === "23503") return true;
  }
  return false;
}

/**
 * Deletes a product that was never ordered, after the owner types its handle. Ordered products
 * can only be archived: order lines point at their variants. Uploaded files go after the rows.
 */
export async function deleteProduct(input: { id: string; confirm: string }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
    const parsed = deleteProductSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [product] = await db.select({ id: products.id, handle: products.handle, name: products.name }).from(products).where(eq(products.id, parsed.data.id)).limit(1);
    if (!product) return fail("not_found", errors.notFound);
    if (parsed.data.confirm.trim() !== product.handle) return fail("validation", errors.confirmMismatch, { confirm: errors.confirmMismatch });

    const [ordered] = await db
      .select({ value: count() })
      .from(orderItems)
      .innerJoin(variants, eq(variants.id, orderItems.variantId))
      .where(eq(variants.productId, product.id));
    if ((ordered?.value ?? 0) > 0) return fail("conflict", errors.hasOrders);

    const uploads = await db.select({ srcSet: productMedia.srcSet }).from(productMedia).where(eq(productMedia.productId, product.id));
    try {
      await db.transaction(async (tx) => {
        await tx.delete(products).where(eq(products.id, product.id));
        await recordActivity(tx, session, { action: "product.deleted", targetType: "product", targetId: product.id, targetLabel: product.name, meta: { handle: product.handle } });
      });
    } catch (error) {
      // An order placed between the check and the delete still holds its variant.
      if (isForeignKeyViolation(error)) return fail("conflict", errors.hasOrders);
      throw error;
    }

    const storage = getStorage();
    await Promise.all(uploads.flatMap((row) => row.srcSet.map((source) => storage.remove(source.url).catch(() => undefined))));
    return { ok: true, data: undefined };
  });
}

/** `ids` is the full new order. Products left out keep their old position value. */
export async function reorderProducts(input: { ids: string[] }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
    const parsed = reorderProductsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of parsed.data.ids.entries()) {
        await tx.update(products).set({ sortOrder }).where(eq(products.id, id));
      }
      await recordActivity(tx, session, { action: "products.reordered", targetType: "product", meta: { count: parsed.data.ids.length } });
    });
    return { ok: true, data: undefined };
  });
}

/* Stock. Every change goes through here, with its reason, in one transaction. */

type StockChange = { variantId: string; stock: number; reason: StockReason; note?: string | null };

/** Locks the variant row, writes the new count and the history entry. Returns false when it does not exist. */
async function writeStock(tx: Tx, session: AdminSession, change: StockChange): Promise<"missing" | "unchanged" | "changed"> {
  const [current] = await tx
    .select({
      id: variants.id,
      stock: variants.stock,
      sku: variants.sku,
      size: variants.size,
      productName: products.name,
      colorName: productColors.name,
    })
    .from(variants)
    .innerJoin(products, eq(products.id, variants.productId))
    .innerJoin(productColors, eq(productColors.id, variants.colorId))
    .where(eq(variants.id, change.variantId))
    .for("update", { of: variants })
    .limit(1);
  if (!current) return "missing";
  if (current.stock === change.stock) return "unchanged";

  await tx.update(variants).set({ stock: change.stock }).where(eq(variants.id, current.id));
  await tx.insert(inventoryAdjustments).values({
    variantId: current.id,
    productName: current.productName,
    colorName: current.colorName,
    size: current.size,
    sku: current.sku,
    previousStock: current.stock,
    newStock: change.stock,
    reason: change.reason,
    note: change.note ?? null,
    actorId: session.adminUserId,
    actorEmail: session.email,
  });
  await recordActivity(tx, session, {
    action: "stock.adjusted",
    targetType: "variant",
    targetId: current.id,
    targetLabel: `${current.productName} · ${current.colorName} · ${current.size}`,
    meta: { from: current.stock, to: change.stock, reason: change.reason },
  });
  return "changed";
}

/** Sets one variant's stock with a reason and an optional note. */
export async function adjustStock(input: { variantId: string; stock: number; reason: StockReason; note?: string }): Promise<ActionResult<{ changed: boolean }>> {
  return guarded("inventory", async (session) => {
    const parsed = adjustStockSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const outcome = await writeStock(tx, session, parsed.data);
      if (outcome === "missing") return fail("not_found", errors.notFound);
      return { ok: true, data: { changed: outcome === "changed" } };
    });
  });
}

export async function setStock(input: { variantId: string; stock: number }): Promise<ActionResult> {
  return guarded("inventory", async (session) => {
    const parsed = setStockSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const outcome = await writeStock(tx, session, { ...parsed.data, reason: "manual" });
      return outcome === "missing" ? fail("not_found", errors.notFound) : { ok: true, data: undefined };
    });
  });
}

/* Convenience for the stock screen: set many at once in one transaction. */

export async function setStockMany(input: { items: { variantId: string; stock: number }[] }): Promise<ActionResult> {
  return guarded("inventory", async (session) => {
    const parsed = z.object({ items: z.array(setStockSchema).min(1).max(500) }).safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const ids = parsed.data.items.map((item) => item.variantId);
    const found = await db.select({ id: variants.id }).from(variants).where(inArray(variants.id, ids));
    if (found.length !== new Set(ids).size) return fail("not_found", errors.notFound);
    await db.transaction(async (tx) => {
      for (const item of parsed.data.items) await writeStock(tx, session, { ...item, reason: "manual" });
    });
    return { ok: true, data: undefined };
  });
}

/* Media */

async function ownerOf(productId: string, colorId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ productHandle: products.handle, productName: products.name, colorSlug: productColors.slug, colorName: productColors.name })
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
  return guarded("catalog", async (session) => {
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
      const srcSet: { url: string; width: number }[] = [];
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
      const row = await db.transaction(async (tx) => {
        const [inserted] = await tx
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
        if (!inserted) throw new Error("Upload row was not created");
        await recordActivity(tx, session, { action: "media.uploaded", targetType: "media", targetId: productId, targetLabel: `${owner.productName} · ${owner.colorName}` });
        return inserted;
      });
      return { ok: true, data: { id: row.id, url } };
    } catch (error) {
      await Promise.all(written.map((url) => storage.remove(url).catch(() => undefined)));
      throw error;
    }
  });
}

/** Hides or shows an upload or a generated image. */
export async function hideMedia(input: { colorId: string; mediaId: string; hidden: boolean }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
    const parsed = hideMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { colorId, mediaId, hidden } = parsed.data;
    const db = await getDb();

    const [color] = await db
      .select({ productId: products.id, productHandle: products.handle, productName: products.name, colorSlug: productColors.slug, colorName: productColors.name })
      .from(productColors)
      .innerJoin(products, eq(products.id, productColors.productId))
      .where(eq(productColors.id, colorId))
      .limit(1);
    if (!color) return fail("not_found", errors.notFound);
    const entry = { action: hidden ? "media.hidden" : "media.shown", targetType: "media" as const, targetId: color.productId, targetLabel: `${color.productName} · ${color.colorName}` };

    if (z.uuid().safeParse(mediaId).success) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(productMedia)
          .set({ hidden })
          .where(and(eq(productMedia.id, mediaId), eq(productMedia.colorId, colorId)))
          .returning({ id: productMedia.id });
        if (!row) return fail("not_found", errors.notFound);
        await recordActivity(tx, session, entry);
        return { ok: true, data: undefined };
      });
    }

    if (!isGeneratedFor(mediaId, color.productHandle, color.colorSlug)) return fail("not_found", errors.notFound);
    await db.transaction(async (tx) => {
      await tx
        .insert(mediaOverrides)
        .values({ mediaKey: mediaId, colorId, hidden })
        .onConflictDoUpdate({ target: mediaOverrides.mediaKey, set: { hidden } });
      await recordActivity(tx, session, entry);
    });
    return { ok: true, data: undefined };
  });
}

/** `orderedIds` holds upload ids and generated keys. The first one leads everywhere. */
export async function reorderMedia(input: { productId: string; colorId: string; orderedIds: string[] }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
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
      await recordActivity(tx, session, { action: "media.reordered", targetType: "media", targetId: productId, targetLabel: `${owner.productName} · ${owner.colorName}` });
    });
    return { ok: true, data: undefined };
  });
}

/** Hides every upload for the colour and clears hide and order on the generated files. */
export async function revertToGenerated(input: { productId: string; colorId: string }): Promise<ActionResult> {
  return guarded("catalog", async (session) => {
    const parsed = revertMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { productId, colorId } = parsed.data;

    const owner = await ownerOf(productId, colorId);
    if (!owner) return fail("not_found", errors.notFound);

    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.update(productMedia).set({ hidden: true }).where(eq(productMedia.colorId, colorId));
      await tx.delete(mediaOverrides).where(eq(mediaOverrides.colorId, colorId));
      await recordActivity(tx, session, { action: "media.reverted", targetType: "media", targetId: productId, targetLabel: `${owner.productName} · ${owner.colorName}` });
    });
    return { ok: true, data: undefined };
  });
}

/* Orders */

export async function updateOrderStatus(input: { orderId: string; status: OrderStatus }): Promise<ActionResult<{ status: OrderStatus }>> {
  return guarded("orders", async (session) => {
    const parsed = setOrderStatusSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const result = await changeStatus(parsed.data.orderId, parsed.data.status);
    if (result.ok) {
      const db = await getDb();
      const [order] = await db.select({ seq: orders.seq }).from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
      await recordActivity(db, session, {
        action: "order.status",
        targetType: "order",
        targetId: parsed.data.orderId,
        targetLabel: order ? `VV-${String(order.seq).padStart(6, "0")}` : null,
        meta: { to: result.status },
      });
      return { ok: true, data: { status: result.status } };
    }
    if (result.code === "not_found") return fail("not_found", errors.notFound);
    // The owner reads the store's own status names, never the internal codes.
    return fail("invalid_transition", errors.invalidStatus(copy.order.status[result.from], copy.order.status[result.to]));
  });
}
