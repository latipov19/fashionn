import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import sharp from "sharp";
import aiJson from "@/content/media.ai.json";
import manifestJson from "@/content/media.generated.json";
import type { AiManifest, GeneratedManifest, GeneratedMediaEntry, MediaRecord, ModelEntry } from "@/content/types";
import type { Executor } from "./db/client";
import { getDb } from "./db/client";
import { mediaOverrides, productMedia } from "./db/schema";

const ai = aiJson as unknown as AiManifest;

/** AI packshots come first, so they lead over the drawn flats for the same colour. */
const manifest = {
  items: [...ai.items, ...(manifestJson as unknown as GeneratedManifest).items],
};

const models = new Map(ai.models.map((model) => [`${model.productHandle}/${model.colorSlug}`, model]));

/** The optimised GLB for a product colour, written by `npm run assets:import`. Null when there is none. */
export function modelFor(productHandle: string, colorSlug: string): ModelEntry | null {
  return models.get(`${productHandle}/${colorSlug}`) ?? null;
}

/** Generated items sort after this unless reordered, so a new upload lands first. */
const GENERATED_BASE_POSITION = 1000;

export const OUTPUT_WIDTHS = [480, 960, 1600] as const;
const ASPECT = 4 / 5;
const MIN_CROP_WIDTH = OUTPUT_WIDTHS[0];
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff", "heif"]);

export type MediaOwner = { productHandle: string; colorSlug: string; colorId: string };

type UploadRow = typeof productMedia.$inferSelect;
type OverrideRow = typeof mediaOverrides.$inferSelect;

function generatedFor(productHandle: string, colorSlug: string, entries = manifest.items): GeneratedMediaEntry[] {
  return entries.filter((item) => item.productHandle === productHandle && item.colorSlug === colorSlug);
}

/** Merges the manifest with uploads, applying hide and order. Hidden items are kept, flagged. */
export function mergeMedia(
  generated: readonly GeneratedMediaEntry[],
  uploads: readonly UploadRow[],
  overrides: readonly Pick<OverrideRow, "mediaKey" | "hidden" | "position">[],
): MediaRecord[] {
  const overrideByKey = new Map(overrides.map((override) => [override.mediaKey, override]));

  const fromManifest: MediaRecord[] = generated.map((item, index) => {
    const override = overrideByKey.get(item.id);
    return {
      id: item.id,
      role: item.role,
      source: "generated",
      url: item.url,
      width: item.width,
      height: item.height,
      srcSet: item.srcSet,
      blur: item.blur,
      dominant: item.dominant ?? null,
      alt: item.alt,
      position: override?.position ?? GENERATED_BASE_POSITION + index,
      hidden: override?.hidden ?? false,
    };
  });

  const fromUploads: MediaRecord[] = uploads.map((row) => ({
    id: row.id,
    role: row.role,
    source: "upload",
    url: row.url,
    width: row.width,
    height: row.height,
    srcSet: row.srcSet,
    blur: row.blur,
    dominant: row.dominant,
    alt: row.alt,
    position: row.position,
    hidden: row.hidden,
  }));

  return [...fromManifest, ...fromUploads].sort((a, b) => a.position - b.position);
}

/** Loads media for many productColors with two queries. The catalog uses this to avoid N+1. */
export async function loadMediaForOwners(owners: readonly MediaOwner[], db?: Executor): Promise<Map<string, MediaRecord[]>> {
  const result = new Map<string, MediaRecord[]>();
  if (owners.length === 0) return result;
  const conn = db ?? (await getDb());
  const ids = owners.map((owner) => owner.colorId);
  const [uploads, overrides] = await Promise.all([
    conn.select().from(productMedia).where(inArray(productMedia.colorId, ids)),
    conn.select().from(mediaOverrides).where(inArray(mediaOverrides.colorId, ids)),
  ]);
  for (const owner of owners) {
    result.set(
      owner.colorId,
      mergeMedia(
        generatedFor(owner.productHandle, owner.colorSlug),
        uploads.filter((row) => row.colorId === owner.colorId),
        overrides.filter((row) => row.colorId === owner.colorId),
      ),
    );
  }
  return result;
}

/** All media for a color, hidden items included. For the admin media screen. */
export async function getAllMediaFor(
  product: { handle: string },
  color: { id: string; slug: string },
  db?: Executor,
): Promise<MediaRecord[]> {
  const owner = { productHandle: product.handle, colorSlug: color.slug, colorId: color.id };
  return (await loadMediaForOwners([owner], db)).get(color.id) ?? [];
}

/** Visible media for a color, in order. The first item wins everywhere. */
export async function getMediaFor(product: { handle: string }, color: { id: string; slug: string }): Promise<MediaRecord[]> {
  return (await getAllMediaFor(product, color)).filter((item) => !item.hidden);
}

export const visibleMedia = (media: readonly MediaRecord[]) => media.filter((item) => !item.hidden);

/** The lead image for cards and galleries. Detail crops never lead. */
export function primaryMedia(media: readonly MediaRecord[]): MediaRecord | null {
  return visibleMedia(media).find((item) => item.role !== "detail") ?? null;
}

/** True when the lead image is a generated sample, so the page must say it is not a photo. */
export function leadsWithGeneratedImage(media: readonly MediaRecord[]): boolean {
  return primaryMedia(media)?.source === "generated";
}

/* Upload processing */

export class UploadRejectedError extends Error {
  constructor(readonly reason: "not_image" | "too_small") {
    super(reason);
    this.name = "UploadRejectedError";
  }
}

export type ProcessedImage = {
  name: string;
  width: number;
  height: number;
  bytes: Buffer;
};

export type ProcessedUpload = {
  images: ProcessedImage[];
  blur: string;
  dominant: string;
};

/** Largest 4:5 rectangle centred on the focal point, pushed back inside the image. */
export function focalCrop(width: number, height: number, focalX: number, focalY: number) {
  const cropWidth = Math.floor(Math.min(width, height * ASPECT));
  const cropHeight = Math.floor(cropWidth / ASPECT);
  const clamp = (value: number, max: number) => Math.round(Math.min(max, Math.max(0, value)));
  return {
    left: clamp(width * focalX - cropWidth / 2, width - cropWidth),
    top: clamp(height * focalY - cropHeight / 2, height - cropHeight),
    width: cropWidth,
    height: cropHeight,
  };
}

/**
 * Decodes with sharp, crops to 4:5 and writes the three widths as WebP. Nothing the client
 * sent survives: output is re-encoded, metadata is stripped and names are generated here.
 */
export async function processUpload(input: Buffer, focalX: number, focalY: number): Promise<ProcessedUpload> {
  const options = { failOn: "error", limitInputPixels: 100_000_000 } as const;
  const decoded = await (async () => {
    const metadata = await sharp(input, options).metadata();
    if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) throw new UploadRejectedError("not_image");
    // Apply EXIF rotation first, so the focal point matches what the owner saw.
    return sharp(input, options).rotate().png({ compressionLevel: 1 }).toBuffer({ resolveWithObject: true });
  })().catch((error: unknown) => {
    throw error instanceof UploadRejectedError ? error : new UploadRejectedError("not_image");
  });
  const oriented = decoded.data;

  const crop = focalCrop(decoded.info.width, decoded.info.height, focalX, focalY);
  if (crop.width < MIN_CROP_WIDTH) throw new UploadRejectedError("too_small");

  const stem = randomUUID();
  const cropped = () => sharp(oriented, options).extract(crop);
  const images = await Promise.all(
    OUTPUT_WIDTHS.map(async (width) => {
      const height = Math.round(width / ASPECT);
      const bytes = await cropped()
        .resize(width, height, { fit: "fill" })
        .webp({ quality: 85, effort: 4, smartSubsample: true })
        .toBuffer();
      return { name: `${stem}-${width}.webp`, width, height, bytes };
    }),
  );

  const blurBytes = await cropped().resize(16, 20, { fit: "fill" }).webp({ quality: 40 }).toBuffer();
  const { dominant } = await sharp(oriented, options).extract(crop).stats();
  const hex = (value: number) => value.toString(16).padStart(2, "0");

  return {
    images,
    blur: `data:image/webp;base64,${blurBytes.toString("base64")}`,
    dominant: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
  };
}

/** Position that puts a new upload ahead of everything currently in the color. */
export function firstPosition(media: readonly MediaRecord[]): number {
  return media.reduce((min, item) => Math.min(min, item.position), GENERATED_BASE_POSITION) - 1;
}

/** True when a generated manifest key belongs to the color. */
export function isGeneratedFor(mediaId: string, productHandle: string, colorSlug: string): boolean {
  return generatedFor(productHandle, colorSlug).some((item) => item.id === mediaId);
}
