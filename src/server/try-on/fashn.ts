import type { TryOnInput, TryOnOutput, TryOnProvider } from "./provider";
import { TryOnError } from "./provider";

/*
 * FASHN Virtual Try-On v1.6 (https://docs.fashn.ai/api-reference/tryon-v1-6, read 2026-11-19):
 *
 *   POST https://api.fashn.ai/v1/run   Authorization: Bearer <key>
 *     { "model_name": "tryon-v1.6", "inputs": { "model_image", "garment_image", "category", ... } }
 *     -> { "id", "error" }
 *   then poll the status endpoint with that id until "completed" (output: [image]) or "failed"
 *   (error: { name, message }; PoseError when no body pose is found).
 *
 * The docs give the status call as GET on `${BASE}/status/` plus the prediction id (Python
 * quickstart); the exact path string is not printed verbatim, so check it on the first call with a
 * real key. Images go as base64 data URIs and come back as base64 (`return_base64`): FASHN keeps a
 * base64 input only while the request runs (one-day cleanup backstop) and a base64 output for 60
 * minutes, and states it does not train on customer content. Pricing: 1 credit per output image.
 */

const BASE = "https://api.fashn.ai/v1";
const POLL_MS = 1500;
const DEADLINE_MS = 60_000;

type Fetch = typeof fetch;

const dataUri = (jpeg: Buffer) => `data:image/jpeg;base64,${jpeg.toString("base64")}`;

export function createFashnProvider(apiKey: string, fetchImpl: Fetch = fetch, sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))): TryOnProvider {
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  async function call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, headers, signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new TryOnError("unavailable", "network");
    }
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    // HTTP-level errors (bad key, rate limit, no credits) arrive as { error, message } with a non-2xx status.
    if (!response.ok) throw new TryOnError("unavailable", `http ${response.status} ${String(body.error ?? "")}`);
    return body;
  }

  return {
    id: "fashn",
    name: "FASHN AI",
    async run(input: TryOnInput): Promise<TryOnOutput> {
      const started = await call(`${BASE}/run`, {
        method: "POST",
        body: JSON.stringify({
          model_name: "tryon-v1.6",
          inputs: {
            model_image: dataUri(input.person),
            garment_image: dataUri(input.garment),
            category: input.category,
            garment_photo_type: "auto",
            mode: "balanced",
            output_format: "jpeg",
            return_base64: true,
          },
        }),
      });
      const id = typeof started.id === "string" ? started.id : null;
      if (!id || started.error) throw new TryOnError("unavailable", "no prediction id");

      const deadline = Date.now() + DEADLINE_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_MS);
        const status = await call(`${BASE}/status/${encodeURIComponent(id)}`, { method: "GET" });
        if (status.status === "completed") {
          const image = Array.isArray(status.output) ? status.output[0] : null;
          if (typeof image === "string" && image.startsWith("data:image/")) return { image };
          throw new TryOnError("unavailable", "no output");
        }
        if (status.status === "failed") {
          const name = (status.error as { name?: string } | null)?.name ?? "";
          if (name === "PoseError") throw new TryOnError("pose");
          if (/moderation|nsfw|content/i.test(name)) throw new TryOnError("rejected");
          throw new TryOnError("unavailable", name || "failed");
        }
      }
      throw new TryOnError("timeout");
    },
  };
}
