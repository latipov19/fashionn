import type { Landmark } from "./geometry";
import { OneEuroFilter } from "./geometry";
import type { Body } from "./warp";

/**
 * MediaPipe Pose indices, by the side of the image they appear on when the person faces the
 * camera: the wearer's right shoulder (12) is on the image's left.
 */
const INDEX = {
  shoulderLeft: 12,
  shoulderRight: 11,
  elbowLeft: 14,
  elbowRight: 13,
  wristLeft: 16,
  wristRight: 15,
  /** Little finger and index finger knuckles. */
  handLeft: [18, 20],
  handRight: [17, 19],
  hipLeft: 24,
  hipRight: 23,
} as const;

/** Every landmark the fit reads, so only these are smoothed. */
const USED = new Set<number>(Object.values(INDEX).flat());

/** Below this visibility a joint is treated as out of view, and the fit falls back for it. */
const MIN_VISIBILITY = 0.5;

/**
 * Smooths every landmark the fit uses with its own One Euro filters (x and y), so the garment
 * holds still when the body does and keeps up when it moves.
 */
export class LandmarkSmoother {
  private readonly filters = new Map<number, [OneEuroFilter, OneEuroFilter]>();

  smooth(landmarks: readonly Landmark[], timeSeconds: number): Landmark[] {
    return landmarks.map((landmark, index) => {
      if (!USED.has(index)) return landmark;
      let pair = this.filters.get(index);
      if (!pair) {
        pair = [new OneEuroFilter(1.4, 0.02), new OneEuroFilter(1.4, 0.02)];
        this.filters.set(index, pair);
      }
      return { ...landmark, x: pair[0].filter(landmark.x, timeSeconds), y: pair[1].filter(landmark.y, timeSeconds) };
    });
  }

  reset(): void {
    this.filters.clear();
  }
}

/**
 * The body the garment is fitted to, in frame pixels: shoulders always (the caller has already
 * checked them), hips, arms and hands only when visible enough. An arm counts only when both its
 * elbow and wrist are seen, so a half-seen arm never drags a sleeve somewhere odd.
 */
export function bodyFromLandmarks(landmarks: readonly Landmark[], frame: { width: number; height: number }): Body {
  const at = (index: number) => {
    const point = landmarks[index];
    return point ? { x: point.x * frame.width, y: point.y * frame.height } : undefined;
  };
  const seen = (...indices: number[]) => indices.every((index) => (landmarks[index]?.visibility ?? 0) >= MIN_VISIBILITY);
  const between = ([a, b]: readonly [number, number]) => {
    const first = at(a);
    const second = at(b);
    return first && second ? { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 } : undefined;
  };
  const arm = (side: "Left" | "Right") => {
    const elbow = INDEX[`elbow${side}`];
    const wrist = INDEX[`wrist${side}`];
    const hand = INDEX[`hand${side}`];
    if (!seen(elbow, wrist)) return {};
    return {
      [`elbow${side}`]: at(elbow),
      [`wrist${side}`]: at(wrist),
      ...(seen(...hand) ? { [`hand${side}`]: between(hand) } : {}),
    };
  };
  return {
    shoulderLeft: at(INDEX.shoulderLeft)!,
    shoulderRight: at(INDEX.shoulderRight)!,
    ...(seen(INDEX.hipLeft, INDEX.hipRight) ? { hipLeft: at(INDEX.hipLeft), hipRight: at(INDEX.hipRight) } : {}),
    ...arm("Left"),
    ...arm("Right"),
  };
}
