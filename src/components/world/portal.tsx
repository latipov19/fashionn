"use client";

import dynamic from "next/dynamic";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorldSlug } from "@/content/types";
import { worlds } from "@/content/worlds";
import { BLADES_DESKTOP, BLADES_PHONE } from "@/lib/portal";
import { useMediaQuery, useMotionAllowed } from "@/lib/use-motion";
import type { PortalPointer } from "@/scene/portal-scene";
import { PortalPoster } from "./portal-poster";
import { hasWebGL, SceneBoundary } from "./scene-boundary";

/** Only this chunk imports three. It is requested on idle, after the first paint. */
const PortalScene = dynamic(() => import("@/scene/portal-scene"), { ssr: false, loading: () => null });

export type ApertureImage = { src: string; srcSet: string; width: number; height: number; alt: string; blur: string };

export type Aperture = {
  href: string;
  /** Accessible name for the link in the opening. */
  label: string;
  name: string;
  price: string;
  demo: boolean;
  image: ApertureImage | null;
};

type Labels = { openProduct: string; demoTag: string };

export function Portal({ world, aperture, labels }: { world: WorldSlug; aperture: Aperture | null; labels: Labels }) {
  const motion = useMotionAllowed();
  const phone = useMediaQuery("(max-width: 640px)");
  const [idle, setIdle] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const pointer = useRef<PortalPointer>({ x: 0, y: 0, active: false });
  const invalidate = useRef<(() => void) | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Load the 3D chunk when the browser is idle after first paint, and only if it can run.
  useEffect(() => {
    if (!motion || failed || idle) return;
    const start = () => (hasWebGL() ? setIdle(true) : setFailed(true));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1200);
    return () => clearTimeout(id);
  }, [motion, failed, idle]);

  const use3d = motion && idle && !failed;
  // The poster only fades once the scene that replaces it has drawn.
  const showScene = use3d && ready;

  const bindInvalidate = useCallback((fn: (() => void) | null) => {
    invalidate.current = fn;
  }, []);
  const fail = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const onReady = useCallback(() => setReady(true), []);

  function move(event: PointerEvent<HTMLDivElement>) {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    pointer.current = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      active: true,
    };
    invalidate.current?.();
  }
  function leave() {
    pointer.current = { ...pointer.current, active: false };
    invalidate.current?.();
  }

  const look = worlds[world].portal;

  return (
    <div className="portal-wrap">
      <div ref={box} className="portal" data-ready={showScene} onPointerMove={use3d ? move : undefined} onPointerLeave={use3d ? leave : undefined}>
        <PortalPoster className="portal-poster" look={look} />
        {aperture ? (
          <a href={aperture.href} className="portal-aperture" aria-label={aperture.label}>
            {aperture.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
              <img
                key={aperture.image.src}
                src={aperture.image.src}
                srcSet={aperture.image.srcSet}
                sizes="(max-width: 900px) 55vw, 30vw"
                width={aperture.image.width}
                height={aperture.image.height}
                alt=""
                fetchPriority="high"
                style={{ backgroundImage: `url(${aperture.image.blur})`, backgroundSize: "cover" }}
              />
            ) : null}
          </a>
        ) : null}
        {use3d ? (
          <SceneBoundary name="Portal" onError={fail}>
            <PortalScene world={world} count={phone ? BLADES_PHONE : BLADES_DESKTOP} pointer={pointer} bindInvalidate={bindInvalidate} onReady={onReady} onFail={fail} />
          </SceneBoundary>
        ) : null}
      </div>
      {aperture ? (
        <div className="portal-placard">
          {aperture.demo ? (
            <span className="demo-tag justify-self-start" aria-hidden="true">
              {labels.demoTag}
            </span>
          ) : null}
          <span className="font-medium">{aperture.name}</span>
          <span className="t-price">{aperture.price}</span>
          <a href={aperture.href} className="t-small underline underline-offset-4">
            {labels.openProduct}
          </a>
        </div>
      ) : null}
    </div>
  );
}
