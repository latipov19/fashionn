import sharp from "sharp";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy";
import type { Landmark } from "@/lib/try-on/geometry";
import { DEFAULT_PLACEMENT, garmentProfile, OneEuroFilter, placeGarment, POSE } from "@/lib/try-on/geometry";
import { tryOnAction } from "@/server/actions/try-on";
import { closeDb } from "@/server/db/client";
import { resetRateLimits } from "@/server/rate-limit";
import { describeGarment, garmentImageFor, listTryOnProducts } from "@/server/try-on/catalog";
import { createFashnProvider } from "@/server/try-on/fashn";
import { createHuggingFaceProvider } from "@/server/try-on/huggingface";
import { getTryOnProvider, TryOnError, tryOnAvailability } from "@/server/try-on/provider";

afterAll(closeDb);
beforeEach(resetRateLimits);
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A pose with both shoulders and hips, normalised, facing the camera. */
function pose(overrides: Partial<Record<number, Partial<Landmark>>> = {}): Landmark[] {
  const points: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  points[POSE.leftShoulder] = { x: 0.6, y: 0.4, z: 0, visibility: 0.99 };
  points[POSE.rightShoulder] = { x: 0.4, y: 0.4, z: 0, visibility: 0.99 };
  points[POSE.leftHip] = { x: 0.58, y: 0.75, z: 0, visibility: 0.9 };
  points[POSE.rightHip] = { x: 0.42, y: 0.75, z: 0, visibility: 0.9 };
  for (const [index, change] of Object.entries(overrides)) points[Number(index)] = { ...points[Number(index)]!, ...change };
  return points;
}

const garment = { left: 10, right: 90, top: 10, bottom: 90, centerX: 50, shoulderY: 30, shoulderWidth: 48 };
const frame = { width: 1000, height: 1000 };

describe("One Euro filter", () => {
  it("passes the first value, steadies jitter, and still follows a real move", () => {
    const filter = new OneEuroFilter();
    expect(filter.filter(100, 0)).toBe(100);
    const out: number[] = [];
    for (let i = 1; i <= 60; i++) out.push(filter.filter(100 + (i % 2 ? 4 : -4), i / 30));
    const spread = Math.max(...out.slice(20)) - Math.min(...out.slice(20));
    expect(spread).toBeLessThan(4);
    let value = 0;
    for (let i = 61; i <= 150; i++) value = filter.filter(200, i / 30);
    expect(value).toBeGreaterThan(195);
  });
});

describe("garment profile", () => {
  /** A 100 x 100 cut-out: a narrow hood on top, then the body and sleeves at full width. */
  function cutout(opaqueEverywhere = false) {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const hood = y >= 10 && y < 30 && x >= 40 && x < 60;
        const body = y >= 30 && y < 90 && x >= 10 && x < 90;
        data[(y * 100 + x) * 4 + 3] = opaqueEverywhere || hood || body ? 255 : 0;
      }
    }
    return data;
  }

  it("finds the bounds and the shoulder line below the hood", () => {
    expect(garmentProfile(cutout(), 100, 100)).toEqual({ left: 10, right: 89, top: 10, bottom: 89, centerX: 49.5, shoulderY: 30, shoulderWidth: 48 });
  });

  it("refuses an image with no transparent background", () => {
    expect(garmentProfile(cutout(true), 100, 100)).toBeNull();
  });
});

describe("placement", () => {
  it("sits on level shoulders, centred and lifted above the joints", () => {
    const placed = placeGarment(pose(), frame, garment);
    expect(placed.state).toBe("tracking");
    expect(placed.angle).toBeCloseTo(0);
    expect(placed.x).toBeCloseTo(500);
    expect(placed.y).toBeCloseTo(400 - 200 * DEFAULT_PLACEMENT.lift);
    expect(placed.scale).toBeCloseTo((200 * DEFAULT_PLACEMENT.ease) / 48);
  });

  it("follows a tilt of the shoulders", () => {
    const placed = placeGarment(pose({ [POSE.leftShoulder]: { y: 0.45 } }), frame, garment);
    expect(placed.angle).toBeCloseTo(Math.atan2(50, 200));
  });

  it("says why it cannot place: nobody, hidden shoulders, turned away, back to the camera", () => {
    expect(placeGarment(undefined, frame, garment).state).toBe("no_person");
    expect(placeGarment(pose({ [POSE.leftShoulder]: { visibility: 0.2 } }), frame, garment).state).toBe("shoulders_hidden");
    expect(placeGarment(pose({ [POSE.leftShoulder]: { z: 0.3 } }), frame, garment).state).toBe("turned");
    expect(placeGarment(pose({ [POSE.leftShoulder]: { x: 0.4 }, [POSE.rightShoulder]: { x: 0.6 } }), frame, garment).state).toBe("back");
  });

  it("widens the scale back as the body turns slightly, so the garment keeps its size", () => {
    const facing = placeGarment(pose(), frame, garment);
    const turned = placeGarment(pose({ [POSE.leftShoulder]: { z: 0.1 } }), frame, garment);
    expect(turned.state).toBe("tracking");
    expect(turned.scale).toBeGreaterThan(facing.scale);
  });
});

describe("catalogue", () => {
  it("offers only published upper-body products, with a cut-out only where the packshot has one", async () => {
    const products = await listTryOnProducts();
    expect(products.length).toBeGreaterThan(0);
    const handles = products.map((product) => product.handle);
    expect(handles).toContain("noir-oversize-hudi");
    expect(handles).not.toContain("shadow-kargo");
    expect(handles).not.toContain("night-runner");
    const firstWithout = products.findIndex((product) => !product.colors.some((color) => color.overlay));
    if (firstWithout >= 0) expect(products.slice(firstWithout).every((product) => !product.colors.some((color) => color.overlay))).toBe(true);
    const hoodie = products.find((product) => product.handle === "noir-oversize-hudi")!;
    expect(garmentImageFor(hoodie, "qora")).toMatch(/\/media\/ai\/products\/noir-oversize-hudi-qora-960\.webp$/);
  });
});

describe("provider choice", () => {
  it("is off without a key, on with one, and can be turned off explicitly", () => {
    expect(getTryOnProvider({})).toBeNull();
    expect(tryOnAvailability({})).toEqual({ enabled: false, provider: null });
    expect(getTryOnProvider({ FASHN_API_KEY: "k" })?.id).toBe("fashn");
    expect(getTryOnProvider({ FASHN_API_KEY: "k", TRYON_PROVIDER: "none" })).toBeNull();
    expect(tryOnAvailability({ FASHN_API_KEY: "secret-key" })).toEqual({ enabled: true, provider: "FASHN AI" });
    expect(JSON.stringify(tryOnAvailability({ FASHN_API_KEY: "secret-key" }))).not.toContain("secret-key");
  });
});

/** A scripted FASHN: answers /run with an id, then each status poll with the next reply. */
function fakeFashn(statuses: Record<string, unknown>[], runReply: { status: number; body: unknown } = { status: 200, body: { id: "pred-1", error: null } }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const body = String(url).endsWith("/run") ? runReply.body : (statuses.shift() ?? { status: "processing" });
    const status = String(url).endsWith("/run") ? runReply.status : 200;
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const input = { person: Buffer.from("person"), garment: Buffer.from("garment"), category: "tops" as const, description: "black hoodie" };
const noSleep = async () => undefined;

describe("FASHN provider", () => {
  it("sends both images as data URIs with the documented fields, then returns the base64 output", async () => {
    const { fetchImpl, calls } = fakeFashn([{ status: "processing" }, { status: "completed", output: ["data:image/jpeg;base64,AAAA"] }]);
    const provider = createFashnProvider("test-key", fetchImpl, noSleep);
    expect(await provider.run(input)).toEqual({ image: "data:image/jpeg;base64,AAAA" });

    expect(calls[0]!.url).toBe("https://api.fashn.ai/v1/run");
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.model_name).toBe("tryon-v1.6");
    expect(body.inputs).toMatchObject({ category: "tops", return_base64: true, output_format: "jpeg" });
    expect(body.inputs.model_image).toBe(`data:image/jpeg;base64,${Buffer.from("person").toString("base64")}`);
    expect(calls[1]!.url).toBe("https://api.fashn.ai/v1/status/pred-1");
  });

  it("turns a missing pose, an API refusal and a timeout into typed errors", async () => {
    const pose = createFashnProvider("k", fakeFashn([{ status: "failed", error: { name: "PoseError", message: "x" } }]).fetchImpl, noSleep);
    await expect(pose.run(input)).rejects.toMatchObject({ code: "pose" });

    const unauthorized = createFashnProvider("k", fakeFashn([], { status: 401, body: { error: "UnauthorizedAccess", message: "Invalid token" } }).fetchImpl, noSleep);
    await expect(unauthorized.run(input)).rejects.toBeInstanceOf(TryOnError);

    vi.useFakeTimers({ toFake: ["Date"] });
    const slow = createFashnProvider("k", fakeFashn([]).fetchImpl, async () => {
      vi.setSystemTime(Date.now() + 10_000);
    });
    await expect(slow.run(input)).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("free Hugging Face provider", () => {
  /** A stand-in for the Gradio client: records the call and replays the given events. */
  function fakeSpace(events: { type: string; [key: string]: unknown }[]) {
    const submitted: { endpoint: string; data: Record<string, unknown> }[] = [];
    const connect = vi.fn(async () => ({
      submit(endpoint: string, data: Record<string, unknown>) {
        submitted.push({ endpoint, data });
        return {
          cancel: vi.fn(),
          async *[Symbol.asyncIterator]() {
            for (const event of events) yield event;
          },
        };
      },
    }));
    return { connect: connect as never, submitted };
  }
  const png = () => sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer();

  it("is chosen only when asked for, and names itself for the consent line", () => {
    expect(getTryOnProvider({ TRYON_PROVIDER: "huggingface" })?.id).toBe("huggingface");
    expect(tryOnAvailability({ TRYON_PROVIDER: "huggingface" })).toEqual({ enabled: true, provider: "Hugging Face (IDM-VTON)" });
    // A Hugging Face token alone never turns photo uploads on.
    expect(getTryOnProvider({ HF_TOKEN: "hf_x" })).toBeNull();
  });

  it("calls /tryon with the documented fields and returns the output as a JPEG data URI", async () => {
    const bytes = await png();
    const { connect, submitted } = fakeSpace([{ type: "status", stage: "pending" }, { type: "data", data: [{ url: "https://yisol-idm-vton.hf.space/file=/tmp/gradio/x/image.png" }] }]);
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(bytes))) as unknown as typeof fetch;
    const provider = createHuggingFaceProvider({ connect, fetchImpl });
    const result = await provider.run(input);
    expect(result.image).toMatch(/^data:image\/jpeg;base64,/);
    expect(submitted[0]!.endpoint).toBe("/tryon");
    expect(submitted[0]!.data).toMatchObject({ garment_des: "black hoodie", is_checked: true, is_checked_crop: false, denoise_steps: 30, seed: 42 });
    expect((submitted[0]!.data.dict as { layers: unknown[] }).layers).toEqual([]);
  });

  it("reports a spent GPU quota, and refuses an output from anywhere but a Space", async () => {
    const quota = createHuggingFaceProvider({ connect: fakeSpace([{ type: "status", stage: "error", message: "You have exceeded your GPU quota (60s requested vs. 0s left)." }]).connect });
    await expect(quota.run(input)).rejects.toMatchObject({ code: "quota" });

    const foreign = createHuggingFaceProvider({ connect: fakeSpace([{ type: "data", data: [{ url: "https://evil.example.com/image.png" }] }]).connect, fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(foreign.run(input)).rejects.toMatchObject({ code: "unavailable" });
  });

  it("describes garments in English for the model", () => {
    const colors = [
      { slug: "qora", name: "Qora", hex: "#17171A", thumb: null, overlay: null },
      { slug: "sut", name: "Sut", hex: "#EFE9DD", thumb: null, overlay: null },
    ];
    expect(describeGarment({ category: "Hudi", colors }, "qora")).toBe("black hoodie");
    expect(describeGarment({ category: "Futbolka", colors }, "sut")).toBe("white t-shirt");
    expect(describeGarment({ category: "Noma'lum", colors }, "yoq")).toBe("top");
  });
});

describe("try-on action", () => {
  async function photo(): Promise<File> {
    const jpeg = await sharp({ create: { width: 640, height: 800, channels: 3, background: "#808080" } }).jpeg().toBuffer();
    return new File([new Uint8Array(jpeg)], "photo.jpg", { type: "image/jpeg" });
  }
  async function form(fields: Record<string, string | File>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }
  const errors = copy.tryOn.errors;

  it("is off and sends nothing while no provider is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("FASHN_API_KEY", "");
    expect(await tryOnAction(await form({ photo: await photo(), product: "noir-oversize-hudi", color: "qora", consent: "yes" }))).toEqual({ ok: false, code: "not_configured", message: errors.notConfigured });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("needs consent, a known upper-body product and a real image, before anything is sent", async () => {
    vi.stubEnv("FASHN_API_KEY", "test-key");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await tryOnAction(await form({ photo: await photo(), product: "noir-oversize-hudi", color: "qora", consent: "" }))).toMatchObject({ code: "consent" });
    expect(await tryOnAction(await form({ photo: await photo(), product: "shadow-kargo", color: "qora", consent: "yes" }))).toMatchObject({ code: "invalid" });
    expect(await tryOnAction(await form({ photo: await photo(), product: "../../etc", color: "qora", consent: "yes" }))).toMatchObject({ code: "invalid" });
    const fake = new File([new TextEncoder().encode("<script>alert(1)</script>")], "x.jpg", { type: "image/jpeg" });
    expect(await tryOnAction(await form({ photo: fake, product: "noir-oversize-hudi", color: "qora", consent: "yes" }))).toMatchObject({ ok: false, message: errors.photo });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the generated image for a valid request, and limits how often one address may ask", async () => {
    vi.stubEnv("FASHN_API_KEY", "test-key");
    const { fetchImpl, calls } = fakeFashn([{ status: "completed", output: ["data:image/jpeg;base64,BBBB"] }]);
    vi.stubGlobal("fetch", fetchImpl);
    expect(await tryOnAction(await form({ photo: await photo(), product: "noir-oversize-hudi", color: "qora", consent: "yes" }))).toEqual({ ok: true, image: "data:image/jpeg;base64,BBBB" });
    // The photo the provider receives is our re-encoded JPEG, not the visitor's bytes.
    const sent = JSON.parse(String(calls[0]!.init.body)).inputs.model_image as string;
    const meta = await sharp(Buffer.from(sent.split(",")[1]!, "base64")).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();

    // Refusals before the limit (no consent) cost nothing; requests that pass it count, even when they fail later.
    for (let i = 0; i < 4; i++) expect(await tryOnAction(await form({ photo: await photo(), product: "shadow-kargo", color: "qora", consent: "yes" }))).toMatchObject({ code: "invalid" });
    expect(await tryOnAction(await form({ photo: await photo(), product: "noir-oversize-hudi", color: "qora", consent: "yes" }))).toMatchObject({ code: "rate_limited" });
    expect(calls.filter((call) => call.url.endsWith("/run"))).toHaveLength(1);
  });
});
