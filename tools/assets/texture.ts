/**
 * Dresses an untextured shape (from `npm run assets:shape`) in each colour's packshot and writes
 * assets/incoming/products/<handle>/<colour>.glb, ready for `npm run assets:import`.
 *
 *   npm run assets:texture              every shape in assets/incoming/shapes
 *   npm run assets:texture -- <handle>  one product
 *
 * Runs locally, no GPU. Faces turned towards the front (+Z, Hunyuan3D's convention) take the
 * packshot by front projection, fitted to the height so it is never stretched. Every other face
 * takes the garment's average colour from a swatch strip, so a front pocket never shows on the back.
 */
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Document } from "@gltf-transform/core";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { normals, simplify, unweld, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { demoCatalog } from "../../src/content/catalog.demo";

const ROOT = path.resolve(import.meta.dirname, "../..");
const INCOMING = path.join(ROOT, "assets", "incoming");
const SHAPES = path.join(INCOMING, "shapes");
/** Enough for folds and the hood; assets:import compresses it well under 3 MB. */
const TARGET_TRIANGLES = 60_000;
const MAX_TEXTURE = 2048;
/** Width of the swatch strip the back and sides sample. */
const STRIP = 128;
/** A face takes the packshot when its normal leans this far towards +Z. Flatter faces would stretch it. */
const FRONT = 0.25;
/** Resolution of the front depth map that decides which faces the camera actually sees. */
const DEPTH_MAP = 1024;

/** Smooth synthetics and leather catch a highlight; cotton, wool and linen stay matte. */
function roughnessFor(fabric: string): number {
  return /neylon|poliamid|poliester|charm|teri|lak/i.test(fabric) ? 0.55 : 0.92;
}

type Rgb = { r: number; g: number; b: number };

/** The garment cropped to its alpha box, gaps filled with its average colour, plus a swatch strip. */
async function buildTexture(packshot: string) {
  const { data, info } = await sharp(packshot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1;
  let r = 0, g = 0, b = 0, count = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3]! < 200) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      count++;
    }
  }
  if (count === 0) throw new Error(`${packshot} has no opaque pixels. Packshots need a transparent background.`);
  const average: Rgb = { r: Math.round(r / count), g: Math.round(g / count), b: Math.round(b / count) };
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const scale = Math.min(1, (MAX_TEXTURE - STRIP) / cropW, MAX_TEXTURE / cropH);
  const width = Math.round(cropW * scale);
  const height = Math.round(cropH * scale);
  const garment = await sharp(packshot)
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .resize(width, height)
    .flatten({ background: average })
    .png()
    .toBuffer();
  const png = await sharp({ create: { width: width + STRIP, height, channels: 3, background: average } })
    .composite([{ input: garment, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return { png, width, height, average };
}

/**
 * Front depth map: the nearest surface (largest z) seen at each point of the front view. A face
 * further back than this is hidden from the packshot's camera, like a fold on the back that happens
 * to face forwards, and must not take the packshot.
 */
function frontDepth(positions: Float32Array, min: number[], max: number[]): (x: number, y: number) => number {
  const size = DEPTH_MAP;
  const depth = new Float32Array(size * size).fill(-Infinity);
  const span = Math.max(max[0]! - min[0]!, max[1]! - min[1]!);
  const toPx = (x: number) => ((x - min[0]!) / span) * (size - 1);
  const toPy = (y: number) => ((max[1]! - y) / span) * (size - 1);
  for (let t = 0; t < positions.length; t += 9) {
    const ax = toPx(positions[t]!), ay = toPy(positions[t + 1]!), az = positions[t + 2]!;
    const bx = toPx(positions[t + 3]!), by = toPy(positions[t + 4]!), bz = positions[t + 5]!;
    const cx = toPx(positions[t + 6]!), cy = toPy(positions[t + 7]!), cz = positions[t + 8]!;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * az + w1 * bz + w2 * cz;
        const i = py * size + px;
        if (z > depth[i]!) depth[i] = z;
      }
    }
  }
  return (x, y) => depth[Math.round(toPy(y)) * size + Math.round(toPx(x))] ?? -Infinity;
}

/** Simplified, smooth-shaded and unwelded, so each triangle can take its own UVs. */
async function prepareShape(io: NodeIO, file: string): Promise<Document> {
  await MeshoptSimplifier.ready;
  const document = await io.read(file);
  const primitives = document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
  if (primitives.length !== 1) throw new Error(`${file}: expected one mesh primitive, found ${primitives.length}.`);
  const indices = primitives[0]!.getIndices();
  const triangles = (indices ? indices.getCount() : primitives[0]!.getAttribute("POSITION")!.getCount()) / 3;
  await document.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, TARGET_TRIANGLES / triangles), error: 0.002 }),
    normals({ overwrite: true }),
    unweld(),
  );
  return document;
}

async function dress(io: NodeIO, shapeFile: string, packshot: string, out: string, roughness: number) {
  const document = await prepareShape(io, shapeFile);
  const root = document.getRoot();
  const primitive = root.listMeshes()[0]!.listPrimitives()[0]!;
  const position = primitive.getAttribute("POSITION")!;
  const count = position.getCount();
  const texture = await buildTexture(packshot);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const v = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    position.getElement(i, v);
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, v[k]!);
      max[k] = Math.max(max[k]!, v[k]!);
    }
  }
  const meshH = max[1]! - min[1]!;
  const centreX = (min[0]! + max[0]!) / 2;
  const flat = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    position.getElement(i, v);
    flat.set(v, i * 3);
  }
  const seenDepth = frontDepth(flat, min, max);
  /** How far behind the front surface a face may sit and still count as seen. */
  const tolerance = (max[2]! - min[2]!) * 0.02;
  const fullWidth = texture.width + STRIP;
  const swatchU = (texture.width + STRIP / 2) / fullWidth;

  const uv = new Float32Array(count * 2);
  const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
  let front = 0;
  for (let t = 0; t < count; t += 3) {
    position.getElement(t, a);
    position.getElement(t + 1, b);
    position.getElement(t + 2, c);
    const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
    const ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
    const nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
    const centroid = [(a[0]! + b[0]! + c[0]!) / 3, (a[1]! + b[1]! + c[1]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
    const facesFront =
      nz / (Math.hypot(nx, ny, nz) || 1) > FRONT && centroid[2]! >= seenDepth(centroid[0]!, centroid[1]!) - tolerance;
    if (facesFront) front++;
    for (const [k, p] of [a, b, c].entries()) {
      if (facesFront) {
        const px = texture.width / 2 + (p[0]! - centreX) * (texture.height / meshH);
        uv[(t + k) * 2] = Math.min(texture.width - 1, Math.max(1, px)) / fullWidth;
        uv[(t + k) * 2 + 1] = (max[1]! - p[1]!) / meshH;
      } else {
        uv[(t + k) * 2] = swatchU;
        uv[(t + k) * 2 + 1] = 0.5;
      }
    }
  }

  primitive.setAttribute("TEXCOORD_0", document.createAccessor("uv").setType("VEC2").setArray(uv).setBuffer(root.listBuffers()[0]!));
  const image = document.createTexture("packshot").setImage(new Uint8Array(texture.png)).setMimeType("image/png");
  primitive.setMaterial(document.createMaterial("fabric").setBaseColorTexture(image).setRoughnessFactor(roughness).setMetallicFactor(0));
  await document.transform(weld());
  await io.write(out, document);

  const { r, g, b: blue } = texture.average;
  return `${count / 3} triangles, ${Math.round((front / (count / 3)) * 100)}% front, back rgb(${r},${g},${blue})`;
}

async function main() {
  if (!existsSync(SHAPES)) {
    console.log("No assets/incoming/shapes yet. Make one with: npm run assets:shape -- <handle>");
    return;
  }
  const only = process.argv[2];
  const shapes = (await readdir(SHAPES)).filter((file) => file.endsWith(".glb")).map((file) => path.basename(file, ".glb"));
  const handles = only ? shapes.filter((handle) => handle === only) : shapes;
  if (only && handles.length === 0) {
    console.error(`No assets/incoming/shapes/${only}.glb. Make it with: npm run assets:shape -- ${only}`);
    process.exitCode = 1;
    return;
  }

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  let written = 0;
  for (const handle of handles) {
    const product = demoCatalog.find((candidate) => candidate.handle === handle);
    if (!product) {
      console.warn(`shapes/${handle}.glb: no such product in the catalogue. Check the file name.`);
      continue;
    }
    for (const color of product.colors) {
      const packshot = path.join(INCOMING, "products", handle, `${color.slug}.png`);
      if (!existsSync(packshot)) {
        console.log(`  ${handle}/${color.slug}: no packshot yet, skipped`);
        continue;
      }
      const out = path.join(INCOMING, "products", handle, `${color.slug}.glb`);
      const roughness = roughnessFor(product.fabric);
      const summary = await dress(io, path.join(SHAPES, `${handle}.glb`), packshot, out, roughness);
      console.log(`  ${handle}/${color.slug}.glb: ${summary}, roughness ${roughness}`);
      written++;
    }
  }
  console.log(written ? `\n${written} model(s) written. Next: npm run assets:import` : "Nothing to texture.");
}

await main();
