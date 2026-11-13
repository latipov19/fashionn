"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorldSlug } from "@/content/types";
import { wrapOffset } from "@/lib/showroom";
import { setLiteMode, useLiteMode, useMediaQuery } from "@/lib/use-motion";
import type { ShowroomInput, ShowroomSceneItem } from "@/scene/showroom-scene";
import { hasWebGL, SceneBoundary } from "./scene-boundary";

/** Only this chunk and the portal's import three. It is requested when the stage comes near. */
const ShowroomScene = dynamic(() => import("@/scene/showroom-scene"), { ssr: false, loading: () => null });

export type ShowroomItem = {
  key: string;
  href: string;
  name: string;
  /** Category and colour, one line. */
  meta: string;
  price: string;
  demo: boolean;
  /** The colour's swatch, for a card with no image. */
  tint: string;
  image: { src: string; srcSet: string; width: number; height: number; blur: string } | null;
  /** One mid-size WebP for the 3D card. */
  texture: string | null;
  /** The optimised GLB, when the product has one. */
  model: string | null;
};

export type ShowroomCopy = {
  label: string;
  prev: string;
  next: string;
  modelTag: string;
  dragHint: string;
  resetView: string;
  /** Said of a chosen product with no GLB, so its picture is never taken for a model. */
  noModel: string;
  /** Why the products show as pictures, when 3D is off. */
  offLite: string;
  turnOn3d: string;
  offFailed: string;
  demoTag: string;
  wordmark: string;
};

/** One full turn of a model per this many stage widths of drag. */
const DRAG_TURNS = 1.2;
/** Radians of tilt per stage height of vertical drag. The scene holds the tilt within its limits. */
const DRAG_TILT = 1.5;
/** Pixels a pointer moves before a press becomes a drag. */
const DRAG_START = 4;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The 3D Showroom. The poster below the canvas is a CSS carousel of the same products, so the
 * section works before the 3D loads, without WebGL, in light mode and in a world with no models.
 * Under reduced motion the 3D still loads, calm: nothing moves unless the visitor moves it.
 * Buttons and the placard are plain DOM and never depend on the scene.
 */
export function Showroom({ world, items, copy }: { world: WorldSlug; items: ShowroomItem[]; copy: ShowroomCopy }) {
  // A world change starts its list from the first product.
  const [selection, setSelection] = useState({ world, target: 0 });
  if (selection.world !== world) setSelection({ world, target: 0 });
  const target = selection.world === world ? selection.target : 0;

  const count = items.length;
  const active = count ? ((target % count) + count) % count : 0;
  const item = items[active];

  // Light mode turns 3D off. A world whose products have no GLB never loads WebGL: its cards would
  // only repeat the poster. Reduced motion keeps the 3D but calms it. Every gate reads false on the
  // server, so the first paint is the poster and hydration matches.
  const lite = useLiteMode();
  const calm = useMediaQuery("(prefers-reduced-motion: reduce)");
  const hasModels = items.some((entry) => entry.model);
  const allow3d = !lite && hasModels;

  const [near, setNear] = useState(false);
  const [idle, setIdle] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const input = useRef<ShowroomInput>({ spin: 0, tilt: 0, dragging: false, resets: 0, visible: false });
  const invalidate = useRef<(() => void) | null>(null);
  const press = useRef<{ id: number; startX: number; startY: number; x: number; y: number } | null>(null);

  // Load the 3D when the stage comes near. Draw frames only while it is on screen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        input.current.visible = visible;
        if (visible) {
          setNear(true);
          invalidate.current?.();
        }
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!allow3d || !near || failed || idle) return;
    const start = () => (hasWebGL() ? setIdle(true) : setFailed(true));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 600);
    return () => clearTimeout(id);
  }, [allow3d, near, failed, idle]);

  const use3d = allow3d && idle && !failed;
  const showScene = use3d && ready;
  /** The chosen product is a model on screen, so a drag turns it. */
  const rotatable = showScene && Boolean(item?.model);

  // A showroom of pictures needs a reason on screen, or it reads as broken.
  const off = !hasModels ? null : lite ? "lite" : failed ? "failed" : null;

  const step = useCallback((delta: number) => setSelection((state) => ({ world: state.world, target: state.target + delta })), []);
  const bindInvalidate = useCallback((fn: (() => void) | null) => {
    invalidate.current = fn;
  }, []);
  const fail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const onReady = useCallback(() => setReady(true), []);
  const sceneItems = useMemo<ShowroomSceneItem[]>(
    () => items.map(({ key, texture, model, tint }) => ({ key, texture, model, tint })),
    [items],
  );

  function down(event: PointerEvent<HTMLDivElement>) {
    if (!rotatable || !event.isPrimary || event.button !== 0) return;
    press.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const current = press.current;
    if (!current || current.id !== event.pointerId) return;
    if (!input.current.dragging) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < DRAG_START) return;
      input.current.dragging = true;
      setDragging(true);
    }
    // Across turns the model all the way round. Down and up tilt it toward and away from the
    // viewer. On touch a vertical swipe scrolls the page instead (`pan-y`), so tilt comes with a
    // drag that starts sideways.
    const width = stage.current?.clientWidth ?? 1;
    const height = stage.current?.clientHeight ?? 1;
    input.current.spin += ((event.clientX - current.x) / width) * Math.PI * 2 * DRAG_TURNS;
    input.current.tilt += ((event.clientY - current.y) / height) * DRAG_TILT;
    current.x = event.clientX;
    current.y = event.clientY;
    invalidate.current?.();
  }
  function resetView() {
    input.current.resets += 1;
    invalidate.current?.();
  }
  function release(event: PointerEvent<HTMLDivElement>) {
    if (press.current?.id !== event.pointerId) return;
    press.current = null;
    if (input.current.dragging) {
      input.current.dragging = false;
      setDragging(false);
      invalidate.current?.();
    }
  }

  if (!item) return null;

  return (
    <section className="section showroom" aria-roledescription="carousel" aria-label={copy.label}>
      <div
        ref={stage}
        className="showroom-stage"
        data-ready={showScene}
        data-rotatable={rotatable}
        data-dragging={dragging}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        <p className="showroom-wordmark" aria-hidden="true">
          {copy.wordmark}
        </p>
        <ul className="showroom-poster" aria-hidden="true">
          {items.map((entry, i) => {
            const offset = Math.round(wrapOffset(i - target, count));
            const distance = Math.abs(offset);
            return (
              <li
                key={entry.key}
                className="showroom-slide"
                data-active={offset === 0}
                data-far={distance > 2}
                style={{ "--o": offset, "--d": distance, backgroundColor: entry.image ? undefined : entry.tint } as CSSProperties}
                onClick={offset === 0 ? undefined : () => step(offset)}
              >
                {entry.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
                  <img
                    src={entry.image.src}
                    srcSet={entry.image.srcSet}
                    sizes="(max-width: 640px) 60vw, 30vw"
                    width={entry.image.width}
                    height={entry.image.height}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ backgroundImage: `url(${entry.image.blur})`, backgroundSize: "cover" }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {use3d ? (
          <SceneBoundary name="Showroom" onError={fail}>
            <ShowroomScene
              world={world}
              items={sceneItems}
              target={target}
              input={input}
              onStep={step}
              bindInvalidate={bindInvalidate}
              calm={calm}
              onReady={onReady}
              onFail={fail}
            />
          </SceneBoundary>
        ) : null}
      </div>

      {/* Below the stage, never over it: where the arc stands, the chosen product, the arrows. */}
      <div className="shell showroom-bar">
        <div className="showroom-status">
          <span className="t-micro tabular-nums" aria-hidden="true">
            {pad(active + 1)} / {pad(count)}
          </span>
          <span className="showroom-progress" style={{ "--p": (active + 1) / count } as CSSProperties} aria-hidden="true" />
          {off ? (
            <p className="showroom-off t-small text-muted">
              {off === "lite" ? copy.offLite : copy.offFailed}
              {off === "lite" ? (
                <button type="button" className="showroom-on" onClick={() => setLiteMode(false)}>
                  {copy.turnOn3d}
                </button>
              ) : null}
            </p>
          ) : item.model ? (
            <span className="showroom-hint t-small text-muted" data-show={rotatable} aria-hidden={!rotatable}>
              {copy.dragHint}
            </span>
          ) : (
            <span className="showroom-hint t-small text-muted">{copy.noModel}</span>
          )}
        </div>
        <div className="showroom-placard" aria-live="polite">
          <span className="sr-only">
            {active + 1} / {count}
          </span>
          <a href={item.href} className="showroom-name">
            {item.name}
          </a>
          <span className="showroom-details">
            <span className="t-small text-muted">{item.meta}</span>
            <span className="t-price">{item.price}</span>
            {item.demo || item.model ? (
              <span className="showroom-tags">
                {item.demo ? <span className="demo-tag">{copy.demoTag}</span> : null}
                {item.model ? <span className="demo-tag">{copy.modelTag}</span> : null}
              </span>
            ) : null}
          </span>
        </div>
        <div className="showroom-arrows">
          {rotatable ? (
            <button type="button" className="showroom-nav showroom-reset" onClick={resetView} aria-label={copy.resetView} title={copy.resetView}>
              <span aria-hidden="true">↺</span>
            </button>
          ) : null}
          <button type="button" className="showroom-nav" onClick={() => step(-1)} aria-label={copy.prev} disabled={count < 2}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" className="showroom-nav" onClick={() => step(1)} aria-label={copy.next} disabled={count < 2}>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
