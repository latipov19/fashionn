import type { PortalLook } from "@/content/worlds";

/**
 * Sunray Portal geometry, shared by the SVG poster and the 3D scene so both draw the same ring
 * blade for blade. Units: the portal box spans -1..1 on both axes, y up.
 */
export const RING = { inner: 0.56, outer: 0.84 } as const;

/** Blade counts from the shot list: 112 on desktop, 72 on phones. */
export const BLADES_DESKTOP = 112;
export const BLADES_PHONE = 72;

export type Blade = {
  /** Centre angle, radians, counter-clockwise from +x. */
  angle: number;
  inner: number;
  outer: number;
  /** Half the angular width of the blade, radians. */
  halfWidth: number;
  /** Radians the pleat leans out of the ring plane. Alternates sign, so the ring folds like a fan. */
  lean: number;
};

/** Deterministic noise in 0..1, so the server poster and the client scene agree. */
function noise(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function bladeLayout(count: number, look: Pick<PortalLook, "twist" | "jitter" | "scallops">): Blade[] {
  const step = (Math.PI * 2) / count;
  return Array.from({ length: count }, (_, i) => {
    const angle = i * step;
    const scallop = look.scallops ? 0.05 * Math.cos(angle * look.scallops) : 0;
    const jitter = look.jitter ? (noise(i) - 0.5) * 0.24 * look.jitter : 0;
    return {
      angle,
      inner: RING.inner,
      outer: Math.min(0.97, RING.outer * (1 + scallop + jitter)),
      // A little overlap, so no ground shows between pleats.
      halfWidth: step * 0.54,
      lean: (i % 2 === 0 ? 1 : -1) * look.twist,
    };
  });
}

/** Light arrives from the upper left. Returns -1..1: how much a pleat face turns towards it. */
export function faceLight(angle: number, lean: number): number {
  const lx = -0.6;
  const ly = 0.8;
  // The face normal tips sideways (tangent to the ring) as the pleat leans.
  const tx = -Math.sin(angle);
  const ty = Math.cos(angle);
  return Math.sin(lean) * (tx * lx + ty * ly);
}
