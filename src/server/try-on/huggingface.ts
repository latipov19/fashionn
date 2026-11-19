import { Client, handle_file } from "@gradio/client";
import sharp from "sharp";
import type { TryOnInput, TryOnOutput, TryOnProvider } from "./provider";
import { TryOnError } from "./provider";

/*
 * Free AI try-on through a public Hugging Face Space running IDM-VTON (yisol/IDM-VTON,
 * https://huggingface.co/spaces/yisol/IDM-VTON). Its API, read with the Gradio client on
 * 2026-11-19 and tried end to end that day (about 30 s, PNG 768 x 1024):
 *
 *   /tryon(dict: { background: image, layers: [], composite: null }, garm_img: image,
 *          garment_des: str, is_checked: bool = true, is_checked_crop: bool = false,
 *          denoise_steps = 30, seed = 42) -> [output image, masked image]
 *
 * Terms to know before relying on it:
 * - The model and Space are CC BY-NC-SA 4.0: non-commercial use only. Fine for the demo shop,
 *   not for a store taking real orders.
 * - It runs on shared ZeroGPU. Without HF_TOKEN the anonymous daily quota runs out after a few
 *   images; a free Hugging Face account's token raises it.
 * - The photo is uploaded to that Space, a public service we do not run. The page names it in the
 *   consent line, and nothing is sent without that consent.
 */

export const DEFAULT_SPACE = "yisol/IDM-VTON";
/** Queueing on shared GPUs can take a while; past this the visitor gets an answer, not a spinner. */
const DEADLINE_MS = 150_000;

type Connect = typeof Client.connect;

/** True for a file URL served by a Hugging Face Space, the only place an output may come from. */
const fromSpace = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".hf.space") || host === "huggingface.co";
  } catch {
    return false;
  }
};

export function createHuggingFaceProvider(options: { space?: string; token?: string; connect?: Connect; fetchImpl?: typeof fetch } = {}): TryOnProvider {
  const space = options.space ?? DEFAULT_SPACE;
  const connect = options.connect ?? Client.connect.bind(Client);
  const fetchImpl = options.fetchImpl ?? fetch;

  async function generate(input: TryOnInput, signal: { cancelled: boolean }): Promise<TryOnOutput> {
    let client: Client;
    try {
      // Status events carry the Space's errors, quota refusals included; without them a refusal looks like a hang.
      client = await connect(space, { events: ["data", "status"], ...(options.token ? { hf_token: options.token as `hf_${string}` } : {}) });
    } catch {
      throw new TryOnError("unavailable", "space unreachable");
    }
    const job = client.submit("/tryon", {
      dict: { background: handle_file(new Blob([new Uint8Array(input.person)], { type: "image/jpeg" })), layers: [], composite: null },
      garm_img: handle_file(new Blob([new Uint8Array(input.garment)], { type: "image/jpeg" })),
      garment_des: input.description,
      is_checked: true,
      is_checked_crop: false,
      denoise_steps: 30,
      seed: 42,
    });
    try {
      for await (const event of job) {
        if (signal.cancelled) break;
        if (event.type === "status" && event.stage === "error") {
          const message = String(event.message ?? "");
          throw new TryOnError(/quota|gpu|exceeded|limit/i.test(message) ? "quota" : "unavailable", message.slice(0, 200));
        }
        if (event.type === "data") {
          const output = (event.data as unknown[])[0] as { url?: string } | undefined;
          const url = output?.url;
          if (!url || !fromSpace(url)) throw new TryOnError("unavailable", "no output");
          const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
          if (!response.ok) throw new TryOnError("unavailable", `output http ${response.status}`);
          const jpeg = await sharp(Buffer.from(await response.arrayBuffer())).jpeg({ quality: 90 }).toBuffer();
          return { image: `data:image/jpeg;base64,${jpeg.toString("base64")}` };
        }
      }
    } finally {
      job.cancel?.();
    }
    throw new TryOnError("timeout");
  }

  return {
    id: "huggingface",
    name: "Hugging Face (IDM-VTON)",
    async run(input) {
      const signal = { cancelled: false };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          signal.cancelled = true;
          reject(new TryOnError("timeout"));
        }, DEADLINE_MS);
      });
      try {
        return await Promise.race([generate(input, signal), deadline]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
