"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { copy } from "@/content/copy";
import type { GarmentProfile, TrackingState } from "@/lib/try-on/geometry";
import { DEFAULT_PLACEMENT, garmentProfile, OneEuroFilter, placeGarment } from "@/lib/try-on/geometry";
import type { TryOnResult } from "@/server/actions/try-on";
import { tryOnAction } from "@/server/actions/try-on";
import type { TryOnProduct } from "@/server/try-on/catalog";
import type { PoseTracker } from "./pose-tracker";
import { useCamera } from "./use-camera";

const text = copy.tryOn;

type Tracking = "off" | "loading" | "failed" | TrackingState;
type Garment = { image: HTMLImageElement; profile: GarmentProfile } | null;
type Selection = { handle: string; color: string };

/** The first colour with a cut-out, else the first colour. */
function defaultColor(product: TryOnProduct): string {
  return (product.colors.find((color) => color.overlay) ?? product.colors[0])?.slug ?? "";
}

/** Decodes the packshot and reads where the garment sits in it. Null when it has no transparent background. */
async function loadGarment(url: string): Promise<Garment> {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const profile = garmentProfile(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  return profile ? { image, profile } : null;
}

/**
 * The try-on studio: the live camera with the selected garment laid on the shoulders (AR,
 * computed in this browser), the catalogue beside it, and an optional AI result for one photo the
 * visitor chooses to send. Per-frame work lives in refs; React state changes only when what the
 * visitor sees in words changes.
 */
export function TryOnStudio({ products, initial, ai, exitHref }: { products: TryOnProduct[]; initial: Partial<Selection>; ai: { enabled: boolean; provider: string | null }; exitHref: string }) {
  const router = useRouter();
  const { video, state: cameraState, facing, cameras, start, stop, switchCamera } = useCamera();
  const canvas = useRef<HTMLCanvasElement>(null);
  const tracker = useRef<PoseTracker | null>(null);
  const garment = useRef<Garment>(null);
  const filters = useRef({ x: new OneEuroFilter(), y: new OneEuroFilter(), scale: new OneEuroFilter(0.8), angle: new OneEuroFilter(), yaw: new OneEuroFilter(0.8) });
  const shown = useRef<{ state: Tracking; confidence: number }>({ state: "off", confidence: 0 });

  const [tracking, setTracking] = useState<{ state: Tracking; confidence: number }>({ state: "off", confidence: 0 });
  const startProduct = products.find((product) => product.handle === initial.handle) ?? products[0];
  const [selection, setSelection] = useState<Selection>(() =>
    startProduct ? { handle: startProduct.handle, color: startProduct.colors.some((color) => color.slug === initial.color) ? initial.color! : defaultColor(startProduct) } : { handle: "", color: "" },
  );
  /** The overlay URL whose cut-out is decoded and ready to draw. */
  const [loadedOverlay, setLoadedOverlay] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [aiResult, setAiResult] = useState<TryOnResult | null>(null);
  const [aiPending, startAi] = useTransition();

  const product = products.find((item) => item.handle === selection.handle);
  const color = product?.colors.find((item) => item.slug === selection.color);
  const live = cameraState === "live";
  const overlayReady = loadedOverlay !== null && loadedOverlay === color?.overlay;

  const report = useCallback((state: Tracking, confidence = 0) => {
    const rounded = Math.round(confidence * 10) / 10;
    if (shown.current.state === state && shown.current.confidence === rounded) return;
    shown.current = { state, confidence: rounded };
    setTracking({ state, confidence: rounded });
  }, []);

  const resetFilters = useCallback(() => Object.values(filters.current).forEach((filter) => filter.reset()), []);

  // The garment for the selected colour, decoded once per selection.
  useEffect(() => {
    let current = true;
    const url = color?.overlay;
    garment.current = null;
    resetFilters();
    if (!url) return;
    loadGarment(url)
      .then((loaded) => {
        if (!current) return;
        garment.current = loaded;
        setLoadedOverlay(loaded ? url : null);
      })
      .catch(() => current && setLoadedOverlay(null));
    return () => {
      current = false;
    };
  }, [color?.overlay, resetFilters]);

  // Pose tracking: loaded the first time the camera goes live, kept while the page is open.
  useEffect(() => {
    if (!live || tracker.current) return;
    let cancelled = false;
    report("loading");
    import("./pose-tracker")
      .then(({ createPoseTracker }) => createPoseTracker())
      .then((created) => {
        if (cancelled) return created.close();
        tracker.current = created;
        report("no_person");
      })
      .catch((error: unknown) => {
        console.error("pose tracking failed to load", error);
        if (!cancelled) report("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [live, report]);

  useEffect(
    () => () => {
      tracker.current?.close();
      tracker.current = null;
    },
    [],
  );

  // The frame loop: detect, place, smooth, draw. Runs only while the camera is live.
  useEffect(() => {
    if (!live) {
      const context = canvas.current?.getContext("2d");
      if (context && canvas.current) context.clearRect(0, 0, canvas.current.width, canvas.current.height);
      if (shown.current.state !== "loading" && shown.current.state !== "failed") report("off");
      return;
    }
    let frame = 0;
    let lastVideoTime = -1;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const element = video.current;
      const surface = canvas.current;
      const pose = tracker.current;
      if (!element || !surface || !pose || element.readyState < 2 || element.currentTime === lastVideoTime) return;
      lastVideoTime = element.currentTime;
      const width = element.videoWidth;
      const height = element.videoHeight;
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
      }
      const context = surface.getContext("2d");
      if (!context) return;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);

      let landmarks;
      try {
        landmarks = pose.detect(element, performance.now());
      } catch (error) {
        console.error("pose detection failed", error);
        report("failed");
        cancelAnimationFrame(frame);
        return;
      }
      const current = garment.current;
      // Without a cut-out there is nothing to place, but the tracking status still reports honestly.
      const profile: GarmentProfile = current?.profile ?? { left: 0, right: 1, top: 0, bottom: 1, centerX: 0.5, shoulderY: 0, shoulderWidth: 1 };
      const placement = placeGarment(landmarks, { width, height }, profile, DEFAULT_PLACEMENT);
      report(placement.state, placement.confidence);
      if (placement.state !== "tracking") {
        resetFilters();
        return;
      }
      if (!current) return;
      const t = performance.now() / 1000;
      const f = filters.current;
      const x = f.x.filter(placement.x, t);
      const y = f.y.filter(placement.y, t);
      const scale = f.scale.filter(placement.scale, t);
      const angle = f.angle.filter(placement.angle, t);
      const yaw = f.yaw.filter(placement.yaw, t);
      context.translate(x, y);
      context.rotate(angle);
      // Foreshortened as the body turns, so the garment narrows with the shoulders.
      context.scale(scale * Math.max(Math.cos(yaw), 0.4), scale);
      context.drawImage(current.image, -current.profile.centerX, -current.profile.shoulderY);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [live, report, resetFilters, video]);

  function choose(next: TryOnProduct, colorSlug?: string) {
    setSelection({ handle: next.handle, color: colorSlug ?? defaultColor(next) });
    setAiResult(null);
  }

  function reset() {
    resetFilters();
    setAiResult(null);
    setConsent(false);
    if (startProduct) setSelection({ handle: startProduct.handle, color: defaultColor(startProduct) });
  }

  function exit() {
    stop();
    router.push(exitHref);
  }

  /** One frame, unmirrored, as JPEG: the only image that ever leaves the device, and only with consent. */
  function captureAndSend() {
    const element = video.current;
    if (!element || !live || !product || !color) return;
    const frame = document.createElement("canvas");
    frame.width = element.videoWidth;
    frame.height = element.videoHeight;
    frame.getContext("2d")?.drawImage(element, 0, 0);
    frame.toBlob(
      (blob) => {
        if (!blob) return;
        const data = new FormData();
        data.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
        data.set("product", product.handle);
        data.set("color", color.slug);
        data.set("consent", consent ? "yes" : "");
        startAi(async () => setAiResult(await tryOnAction(data)));
      },
      "image/jpeg",
      0.9,
    );
  }

  const cameraMessage = { denied: text.camera.denied, unavailable: text.camera.unavailable, busy: text.camera.busy, insecure: text.camera.insecure, error: text.camera.error } as const;
  const failure = cameraState in cameraMessage ? cameraMessage[cameraState as keyof typeof cameraMessage] : null;
  const trackingText = tracking.state === "off" ? null : tracking.state === "loading" ? text.tracking.loading : tracking.state === "failed" ? text.tracking.failed : text.tracking[tracking.state];
  const drawing = live && tracking.state === "tracking" && overlayReady;

  if (!product) return <p className="t-lead text-muted">{text.catalog.empty}</p>;

  return (
    <div className="tryon">
      <section className="tryon-stage" aria-label={text.kicker} data-live={live} data-mirror={facing === "user"}>
        <video ref={video} className="tryon-video" playsInline muted aria-hidden="true" />
        <canvas ref={canvas} className="tryon-canvas" aria-hidden="true" />

        {!live ? (
          <div className="tryon-gate glass-2">
            <p className="kicker">{text.privacy.title}</p>
            <ul className="tryon-privacy">
              <li>{text.privacy.why}</li>
              <li>{text.privacy.local}</li>
              <li>{ai.enabled && ai.provider ? text.privacy.ai(ai.provider) : text.privacy.aiOff}</li>
            </ul>
            {failure ? (
              <p className="tryon-alert" role="alert">
                {failure}
              </p>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => start()} disabled={cameraState === "starting"} aria-busy={cameraState === "starting" || undefined}>
              {cameraState === "starting" ? text.camera.starting : failure ? text.camera.retry : text.camera.start}
            </button>
            <p className="t-small text-muted">{text.camera.hint}</p>
          </div>
        ) : null}

        {live ? (
          <>
            <div className="tryon-status" aria-live="polite">
              <span className="tryon-chip" data-tone="ok">
                <i aria-hidden="true" />
                {text.camera.live}
              </span>
              {trackingText ? (
                <span className="tryon-chip" data-tone={tracking.state === "tracking" ? "ok" : tracking.state === "failed" ? "danger" : "wait"}>
                  <i aria-hidden="true" />
                  {trackingText}
                  {tracking.state === "tracking" ? <span className="tryon-chip-note">{text.tracking.confidence(Math.round(tracking.confidence * 100))}</span> : null}
                </span>
              ) : null}
            </div>
            {drawing ? <span className="tryon-badge">{text.ar.badge}</span> : null}
            <div className="tryon-controls">
              {cameras > 1 ? (
                <button type="button" className="tryon-round" onClick={switchCamera} aria-label={text.camera.switch} title={text.camera.switch}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" />
                    <path d="M9 13.5a3 3 0 0 1 5.2-2M15 13.5a3 3 0 0 1-5.2 2M14.5 10v1.6h-1.6M9.5 17v-1.6h1.6" />
                  </svg>
                </button>
              ) : null}
              <button type="button" className="tryon-round" onClick={stop} aria-label={text.camera.stop} title={text.camera.stop}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M3.5 7.5h11v9h-11ZM14.5 10.5l6-3v9l-6-3M4 4l16 16" />
                </svg>
              </button>
            </div>
          </>
        ) : null}

        {aiResult?.ok ? (
          <figure className="tryon-result glass-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated data URI, never stored */}
            <img src={aiResult.image} alt={`${product.name}, ${color?.name ?? ""}: ${text.ai.resultLabel}`} />
            <figcaption>
              <span className="tryon-badge tryon-badge-ai">{text.ai.resultLabel}</span>
              <button type="button" className="btn btn-secondary tryon-btn-sm" onClick={() => setAiResult(null)}>
                {text.ai.close}
              </button>
            </figcaption>
          </figure>
        ) : null}
      </section>

      <aside className="tryon-panel glass-2" aria-label={text.catalog.title}>
        <div className="tryon-panel-head">
          <h2 className="t-micro">{text.catalog.title}</h2>
          <p className="t-small text-muted">{text.catalog.note}</p>
        </div>
        <ul className="tryon-products">
          {products.map((item) => {
            const thumb = item.colors.find((entry) => entry.thumb)?.thumb;
            const ready = item.colors.some((entry) => entry.overlay);
            return (
              <li key={item.handle}>
                <button type="button" className="tryon-product" aria-pressed={item.handle === product.handle} onClick={() => choose(item)}>
                  <span className="tryon-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline */}
                    {thumb ? <img src={thumb} alt="" width={64} height={80} loading="lazy" decoding="async" /> : null}
                  </span>
                  <span className="tryon-product-text">
                    <span className="tryon-product-name">{item.name}</span>
                    <span className="t-small text-muted">
                      {item.category} · {item.price}
                    </span>
                  </span>
                  <span className="tryon-product-tags">
                    {ready ? <span className="tryon-tag">{text.catalog.arReady}</span> : null}
                    {item.isDemo ? <span className="demo-tag">{text.catalog.demo}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="tryon-ai">
          <h2 className="t-micro">{text.ai.title}</h2>
          {ai.enabled && ai.provider ? (
            <>
              <label className="tryon-consent">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>{text.ai.consent(ai.provider)}</span>
              </label>
              <button type="button" className="btn btn-primary btn-full" disabled={!live || !consent || aiPending} aria-busy={aiPending || undefined} onClick={captureAndSend}>
                {aiPending ? text.ai.working : text.ai.capture}
              </button>
              {!live ? <p className="t-small text-muted">{text.ai.needCamera}</p> : null}
              {aiResult && !aiResult.ok ? (
                <p className="tryon-alert" role="alert">
                  {aiResult.message}
                </p>
              ) : null}
            </>
          ) : (
            <p className="t-small text-muted">{text.ai.off}</p>
          )}
        </div>
      </aside>

      <footer className="tryon-bar glass-2">
        <div className="tryon-selected">
          <span className="t-micro text-muted">{text.bar.selected}</span>
          <span className="tryon-selected-name">{product.name}</span>
          <span className="t-small text-muted">
            {product.category} · {product.price}
          </span>
        </div>
        <div className="tryon-colors" role="group" aria-label={text.catalog.color}>
          {product.colors.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              className="tryon-swatch"
              style={{ background: entry.hex }}
              aria-pressed={entry.slug === selection.color}
              aria-label={`${text.catalog.color}: ${entry.name}`}
              title={entry.name}
              onClick={() => choose(product, entry.slug)}
            />
          ))}
          <span className="t-small">{color?.name}</span>
        </div>
        <p className="tryon-note t-small text-muted">{color?.overlay ? text.ar.note : text.ar.noOverlay}</p>
        <div className="tryon-bar-actions">
          <button type="button" className="btn btn-secondary tryon-btn-sm" onClick={reset}>
            {text.bar.reset}
          </button>
          <Link href={exitHref} className="btn btn-text tryon-btn-sm" onClick={(event) => (event.preventDefault(), exit())}>
            {text.bar.exit}
          </Link>
        </div>
      </footer>
    </div>
  );
}
