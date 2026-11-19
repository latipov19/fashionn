import { createFashnProvider } from "./fashn";
import { createHuggingFaceProvider } from "./huggingface";

/*
 * AI try-on providers. One interface, chosen by server configuration; the browser never sees a
 * key or talks to a provider. With no provider configured, AI try-on is off and the page says
 * so: the AR preview keeps working on its own.
 */

export type TryOnInput = {
  /** The visitor's photo, re-encoded by us as JPEG with no metadata. */
  person: Buffer;
  /** The product image, flattened onto white as JPEG. */
  garment: Buffer;
  category: "tops";
  /** A short English description of the garment, such as "black hoodie". Some models use it as a prompt. */
  description: string;
};

/** A data URI of the generated image. Never written to disk or the database. */
export type TryOnOutput = { image: string };

export type TryOnErrorCode = "pose" | "rejected" | "unavailable" | "timeout" | "quota";

export class TryOnError extends Error {
  constructor(readonly code: TryOnErrorCode, detail?: string) {
    super(detail ?? code);
    this.name = "TryOnError";
  }
}

/** The environment, or a plain object of the same keys in tests. */
type Env = Readonly<Record<string, string | undefined>>;

export interface TryOnProvider {
  readonly id: string;
  /** Shown in the privacy notice, so the visitor knows who receives the photo. */
  readonly name: string;
  run(input: TryOnInput): Promise<TryOnOutput>;
}

/**
 * The configured provider, or null. `TRYON_PROVIDER` picks it:
 * - `huggingface`: free, the public IDM-VTON Space (non-commercial licence; `HF_TOKEN` raises the
 *   shared GPU quota; `TRYON_HF_SPACE` points at another Space with the same API).
 * - `fashn`, or unset with `FASHN_API_KEY` present: FASHN, paid per image.
 * - `none`, or nothing configured: AI off.
 * Sending shoppers' photos to a third party is a deliberate choice, so the free Space is never
 * chosen by default.
 */
export function getTryOnProvider(env: Env = process.env): TryOnProvider | null {
  const choice = env.TRYON_PROVIDER?.trim().toLowerCase();
  if (choice === "none") return null;
  if (choice === "huggingface") return createHuggingFaceProvider({ space: env.TRYON_HF_SPACE?.trim() || undefined, token: env.HF_TOKEN?.trim() || undefined });
  const key = env.FASHN_API_KEY?.trim();
  if ((!choice || choice === "fashn") && key) return createFashnProvider(key);
  return null;
}

/** What the page may know: whether AI is on and who processes the photo. No secrets. */
export function tryOnAvailability(env: Env = process.env): { enabled: boolean; provider: string | null } {
  const provider = getTryOnProvider(env);
  return { enabled: provider !== null, provider: provider?.name ?? null };
}
