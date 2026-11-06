"use server";

import { randomInt } from "node:crypto";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { copy } from "@/content/copy";
import { roomMeta } from "@/content/rooms";
import type { Room } from "@/content/types";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { separation } from "@/lib/colour";
import type { CreatePieceInput, UpdatePieceInput } from "@/lib/validation";
import {
  createPieceSchema,
  fieldErrors,
  hideMediaSchema,
  MAX_UPLOAD_BYTES,
  reorderMediaSchema,
  reorderPiecesSchema,
  revertMediaSchema,
  setOrderStatusSchema,
  setPublishedSchema,
  setStockSchema,
  updatePieceSchema,
  uploadMediaSchema,
} from "@/lib/validation";
import { UnauthorizedError, requireAdmin } from "../auth";
import type { Tx } from "../db/client";
import { getDb } from "../db/client";
import { makeSku } from "../db/seed";
import type { OrderStatus } from "../db/schema";
import { cloths, colourways, mediaOverrides, pieces, productMedia, variants } from "../db/schema";
import {
  UploadRejectedError,
  firstPosition,
  getAllMediaFor,
  isGeneratedFor,
  processUpload,
} from "../media";
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
    if (isUniqueViolation(error, "pieces_slug_key")) return fail("conflict", errors.slugTaken, { slug: errors.slugTaken });
    if (isUniqueViolation(error, "pieces_peg_key")) return fail("conflict", errors.pegTaken, { peg: errors.pegTaken });
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

function separationWarnings(room: Room, list: readonly { name: string; hex: string }[]): string[] {
  return list.flatMap((colour) =>
    separation(colour.hex, roomMeta[room].pigment).passes
      ? []
      : [`${colour.name} is too close to the ${roomMeta[room].ground} wall and may disappear in a render.`],
  );
}

async function clothExists(tx: Tx, clothId: string) {
  const [row] = await tx.select({ id: cloths.id }).from(cloths).where(eq(cloths.id, clothId)).limit(1);
  return Boolean(row);
}

/** Adds and updates colourways, and marks removed ones inactive. Past orders keep theirs. */
async function syncColourways(
  tx: Tx,
  pieceId: string,
  list: readonly { slug: string; name: string; hex: string; lining: string }[],
) {
  const slugs = list.map((colour) => colour.slug);
  await tx
    .update(colourways)
    .set({ active: false })
    .where(and(eq(colourways.pieceId, pieceId), notInArray(colourways.slug, slugs)));
  for (const [position, colour] of list.entries()) {
    await tx
      .insert(colourways)
      .values({ pieceId, ...colour, position, active: true })
      .onConflictDoUpdate({
        target: [colourways.pieceId, colourways.slug],
        set: { name: colour.name, hex: colour.hex, lining: colour.lining, position, active: true },
      });
  }
}

/** Creates any missing variant at zero stock. Existing stock is never touched here. */
async function syncVariants(tx: Tx, pieceId: string, pieceSlug: string, sizes: readonly string[]) {
  const colours = await tx.select().from(colourways).where(eq(colourways.pieceId, pieceId));
  const rows = colours.flatMap((colour) =>
    sizes.map((size) => ({
      pieceId,
      colourwayId: colour.id,
      size,
      stock: 0,
      sku: makeSku(pieceSlug, colour.slug, size),
    })),
  );
  if (rows.length) await tx.insert(variants).values(rows).onConflictDoNothing();
}

/* Pieces */

export async function createPiece(input: CreatePieceInput): Promise<ActionResult<{ id: string; slug: string; warnings: string[] }>> {
  return guarded(async () => {
    const parsed = createPieceSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { colourways: colours, seed, ...fields } = parsed.data;

    const db = await getDb();
    return db.transaction(async (tx) => {
      if (!(await clothExists(tx, fields.clothId))) return fail("validation", errors.validation, { clothId: copy.forms.invalidChoice });

      const [order] = await tx.select({ next: sql<number>`coalesce(max(${pieces.sortOrder}), -1)::int + 1` }).from(pieces);
      const [row] = await tx
        .insert(pieces)
        .values({ ...fields, seed: seed ?? randomInt(1, 2_147_483_647), sortOrder: order?.next ?? 0 })
        .returning({ id: pieces.id, slug: pieces.slug });
      if (!row) return fail("error", errors.generic);

      await syncColourways(tx, row.id, colours);
      await syncVariants(tx, row.id, row.slug, fields.sizes);
      return { ok: true, data: { ...row, warnings: separationWarnings(fields.room, colours) } };
    });
  });
}

/** Updates only the fields sent. The slug is fixed, because generated media is keyed by it. */
export async function updatePiece(input: UpdatePieceInput): Promise<ActionResult<{ id: string; warnings: string[] }>> {
  return guarded(async () => {
    const parsed = updatePieceSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, colourways: colours, ...fields } = parsed.data;

    const db = await getDb();
    return db.transaction(async (tx) => {
      if (fields.clothId && !(await clothExists(tx, fields.clothId))) {
        return fail("validation", errors.validation, { clothId: copy.forms.invalidChoice });
      }
      const [row] = await tx
        .update(pieces)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(pieces.id, id))
        .returning({ id: pieces.id, slug: pieces.slug, room: pieces.room, sizes: pieces.sizes });
      if (!row) return fail("not_found", errors.notFound);

      if (colours) await syncColourways(tx, id, colours);
      if (colours || fields.sizes) await syncVariants(tx, id, row.slug, row.sizes);
      return { ok: true, data: { id, warnings: colours ? separationWarnings(row.room, colours) : [] } };
    });
  });
}

export async function setPiecePublished(input: { id: string; published: boolean }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = setPublishedSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [row] = await db
      .update(pieces)
      .set({ published: parsed.data.published, updatedAt: new Date() })
      .where(eq(pieces.id, parsed.data.id))
      .returning({ id: pieces.id });
    return row ? { ok: true, data: undefined } : fail("not_found", errors.notFound);
  });
}

/** `ids` is the full new order. Pieces left out keep their old position value. */
export async function reorderPieces(input: { ids: string[] }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = reorderPiecesSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const [sortOrder, id] of parsed.data.ids.entries()) {
        await tx.update(pieces).set({ sortOrder }).where(eq(pieces.id, id));
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

async function ownerOf(pieceId: string, colourwayId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ pieceSlug: pieces.slug, colourwaySlug: colourways.slug })
    .from(colourways)
    .innerJoin(pieces, eq(pieces.id, colourways.pieceId))
    .where(and(eq(colourways.id, colourwayId), eq(colourways.pieceId, pieceId)))
    .limit(1);
  return row ?? null;
}

/**
 * FormData fields: `file`, `pieceId`, `colourwayId`, `alt`, and optional `focalX`, `focalY`
 * (0 to 1, default 0.5) and `hour`. The new image goes first, so it replaces the render on
 * the rail straight away.
 */
export async function uploadMedia(formData: FormData): Promise<ActionResult<{ id: string; url: string }>> {
  return guarded(async () => {
    const parsed = uploadMediaSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return invalid(parsed.error);
    const { pieceId, colourwayId, focalX, focalY, alt, hour } = parsed.data;

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("validation", errors.fileRequired, { file: errors.fileRequired });
    if (file.size > MAX_UPLOAD_BYTES) return fail("validation", errors.fileTooLarge, { file: errors.fileTooLarge });

    const owner = await ownerOf(pieceId, colourwayId);
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
      const current = await getAllMediaFor({ slug: owner.pieceSlug }, { id: colourwayId, slug: owner.colourwaySlug }, db);
      const [row] = await db
        .insert(productMedia)
        .values({
          pieceId,
          colourwayId,
          role: "photo",
          hour: hour ?? null,
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
export async function hideMedia(input: { colourwayId: string; mediaId: string; hidden: boolean }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = hideMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { colourwayId, mediaId, hidden } = parsed.data;
    const db = await getDb();

    if (z.uuid().safeParse(mediaId).success) {
      const [row] = await db
        .update(productMedia)
        .set({ hidden })
        .where(and(eq(productMedia.id, mediaId), eq(productMedia.colourwayId, colourwayId)))
        .returning({ id: productMedia.id });
      return row ? { ok: true, data: undefined } : fail("not_found", errors.notFound);
    }

    const [colour] = await db
      .select({ pieceSlug: pieces.slug, colourwaySlug: colourways.slug })
      .from(colourways)
      .innerJoin(pieces, eq(pieces.id, colourways.pieceId))
      .where(eq(colourways.id, colourwayId))
      .limit(1);
    if (!colour || !isGeneratedFor(mediaId, colour.pieceSlug, colour.colourwaySlug)) return fail("not_found", errors.notFound);

    await db
      .insert(mediaOverrides)
      .values({ mediaKey: mediaId, colourwayId, hidden })
      .onConflictDoUpdate({ target: mediaOverrides.mediaKey, set: { hidden } });
    return { ok: true, data: undefined };
  });
}

/** `orderedIds` holds upload ids and generated keys. The first one leads everywhere. */
export async function reorderMedia(input: { pieceId: string; colourwayId: string; orderedIds: string[] }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = reorderMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { pieceId, colourwayId, orderedIds } = parsed.data;

    const owner = await ownerOf(pieceId, colourwayId);
    if (!owner) return fail("not_found", errors.notFound);

    const db = await getDb();
    const current = await getAllMediaFor({ slug: owner.pieceSlug }, { id: colourwayId, slug: owner.colourwaySlug }, db);
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
            .values({ mediaKey: id, colourwayId, position })
            .onConflictDoUpdate({ target: mediaOverrides.mediaKey, set: { position } });
        }
      }
    });
    return { ok: true, data: undefined };
  });
}

/** Hides every upload for the colourway and clears hide and order on the generated files. */
export async function revertToGenerated(input: { pieceId: string; colourwayId: string }): Promise<ActionResult> {
  return guarded(async () => {
    const parsed = revertMediaSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { pieceId, colourwayId } = parsed.data;

    const owner = await ownerOf(pieceId, colourwayId);
    if (!owner) return fail("not_found", errors.notFound);

    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.update(productMedia).set({ hidden: true }).where(eq(productMedia.colourwayId, colourwayId));
      await tx.delete(mediaOverrides).where(eq(mediaOverrides.colourwayId, colourwayId));
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
