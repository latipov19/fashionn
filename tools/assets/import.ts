/**
 * Turns AI-generated files in assets/incoming into site-ready media and records them in
 * src/content/media.ai.json. Run with `npm run assets:import`.
 *
 *   products/<handle>/<colour>.png|webp|jpg   packshot -> trimmed, padded 4:5, WebP 480/960/1600
 *   products/<handle>/<colour>.glb            3D model -> centred, WebP textures, Meshopt, at most 3 MB
 *   looks/<world>.png                         full-body look -> trimmed, padded 2:3, WebP 480/960/1440
 *   heroes/<world>-wide.jpg | -tall.jpg       hero -> 16:9 WebP 960/1600/2400, 9:16 WebP 540/1080
 *
 * Only files that are present are processed. Existing outputs and manifest entries are kept, so
 * running this on a machine without the incoming files changes nothing.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Document } from "@gltf-transform/core";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { center, dedup, meshopt, prune, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { demoCatalog } from "../../src/content/catalog.demo";
import type { AiManifest, GeneratedMediaEntry, MediaSrc, ModelEntry, SceneImage, WorldSlug } from "../../src/content/types";
import { WORLD_SLUGS } from "../../src/content/types";
import { worlds } from "../../src/content/worlds";

const ROOT = path.resolve(import.meta.dirname, "../..");
const INCOMING = path.join(ROOT, "assets", "incoming");
const OUT = path.join(ROOT, "public", "media", "ai");
const MANIFEST = path.join(ROOT, "src", "content", "media.ai.json");
const URL_BASE = "/media/ai";
const IMAGE_EXTENSIONS = [".png", ".webp", ".jpg", ".jpeg"];
const MAX_MODEL_BYTES = 3 * 1024 * 1024;
const MIN_IMAGE_EDGE = 900;
const AI_NOTE = "AI orqali yaratilgan namuna rasm, haqiqiy foto emas";

const warnings: string[] = [];
const done: string[] = [];

function findImage(dir: string, stem: string): string | null {
  for (const extension of IMAGE_EXTENSIONS) {
    const candidate = path.join(dir, `${stem}${extension}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** True when the image has an alpha channel that is actually used. */
async function usesAlpha(input: Buffer): Promise<boolean> {
  const meta = await sharp(input).metadata();
  if (!meta.hasAlpha) return false;
  const stats = await sharp(input).stats();
  return (stats.channels[3]?.min ?? 255) < 250;
}

/**
 * Trims the empty margin, then centres the subject on a canvas of the given width/height ratio
 * with the same padding on every image. That is what makes a set of AI images read as one shoot.
 */
async function frame(input: Buffer, ratio: number, padding: number): Promise<{ canvas: Buffer; edge: number }> {
  const alpha = await usesAlpha(input);
  const oriented = await sharp(input).rotate().ensureAlpha().toBuffer();
  const corner = await sharp(oriented).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  const background = alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: corner[0]!, g: corner[1]!, b: corner[2]!, alpha: 1 };

  const trimmed = await sharp(oriented).trim({ threshold: 14 }).toBuffer({ resolveWithObject: true });
  const { width, height } = trimmed.info;
  const usable = 1 - 2 * padding;
  const canvasWidth = Math.ceil(Math.max(width / usable, (height * ratio) / usable));
  const canvasHeight = Math.round(canvasWidth / ratio);
  const left = Math.floor((canvasWidth - width) / 2);
  const top = Math.floor((canvasHeight - height) / 2);
  const canvas = await sharp(trimmed.data)
    .extend({ left, right: canvasWidth - width - left, top, bottom: canvasHeight - height - top, background })
    .png()
    .toBuffer();
  return { canvas, edge: Math.max(width, height) };
}

async function writeWidths(source: Buffer, stem: string, folder: string, widths: readonly number[], ratio: number, cover = false) {
  const dir = path.join(OUT, folder);
  await mkdir(dir, { recursive: true });
  const srcSet: MediaSrc[] = [];
  for (const width of widths) {
    const height = Math.round(width / ratio);
    const name = `${stem}-${width}.webp`;
    await sharp(source)
      .resize(width, height, cover ? { fit: "cover", position: "centre" } : { fit: "fill" })
      .webp({ quality: 84, alphaQuality: 90, effort: 5 })
      .toFile(path.join(dir, name));
    srcSet.push({ url: `${URL_BASE}/${folder}/${name}`, width });
  }
  const blurWidth = 16;
  const blur = await sharp(source)
    .resize(blurWidth, Math.round(blurWidth / ratio), cover ? { fit: "cover" } : { fit: "fill" })
    .webp({ quality: 40 })
    .toBuffer();
  const lead = srcSet[Math.min(1, srcSet.length - 1)]!;
  return { srcSet, url: lead.url, width: lead.width, height: Math.round(lead.width / ratio), blur: `data:image/webp;base64,${blur.toString("base64")}` };
}

function triangleCount(document: Document): number {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const indices = primitive.getIndices();
      const positions = primitive.getAttribute("POSITION");
      total += Math.floor((indices ? indices.getCount() : (positions?.getCount() ?? 0)) / 3);
    }
  }
  return total;
}

async function optimiseModel(file: string): Promise<{ glb: Uint8Array; triangles: number; textureSize: number }> {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

  let last: { glb: Uint8Array; triangles: number; textureSize: number } | null = null;
  for (const textureSize of [2048, 1024, 512]) {
    const document = await io.read(file);
    await document.transform(
      dedup(),
      prune(),
      weld(),
      center({ pivot: "center" }),
      textureCompress({ encoder: sharp, targetFormat: "webp", resize: [textureSize, textureSize] }),
      meshopt({ encoder: MeshoptEncoder, level: "medium" }),
    );
    const triangles = triangleCount(document);
    const glb = await io.writeBinary(document);
    last = { glb, triangles, textureSize };
    if (glb.byteLength <= MAX_MODEL_BYTES) return last;
  }
  return last!;
}

async function main() {
  if (!existsSync(INCOMING)) {
    console.log("assets/incoming does not exist. Run `npm run assets:brief` first. Nothing changed.");
    return;
  }

  const manifest: AiManifest = existsSync(MANIFEST)
    ? (JSON.parse(await readFile(MANIFEST, "utf8")) as AiManifest)
    : { version: 1, items: [], models: [], scenes: [] };
  const items = new Map(manifest.items.map((item) => [item.id, item]));
  const models = new Map(manifest.models.map((model) => [`${model.productHandle}/${model.colorSlug}`, model]));
  const scenes = new Map(manifest.scenes.map((scene) => [`${scene.world}/${scene.kind}`, scene]));

  /* Products */
  const known = new Map(demoCatalog.map((product) => [product.handle, product]));
  const productsDir = path.join(INCOMING, "products");
  if (existsSync(productsDir)) {
    for (const handle of await readdir(productsDir)) {
      const product = known.get(handle);
      const files = await readdir(path.join(productsDir, handle)).catch(() => [] as string[]);
      if (!product) {
        if (files.length) warnings.push(`products/${handle}: no such product in the catalogue. Check the folder name.`);
        continue;
      }
      for (const file of files) {
        const extension = path.extname(file).toLowerCase();
        const stem = path.basename(file, path.extname(file));
        const color = product.colors.find((candidate) => candidate.slug === stem);
        if (!color) {
          warnings.push(`products/${handle}/${file}: "${stem}" is not a colour of ${product.name}. Expected: ${product.colors.map((c) => c.slug).join(", ")}.`);
          continue;
        }
        const full = path.join(productsDir, handle, file);

        if (IMAGE_EXTENSIONS.includes(extension)) {
          if (findImage(path.join(productsDir, handle), stem) !== full) continue; // one image per colour
          const { canvas, edge } = await frame(await readFile(full), 4 / 5, 0.07);
          if (edge < MIN_IMAGE_EDGE) warnings.push(`products/${handle}/${file}: the item is only ${edge}px. Generate at least ${MIN_IMAGE_EDGE}px for sharp images.`);
          const out = await writeWidths(canvas, `${handle}-${color.slug}`, "products", [480, 960, 1600], 4 / 5);
          const entry: GeneratedMediaEntry = {
            id: `${handle}/${color.slug}/render`,
            productHandle: handle,
            colorSlug: color.slug,
            role: "render",
            ...out,
            dominant: color.hex,
            alt: `${product.name}, ${color.name.toLowerCase()}: ${AI_NOTE}`,
          };
          items.set(entry.id, entry);
          done.push(`packshot  ${handle}/${color.slug}`);
        } else if (extension === ".glb") {
          const result = await optimiseModel(full);
          const name = `${handle}-${color.slug}.glb`;
          await mkdir(path.join(OUT, "3d"), { recursive: true });
          await writeFile(path.join(OUT, "3d", name), result.glb);
          const entry: ModelEntry = {
            productHandle: handle,
            colorSlug: color.slug,
            url: `${URL_BASE}/3d/${name}`,
            bytes: result.glb.byteLength,
            triangles: result.triangles,
          };
          models.set(`${handle}/${color.slug}`, entry);
          const mb = (result.glb.byteLength / 1024 / 1024).toFixed(2);
          done.push(`3d model  ${handle}/${color.slug}: ${mb} MB, ${result.triangles.toLocaleString("en")} triangles, textures ${result.textureSize}px`);
          if (result.glb.byteLength > MAX_MODEL_BYTES) warnings.push(`products/${handle}/${file}: still ${mb} MB after optimisation. Regenerate with fewer polygons (about 50k).`);
        } else {
          warnings.push(`products/${handle}/${file}: unsupported file type. Use PNG, WebP, JPG or GLB.`);
        }
      }
    }
  }

  /* Looks and heroes */
  const sceneJobs: { world: WorldSlug; kind: SceneImage["kind"]; dir: string; stem: string }[] = WORLD_SLUGS.flatMap((world) => [
    { world, kind: "look" as const, dir: "looks", stem: world },
    { world, kind: "hero-wide" as const, dir: "heroes", stem: `${world}-wide` },
    { world, kind: "hero-tall" as const, dir: "heroes", stem: `${world}-tall` },
  ]);
  for (const job of sceneJobs) {
    const file = findImage(path.join(INCOMING, job.dir), job.stem);
    if (!file) continue;
    const input = await readFile(file);
    const name = worlds[job.world].name;
    let out;
    if (job.kind === "look") {
      const { canvas, edge } = await frame(input, 2 / 3, 0.04);
      if (edge < 1400) warnings.push(`looks/${path.basename(file)}: the person is only ${edge}px tall. Generate at least 1400px.`);
      out = await writeWidths(canvas, job.stem, "looks", [480, 960, 1440], 2 / 3);
    } else if (job.kind === "hero-wide") {
      out = await writeWidths(input, job.stem, "heroes", [960, 1600, 2400], 16 / 9, true);
    } else {
      out = await writeWidths(input, job.stem, "heroes", [540, 1080], 9 / 16, true);
    }
    scenes.set(`${job.world}/${job.kind}`, {
      world: job.world,
      kind: job.kind,
      ...out,
      alt: job.kind === "look" ? `${name} obrazi: ${AI_NOTE}` : `${name} olami: ${AI_NOTE}`,
    });
    done.push(`${job.kind.padEnd(9)} ${job.world}`);
  }

  const next: AiManifest = {
    version: 1,
    items: [...items.values()].sort((a, b) => a.id.localeCompare(b.id)),
    models: [...models.values()].sort((a, b) => a.url.localeCompare(b.url)),
    scenes: [...scenes.values()].sort((a, b) => `${a.world}/${a.kind}`.localeCompare(`${b.world}/${b.kind}`)),
  };
  await writeFile(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);

  const colours = demoCatalog.reduce((sum, product) => sum + product.colors.length, 0);
  console.log(done.length ? `Processed:\n  ${done.join("\n  ")}` : "No new files in assets/incoming.");
  console.log(
    `\nStatus: packshots ${next.items.length}/${colours}, 3D models ${next.models.length}, looks ${next.scenes.filter((s) => s.kind === "look").length}/4, heroes ${next.scenes.filter((s) => s.kind !== "look").length}/8`,
  );
  if (warnings.length) {
    console.log(`\nWarnings:\n  ${warnings.join("\n  ")}`);
    process.exitCode = 1;
  }
}

await main();
