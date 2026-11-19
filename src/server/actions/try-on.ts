"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { copy } from "@/content/copy";
import { tryOnRequestSchema, TRY_ON_MAX_BYTES } from "@/lib/validation";
import { tryOnLimiter } from "../rate-limit";
import { getClientIp } from "../request";
import { describeGarment, garmentImageFor, listTryOnProducts } from "../try-on/catalog";
import { getTryOnProvider, TryOnError } from "../try-on/provider";

export type TryOnResult = { ok: true; image: string } | { ok: false; code: "not_configured" | "consent" | "invalid" | "rate_limited" | "pose" | "rejected" | "unavailable" | "quota"; message: string };

const errors = copy.tryOn.errors;
const ACCEPTED = new Set(["jpeg", "png", "webp"]);
/**
 * Try-on models work on a portrait frame (IDM-VTON 768 × 1024, FASHN 864 × 1296) and squeeze anything
 * else into it. A webcam frame is landscape, so it is cropped to 3:4 around the most salient region,
 * which is the person, before it is sent.
 */
const PORTRAIT = { width: 960, height: 1280 } as const;

const fail = (code: Exclude<TryOnResult, { ok: true }>["code"], message: string): TryOnResult => ({ ok: false, code, message });

/** A site image URL to its file under public/. Only our own media folders, never a path from outside them. */
function publicFile(url: string): string | null {
  if (!/^\/(media|uploads)\/[\w./-]+\.(webp|png|jpe?g)$/.test(url) || url.includes("..")) return null;
  return path.join(process.cwd(), "public", url);
}

/**
 * AI try-on for one photo the visitor took and chose to send. FormData: `photo` (image file),
 * `product` (handle), `color` (slug) and `consent` ("yes"). Order matters: configuration, consent
 * and the rate limit are checked before any image is decoded; the photo is re-encoded with no
 * metadata (no EXIF, no location) before it leaves the server; nothing is written anywhere.
 */
export async function tryOnAction(formData: FormData): Promise<TryOnResult> {
  const provider = getTryOnProvider();
  if (!provider) return fail("not_configured", errors.notConfigured);

  const parsed = tryOnRequestSchema.safeParse({ product: formData.get("product"), color: formData.get("color"), consent: formData.get("consent") });
  if (!parsed.success) return parsed.error.issues.some((issue) => issue.path[0] === "consent") ? fail("consent", errors.consent) : fail("invalid", errors.invalid);

  if (!tryOnLimiter.check(await getClientIp()).allowed) return fail("rate_limited", errors.tooMany);

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0 || photo.size > TRY_ON_MAX_BYTES) return fail("invalid", errors.photo);

  const product = (await listTryOnProducts()).find((item) => item.handle === parsed.data.product);
  const garmentUrl = product ? garmentImageFor(product, parsed.data.color) : null;
  const garmentPath = garmentUrl ? publicFile(garmentUrl) : null;
  if (!garmentPath) return fail("invalid", errors.invalid);

  let person: Buffer;
  let garment: Buffer;
  try {
    const options = { failOn: "error", limitInputPixels: 40_000_000 } as const;
    const bytes = Buffer.from(await photo.arrayBuffer());
    const meta = await sharp(bytes, options).metadata();
    if (!meta.format || !ACCEPTED.has(meta.format)) return fail("invalid", errors.photo);
    person = await sharp(bytes, options).rotate().resize({ ...PORTRAIT, fit: "cover", position: sharp.strategy.attention }).jpeg({ quality: 90 }).toBuffer();
    garment = await sharp(await readFile(garmentPath)).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  } catch {
    return fail("invalid", errors.photo);
  }

  try {
    const result = await provider.run({ person, garment, category: "tops", description: describeGarment(product!, parsed.data.color) });
    return { ok: true, image: result.image };
  } catch (error) {
    if (error instanceof TryOnError) {
      if (error.code === "pose") return fail("pose", errors.pose);
      if (error.code === "rejected") return fail("rejected", errors.rejected);
      if (error.code === "quota") return fail("quota", errors.quota);
    }
    // The provider's reply is logged without the images, which never leave this function otherwise.
    console.error("try-on provider failed", error instanceof Error ? error.message : error);
    return fail("unavailable", errors.unavailable);
  }
}
