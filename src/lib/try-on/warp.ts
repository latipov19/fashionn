/*
 * Bending a flat packshot onto a tracked body, as triangles. Pure geometry, no DOM.
 *
 * The torso is a grid mapped bilinearly from the garment's shoulder and hem corners to the body's
 * shoulders and hips, so the hem follows the waist and the torso leans with the body. Above the
 * shoulder line (hood, collar) the map is rigid, so a hood is never stretched by a long torso.
 * Each sleeve is a strip along its axis, mapped segment by segment onto shoulder, elbow and wrist,
 * so it lifts and bends with the arm. Each triangle is then drawn with one affine transform.
 * The fit also says where the wearer's own skin may show in front of the garment: the neck (and,
 * below a short sleeve, the bare arm) over the torso, the hands over the cuffs. Elsewhere (a low
 * neckline, say) the garment covers the skin, as it would.
 */

import type { GarmentRig, Point, SleeveRig } from "./rig";

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const len = (a: Point) => Math.hypot(a.x, a.y);
const unit = (a: Point): Point => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
/** Perpendicular, turned a quarter clockwise on screen: (1, 0) becomes (0, 1). */
const perp = (a: Point): Point => ({ x: -a.y, y: a.x });
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const mid = (a: Point, b: Point) => lerp(a, b, 0.5);

/** The rig in packshot pixels. */
export type PixelRig = GarmentRig;

export function toPixels(rig: GarmentRig, width: number, height: number): PixelRig {
  const p = (point: Point): Point => ({ x: point.x * width, y: point.y * height });
  const sleeve = (s: SleeveRig): SleeveRig => ({ shoulder: p(s.shoulder), elbow: s.elbow ? p(s.elbow) : null, end: p(s.end), halfWidth: s.halfWidth * width });
  return {
    top: rig.top * height,
    neckline: rig.neckline * height,
    torso: { shoulderLeft: p(rig.torso.shoulderLeft), shoulderRight: p(rig.torso.shoulderRight), hemLeft: p(rig.torso.hemLeft), hemRight: p(rig.torso.hemRight) },
    sleeves: { left: sleeve(rig.sleeves.left), right: sleeve(rig.sleeves.right) },
    hemAt: rig.hemAt,
  };
}

/**
 * Body landmarks in frame pixels, named by the side of the image they appear on (a person facing
 * the camera shows their right shoulder on the image's left). Hips, elbows and wrists are
 * optional: they are left out when not visible enough, and the fit falls back for them.
 */
export type Body = {
  shoulderLeft: Point;
  shoulderRight: Point;
  hipLeft?: Point;
  hipRight?: Point;
  elbowLeft?: Point;
  elbowRight?: Point;
  wristLeft?: Point;
  wristRight?: Point;
  /** Between the index and little finger knuckles, when seen. */
  handLeft?: Point;
  handRight?: Point;
};

export type FitOptions = {
  /** The garment's shoulders are wider than the shoulder joints. */
  ease: number;
  /** The garment's shoulder line sits this many shoulder widths above the joints. */
  lift: number;
  /** Shoulder-to-hip length in shoulder widths, used when the hips are out of frame. */
  torsoRatio: number;
  /**
   * Where a sleeve following an arm starts, from the shoulder joint (0) to where the garment's
   * own seam lands (1). A loose garment's seam sits outside the arm; the sleeve must still be on it.
   */
  sleeveSeam: number;
};

export const DEFAULT_FIT: FitOptions = { ease: 1.28, lift: 0.1, torsoRatio: 1.3, sleeveSeam: 0.35 };

export type SleevePath = {
  /** Packshot pixels, shoulder to cuff. */
  source: Point[];
  /** Frame pixels, the same points on the body. */
  target: Point[];
  halfWidthSource: number;
  halfWidthTarget: number;
};

/** A band of `radius` around a polyline, frame pixels. Without a round start it is cut square there. */
export type Capsule = { points: Point[]; radius: number; roundStart: boolean };

export type Fit = {
  /** Packshot pixels to frame pixels, across the shoulders. */
  scale: number;
  /** Unit vector toward the head. */
  up: Point;
  torso: (point: Point) => Point;
  sleeves: { left: SleevePath; right: SleevePath };
  /**
   * Where the wearer's skin may show in front of the garment: `body` (neck and arms) goes over the
   * torso and under the sleeves, `hands` over everything, starting just past the cuff.
   */
  skin: { body: Capsule[]; hands: Capsule[] };
};

export function fitGarment(body: Body, rig: PixelRig, options: FitOptions = DEFAULT_FIT): Fit {
  const { torso: g } = rig;
  const across = sub(body.shoulderRight, body.shoulderLeft);
  const width = len(across);
  const xAxis = unit(across);
  const shoulderMid = mid(body.shoulderLeft, body.shoulderRight);
  const down = body.hipLeft && body.hipRight ? sub(mid(body.hipLeft, body.hipRight), shoulderMid) : mul(perp(xAxis), width * options.torsoRatio);
  const up = mul(unit(down), -1);
  const hipAxis = body.hipLeft && body.hipRight ? unit(sub(body.hipRight, body.hipLeft)) : xAxis;

  const garmentShoulder = len(sub(g.shoulderRight, g.shoulderLeft));
  const garmentHem = len(sub(g.hemRight, g.hemLeft));
  const scale = (width * options.ease) / garmentShoulder;

  const top = add(shoulderMid, mul(up, options.lift * width));
  const shoulderLeft = sub(top, mul(xAxis, (garmentShoulder * scale) / 2));
  const shoulderRight = add(top, mul(xAxis, (garmentShoulder * scale) / 2));
  const hemCentre = add(top, mul(down, rig.hemAt));
  const hemLeft = sub(hemCentre, mul(hipAxis, (garmentHem * scale) / 2));
  const hemRight = add(hemCentre, mul(hipAxis, (garmentHem * scale) / 2));

  const gShoulderY = (g.shoulderLeft.y + g.shoulderRight.y) / 2;
  const gHemY = (g.hemLeft.y + g.hemRight.y) / 2;

  const torso = (point: Point): Point => {
    const v = (point.y - gShoulderY) / (gHemY - gShoulderY);
    if (v < 0) {
      // Above the shoulders: rigid, scaled like the shoulders, so a hood keeps its shape.
      const u = (point.x - g.shoulderLeft.x) / (g.shoulderRight.x - g.shoulderLeft.x);
      return add(lerp(shoulderLeft, shoulderRight, u), mul(up, (gShoulderY - point.y) * scale));
    }
    const edge = Math.min(v, 1);
    const left = g.shoulderLeft.x + (g.hemLeft.x - g.shoulderLeft.x) * edge;
    const right = g.shoulderRight.x + (g.hemRight.x - g.shoulderRight.x) * edge;
    const u = (point.x - left) / (right - left);
    return lerp(lerp(shoulderLeft, shoulderRight, u), lerp(hemLeft, hemRight, u), v);
  };

  const sleeve = (s: SleeveRig, joint: Point, elbow?: Point, wrist?: Point): SleevePath => {
    const seam = torso(s.shoulder);
    // With the arm in view the sleeve follows it, from the shoulder; without, it hangs where the packshot has it.
    const start = elbow ? lerp(joint, seam, options.sleeveSeam) : seam;
    let source: Point[];
    let target: Point[];
    if (s.elbow) {
      source = [s.shoulder, s.elbow, s.end];
      target = elbow && wrist ? [start, elbow, wrist] : [seam, torso(s.elbow), torso(s.end)];
    } else {
      source = [s.shoulder, s.end];
      const length = len(sub(s.end, s.shoulder)) * scale;
      target = elbow ? [start, add(start, mul(unit(sub(elbow, joint)), length))] : [seam, torso(s.end)];
    }
    return { source, target, halfWidthSource: s.halfWidth, halfWidthTarget: s.halfWidth * scale };
  };

  // The neck, from the garment's front neckline up to the jaw: it shows over a hood's back and
  // through the opening of a collar, while a lower neckline worn underneath stays covered.
  const neckRadius = 0.15 * width;
  const neckBase = add(torso({ x: (g.shoulderLeft.x + g.shoulderRight.x) / 2, y: rig.neckline }), mul(up, neckRadius));
  const jaw = add(shoulderMid, mul(up, 0.6 * width));
  const neckLength = (jaw.x - neckBase.x) * up.x + (jaw.y - neckBase.y) * up.y;
  const skin: Fit["skin"] = {
    body: neckLength > 0 ? [{ points: [neckBase, jaw], radius: neckRadius, roundStart: true }] : [],
    hands: [],
  };
  const arms: [SleeveRig, Point, Point | undefined, Point | undefined, Point | undefined][] = [
    [rig.sleeves.left, body.shoulderLeft, body.elbowLeft, body.wristLeft, body.handLeft],
    [rig.sleeves.right, body.shoulderRight, body.elbowRight, body.wristRight, body.handRight],
  ];
  for (const [rigSleeve, joint, elbow, wrist, hand] of arms) {
    if (!elbow || !wrist) continue;
    if (!rigSleeve.elbow) {
      // A long sleeve covers the arm wherever it goes. Below a short one the bare arm shows, in
      // front of the torso when it crosses it, from where the sleeve ends: inside it, it is hidden.
      const upper = len(sub(elbow, joint));
      const covered = Math.min(len(sub(rigSleeve.end, rigSleeve.shoulder)) * scale, upper);
      const from = add(joint, mul(unit(sub(elbow, joint)), covered));
      skin.body.push({ points: covered < upper ? [from, elbow, wrist] : [elbow, wrist], radius: 0.2 * width, roundStart: false });
    }
    const forearm = sub(wrist, elbow);
    let reach = hand ? mul(sub(hand, wrist), 1.8) : mul(forearm, 0.55);
    if (len(reach) < 0.25 * width) reach = mul(unit(len(reach) ? reach : forearm), 0.25 * width);
    skin.hands.push({ points: [add(wrist, mul(unit(reach), 0.06 * width)), add(wrist, reach)], radius: 0.2 * width, roundStart: false });
  }

  return {
    scale,
    up,
    torso,
    sleeves: {
      left: sleeve(rig.sleeves.left, body.shoulderLeft, body.elbowLeft, body.wristLeft),
      right: sleeve(rig.sleeves.right, body.shoulderRight, body.elbowRight, body.wristRight),
    },
    skin,
  };
}

/**
 * The torso's share of the packshot, packshot pixels: the band between its sides, which run
 * straight up from the shoulder corners (hood and collar included), down to the hem corners and
 * straight on down. The rest is sleeve, the slope of the shoulder with it, so the top of a sleeve
 * moves with the arm. Cutting by region rather than along the sleeve axes leaves no stray scrap
 * of sleeve on the torso, however the sleeve bulges.
 */
export function torsoOutline(rig: PixelRig, height: number): Point[] {
  const { shoulderLeft, shoulderRight, hemLeft, hemRight } = rig.torso;
  return [
    { x: shoulderLeft.x, y: 0 },
    { x: shoulderRight.x, y: 0 },
    shoulderRight,
    hemRight,
    { x: hemRight.x, y: height },
    { x: hemLeft.x, y: height },
    hemLeft,
    shoulderLeft,
  ];
}

export type Triangle = { source: [Point, Point, Point]; target: [Point, Point, Point] };

/** A grid of triangles over `area` (packshot pixels), each corner mapped by `map`. */
export function gridTriangles(area: { left: number; top: number; right: number; bottom: number }, columns: number, rows: number, map: (point: Point) => Point): Triangle[] {
  const points: Point[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: Point[] = [];
    for (let c = 0; c <= columns; c++) row.push({ x: area.left + ((area.right - area.left) * c) / columns, y: area.top + ((area.bottom - area.top) * r) / rows });
    points.push(row);
  }
  const triangles: Triangle[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = points[r]![c]!;
      const b = points[r]![c + 1]!;
      const d = points[r + 1]![c]!;
      const e = points[r + 1]![c + 1]!;
      triangles.push({ source: [a, b, e], target: [map(a), map(b), map(e)] }, { source: [a, e, d], target: [map(a), map(e), map(d)] });
    }
  }
  return triangles;
}

/**
 * A sleeve strip as quads, one per segment: [source corners, target corners]. Segments overlap a
 * little at the joints, the first reaches back over the shoulder and the last runs past the cuff. `cover` widens the strip sideways, so a sleeve that bulges past its half width is still
 * drawn whole.
 */
export function sleeveQuads(path: SleevePath, cover = 1): { source: Point[]; target: Point[] }[] {
  const quads: { source: Point[]; target: Point[] }[] = [];
  const last = path.source.length - 2;
  const corners = (from: Point, to: Point, half: number, back: number, forward: number) => {
    const dir = unit(sub(to, from));
    const side = mul(perp(dir), half * cover);
    const start = sub(from, mul(dir, back));
    const end = add(to, mul(dir, forward));
    return [add(start, side), add(end, side), sub(end, side), sub(start, side)];
  };
  for (let i = 0; i <= last; i++) {
    // The first segment reaches well back, over the slope of the shoulder.
    const back = i === 0 ? 2 : 0.5;
    const forward = i === last ? 1 : 0.5;
    quads.push({
      source: corners(path.source[i]!, path.source[i + 1]!, path.halfWidthSource, back * path.halfWidthSource, forward * path.halfWidthSource),
      target: corners(path.target[i]!, path.target[i + 1]!, path.halfWidthTarget, back * path.halfWidthTarget, forward * path.halfWidthTarget),
    });
  }
  return quads;
}

/** The two triangles of a quad, corner for corner. */
export function quadTriangles(quad: { source: Point[]; target: Point[] }): Triangle[] {
  const [a, b, c, d] = quad.source as [Point, Point, Point, Point];
  const [A, B, C, D] = quad.target as [Point, Point, Point, Point];
  return [
    { source: [a, b, c], target: [A, B, C] },
    { source: [a, c, d], target: [A, C, D] },
  ];
}

/**
 * The affine transform taking a source triangle onto a target triangle, in the order Canvas
 * `setTransform(a, b, c, d, e, f)` takes it: x' = a x + c y + e, y' = b x + d y + f.
 * Null for a degenerate (zero-area) source.
 */
export function affine(source: readonly [Point, Point, Point], target: readonly [Point, Point, Point]): [number, number, number, number, number, number] | null {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = target;
  const det = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(det) < 1e-9) return null;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / det;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / det;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / det;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / det;
  return [a, b, c, d, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - d * s0.y];
}

/** A triangle grown by `pixels` from its centre, so neighbours overlap and no hairline seam shows. */
export function inflate(points: readonly [Point, Point, Point], pixels: number): [Point, Point, Point] {
  const centre = mul(add(add(points[0], points[1]), points[2]), 1 / 3);
  return points.map((point) => add(point, mul(unit(sub(point, centre)), pixels))) as [Point, Point, Point];
}
