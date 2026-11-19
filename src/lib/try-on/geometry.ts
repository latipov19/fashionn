/*
 * Geometry for the AR try-on preview. Pure functions, no DOM, so they run in tests.
 *
 * This is an overlay, not cloth simulation: a flat packshot is scaled, rotated and placed on the
 * shoulder line that pose tracking reports. It follows the body; it does not drape, fold or
 * hide behind arms. The interface says so.
 */

/** One landmark in normalised image coordinates, as MediaPipe Pose reports it. */
export type Landmark = { x: number; y: number; z: number; visibility?: number };

/** MediaPipe Pose landmark indices used here. */
export const POSE = { leftShoulder: 11, rightShoulder: 12, leftHip: 23, rightHip: 24 } as const;

/**
 * The One Euro filter (Casiez et al., 2012): smooths jitter when still, follows quickly when
 * moving. `minCutoff` sets the smoothing at rest, `beta` how fast it opens up with speed.
 */
export class OneEuroFilter {
  private previous: number | null = null;
  private previousDerivative = 0;
  private lastTime: number | null = null;

  constructor(
    private readonly minCutoff = 1.2,
    private readonly beta = 0.015,
    private readonly derivativeCutoff = 1,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /** Filters `value` sampled at `time` (seconds). */
  filter(value: number, time: number): number {
    if (this.previous === null || this.lastTime === null || time <= this.lastTime) {
      this.previous = value;
      this.lastTime = time;
      return value;
    }
    const dt = time - this.lastTime;
    this.lastTime = time;
    const derivative = (value - this.previous) / dt;
    const smoothedDerivative = this.previousDerivative + OneEuroFilter.alpha(this.derivativeCutoff, dt) * (derivative - this.previousDerivative);
    this.previousDerivative = smoothedDerivative;
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    this.previous = this.previous + OneEuroFilter.alpha(cutoff, dt) * (value - this.previous);
    return this.previous;
  }

  reset(): void {
    this.previous = null;
    this.lastTime = null;
    this.previousDerivative = 0;
  }
}

/** Where the garment sits inside its packshot, read from the alpha channel. Image pixels. */
export type GarmentProfile = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  /** The row where the garment reaches shoulder width: below a hood or collar. */
  shoulderY: number;
  /** The garment's width at that row. */
  shoulderWidth: number;
};

/** A row counts as shoulder height once it spans this share of the garment's full width. */
const SHOULDER_ROW_SHARE = 0.6;

/**
 * Reads a packshot's alpha channel (RGBA bytes, row by row) and finds the garment's bounds and
 * its shoulder line. Returns null for an image with no transparent background, which cannot be
 * laid over a body.
 */
export function garmentProfile(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, alphaThreshold = 128): GarmentProfile | null {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  let transparent = 0;
  const rowSpan = new Int32Array(height);
  for (let y = 0; y < height; y++) {
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3]! >= alphaThreshold) {
        if (first < 0) first = x;
        last = x;
      } else transparent++;
    }
    if (first >= 0) {
      rowSpan[y] = last - first + 1;
      left = Math.min(left, first);
      right = Math.max(right, last);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  // Mostly opaque: a photo on a background, not a cut-out.
  if (right < 0 || transparent < width * height * 0.05) return null;

  const full = right - left + 1;
  let shoulderY = top;
  for (let y = top; y <= bottom; y++) {
    if (rowSpan[y]! >= full * SHOULDER_ROW_SHARE) {
      shoulderY = y;
      break;
    }
  }
  return { left, right, top, bottom, centerX: (left + right) / 2, shoulderY, shoulderWidth: full * SHOULDER_ROW_SHARE };
}

export type TrackingState = "tracking" | "no_person" | "shoulders_hidden" | "turned" | "back";

export type Placement = {
  state: TrackingState;
  /** Mean visibility of both shoulders, 0 to 1. */
  confidence: number;
  /** Frame pixels: where the garment's shoulder line centre goes. */
  x: number;
  y: number;
  /** Packshot pixels to frame pixels. */
  scale: number;
  /** Radians, the tilt of the shoulder line. */
  angle: number;
  /** Radians, the body turned away from the camera (0 facing it). */
  yaw: number;
};

export type PlacementOptions = {
  /** Shoulder joints sit inside the body's outline; a garment is wider still. */
  ease: number;
  /** The garment's shoulder line sits this many shoulder widths above the joints (negative: below). The
   * packshot's widest-shoulder row is where the sleeves start, a little under the joints, so a flat
   * hood lands on the neck rather than over the chin. Tuned on a sample photo, 2026-11-19. */
  lift: number;
  minVisibility: number;
  /** Beyond this yaw the front of a flat packshot no longer makes sense. */
  maxYaw: number;
};

export const DEFAULT_PLACEMENT: PlacementOptions = { ease: 1.32, lift: -0.06, minVisibility: 0.5, maxYaw: 0.75 };

const hidden = (state: TrackingState, confidence = 0): Placement => ({ state, confidence, x: 0, y: 0, scale: 0, angle: 0, yaw: 0 });

/**
 * Places the garment on the shoulders. Landmarks are normalised to the frame (unmirrored: the
 * person's left shoulder appears on the image's right when they face the camera).
 */
export function placeGarment(landmarks: readonly Landmark[] | undefined, frame: { width: number; height: number }, garment: GarmentProfile, options: PlacementOptions = DEFAULT_PLACEMENT): Placement {
  const left = landmarks?.[POSE.leftShoulder];
  const right = landmarks?.[POSE.rightShoulder];
  if (!left || !right) return hidden("no_person");

  const confidence = ((left.visibility ?? 1) + (right.visibility ?? 1)) / 2;
  if (Math.min(left.visibility ?? 1, right.visibility ?? 1) < options.minVisibility) return hidden("shoulders_hidden", confidence);

  const lx = left.x * frame.width;
  const ly = left.y * frame.height;
  const rx = right.x * frame.width;
  const ry = right.y * frame.height;
  const dx = lx - rx;
  const dy = ly - ry;
  const shoulderPx = Math.hypot(dx, dy);
  if (shoulderPx < 8) return hidden("no_person", confidence);
  // Facing away, the shoulders swap sides in the image.
  if (dx < 0 && Math.abs(dx) > Math.abs(dy)) return hidden("back", confidence);

  // Depth is reported on roughly the x scale, so the shoulder line's turn is atan(dz / dx).
  const yaw = Math.atan2((left.z - right.z) * frame.width, dx);
  if (Math.abs(yaw) > options.maxYaw) return hidden("turned", confidence);

  const angle = Math.atan2(dy, dx);
  // The joints measure the line as seen; turning foreshortens it, so undo that for the scale.
  const trueShoulder = shoulderPx / Math.max(Math.cos(yaw), 0.4);
  const scale = (trueShoulder * options.ease) / garment.shoulderWidth;
  const lift = trueShoulder * options.lift;
  return {
    state: "tracking",
    confidence,
    // Lift along the body's own up direction, perpendicular to the shoulder line.
    x: (lx + rx) / 2 + Math.sin(angle) * lift,
    y: (ly + ry) / 2 - Math.cos(angle) * lift,
    scale,
    angle,
    yaw,
  };
}
