/**
 * Makes an untextured 3D shape of a product from one of its packshots, using the public Tencent
 * Hunyuan3D-2 Space on Hugging Face, and saves it to assets/incoming/shapes/<handle>.glb.
 * `npm run assets:texture` then dresses it in every colour's packshot.
 *
 *   npm run assets:shape -- <handle> [colour]
 *
 * The packshot is uploaded to Hugging Face. Each shape takes about 10 s of Hugging Face's free GPU
 * quota; HF_TOKEN in .env.local gives a larger one. Outputs fall under the Tencent Hunyuan 3D 2.0
 * Community License (see public/media/ai/CREDITS.md).
 */
import { Client, handle_file } from "@gradio/client";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoCatalog } from "../../src/content/catalog.demo";

const ROOT = path.resolve(import.meta.dirname, "../..");
const INCOMING = path.join(ROOT, "assets", "incoming");
const SPACE = "tencent/Hunyuan3D-2";

try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // No .env.local: run on the anonymous quota.
}

async function main() {
  const [handle, colour] = process.argv.slice(2);
  const product = demoCatalog.find((candidate) => candidate.handle === handle);
  if (!handle || !product) {
    console.error(`Usage: npm run assets:shape -- <handle> [colour]\nHandles: ${demoCatalog.map((p) => p.handle).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  // The darkest colour is usually the clearest silhouette, but any colour's packshot gives the same shape.
  const candidates = colour ? [colour] : product.colors.map((c) => c.slug);
  const source = candidates.map((slug) => path.join(INCOMING, "products", handle, `${slug}.png`)).find((file) => existsSync(file));
  if (!source) {
    console.error(`No packshot for ${handle}. Expected assets/incoming/products/${handle}/<colour>.png first.`);
    process.exitCode = 1;
    return;
  }

  const token = process.env.HF_TOKEN?.trim();
  // Status events carry the Space's errors, quota refusals included. Without them a refusal looks like a hang.
  const client = await Client.connect(SPACE, {
    events: ["data", "status"],
    ...(token ? { hf_token: token as `hf_${string}` } : {}),
  });
  console.log(`${SPACE}: shaping ${path.relative(ROOT, source)}${token ? " (with HF_TOKEN)" : " (anonymous quota)"}`);

  const job = client.submit("/shape_generation", {
    caption: null,
    image: handle_file(new Blob([await readFile(source)], { type: "image/png" })),
    mv_image_front: null,
    mv_image_back: null,
    mv_image_left: null,
    mv_image_right: null,
    steps: 30,
    guidance_scale: 5,
    seed: 1234,
    octree_resolution: 256,
    // Packshots from assets:import's inputs already have a clean alpha channel.
    check_box_rembg: false,
    num_chunks: 8000,
    randomize_seed: false,
  });

  let data: unknown[] | null = null;
  for await (const event of job) {
    if (event.type === "status" && event.stage === "error") {
      console.error(`The Space refused: ${event.message ?? "unknown error"}`);
      process.exitCode = 1;
      return;
    }
    if (event.type === "data") {
      data = event.data as unknown[];
      break;
    }
  }
  const file = data
    ?.map((item) => (item && typeof item === "object" && "value" in item ? (item as { value: unknown }).value : item))
    .find((item): item is { url: string } => Boolean(item && typeof item === "object" && "url" in item));
  if (!file) {
    console.error("The Space returned no mesh.");
    process.exitCode = 1;
    return;
  }

  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const out = path.join(INCOMING, "shapes", `${handle}.glb`);
  await mkdir(path.dirname(out), { recursive: true });
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(out, bytes);
  console.log(`Saved ${path.relative(ROOT, out)} (${(bytes.length / 1024 / 1024).toFixed(1)} MB). Next: npm run assets:texture -- ${handle}`);
}

// The Gradio client's event stream does not hold the event loop open, so Node would exit while
// waiting for the Space. This timer keeps it alive; the explicit exit ends it once done.
const keepAlive = setInterval(() => {}, 1000);
const giveUp = setTimeout(() => {
  console.error("No answer from the Space in 5 minutes. It may be busy or asleep; try again later.");
  process.exit(1);
}, 5 * 60_000);
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    clearInterval(keepAlive);
    clearTimeout(giveUp);
    process.exit();
  });
