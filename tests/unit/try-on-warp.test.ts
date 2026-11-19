import { describe, expect, it } from "vitest";
import { bodyFromLandmarks, LandmarkSmoother } from "@/lib/try-on/body";
import type { Landmark } from "@/lib/try-on/geometry";
import type { Point } from "@/lib/try-on/rig";
import { rigForCategory } from "@/lib/try-on/rig";
import type { Body } from "@/lib/try-on/warp";
import { affine, DEFAULT_FIT, fitGarment, gridTriangles, inflate, quadTriangles, sleeveQuads, toPixels, torsoOutline } from "@/lib/try-on/warp";

const SIZE = 1000;
const jacket = toPixels(rigForCategory("kurtka"), SIZE, SIZE);
const tee = toPixels(rigForCategory("futbolka"), SIZE, SIZE);

/** Shoulders 200 px apart, hips straight below, arms hanging slightly out. */
const standing: Body = {
  shoulderLeft: { x: 400, y: 400 },
  shoulderRight: { x: 600, y: 400 },
  hipLeft: { x: 420, y: 750 },
  hipRight: { x: 580, y: 750 },
};
const withArms: Body = {
  ...standing,
  elbowLeft: { x: 360, y: 560 },
  wristLeft: { x: 350, y: 700 },
  elbowRight: { x: 640, y: 560 },
  wristRight: { x: 650, y: 700 },
};

const near = (actual: Point, expected: Point, digits = 6) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const apply = (m: readonly number[], p: Point): Point => ({ x: m[0]! * p.x + m[2]! * p.y + m[4]!, y: m[1]! * p.x + m[3]! * p.y + m[5]! });

describe("garment rigs", () => {
  it("picks a rig by catalogue category, a jacket's when unknown", () => {
    expect(rigForCategory(" Hudi ").top).toBe(0.13);
    expect(rigForCategory("futbolka").sleeves.left.elbow).toBeNull();
    expect(rigForCategory("nimadir")).toEqual(rigForCategory("kurtka"));
    // A coat is a jacket that falls further down the body.
    expect(rigForCategory("palto").hemAt).toBeGreaterThan(rigForCategory("kurtka").hemAt);
  });

  it("mirrors the sleeves", () => {
    for (const category of ["hudi", "kurtka", "futbolka"]) {
      const { left, right } = rigForCategory(category).sleeves;
      expect(left.shoulder.x + right.shoulder.x).toBeCloseTo(1, 9);
      expect(left.end.x + right.end.x).toBeCloseTo(1, 9);
      expect(left.end.y).toBe(right.end.y);
      expect(left.halfWidth).toBe(right.halfWidth);
    }
  });
});

describe("fitting a garment to a body", () => {
  it("puts the garment's shoulders over the wearer's, eased out and lifted", () => {
    const fit = fitGarment(standing, jacket);
    const half = (200 * DEFAULT_FIT.ease) / 2;
    const y = 400 - DEFAULT_FIT.lift * 200;
    near(fit.torso(jacket.torso.shoulderLeft), { x: 500 - half, y });
    near(fit.torso(jacket.torso.shoulderRight), { x: 500 + half, y });
    near(fit.up, { x: 0, y: -1 });
  });

  it("drops the hem toward the hips by the rig's length, along the hip line", () => {
    const hem = (body: Body) => {
      const fit = fitGarment(body, jacket);
      return [fit.torso(jacket.torso.hemLeft), fit.torso(jacket.torso.hemRight)] as const;
    };
    const [left, right] = hem(standing);
    const top = 400 - DEFAULT_FIT.lift * 200;
    expect((left.y + right.y) / 2).toBeCloseTo(top + 350 * jacket.hemAt, 6);
    expect(left.y).toBeCloseTo(right.y, 6);
    // Hips tilted, so the hem tilts with them.
    const [tiltedLeft, tiltedRight] = hem({ ...standing, hipLeft: { x: 420, y: 730 }, hipRight: { x: 580, y: 770 } });
    expect(tiltedRight.y).toBeGreaterThan(tiltedLeft.y + 20);
  });

  it("without hips, hangs the torso square to the shoulder line", () => {
    const tilted: Body = { shoulderLeft: { x: 400, y: 380 }, shoulderRight: { x: 600, y: 420 } };
    const fit = fitGarment(tilted, jacket);
    const across = { x: 200, y: 40 };
    // The body's up is perpendicular to the shoulder line, still pointing up the screen.
    expect(fit.up.x * across.x + fit.up.y * across.y).toBeCloseTo(0, 9);
    expect(fit.up.y).toBeLessThan(0);
    const shoulderMid = fit.torso({ x: SIZE / 2, y: jacket.torso.shoulderLeft.y });
    const hemMid = fit.torso({ x: SIZE / 2, y: jacket.torso.hemLeft.y });
    const width = Math.hypot(across.x, across.y);
    expect(distance(shoulderMid, hemMid)).toBeCloseTo(width * DEFAULT_FIT.torsoRatio * jacket.hemAt, 6);
  });

  it("keeps everything above the shoulders rigid, however long the torso", () => {
    const short = fitGarment(standing, jacket);
    const long = fitGarment({ ...standing, hipLeft: { x: 420, y: 950 }, hipRight: { x: 580, y: 950 } }, jacket);
    const a = { x: 400, y: 180 };
    const b = { x: 600, y: 240 };
    for (const fit of [short, long]) expect(distance(fit.torso(a), fit.torso(b))).toBeCloseTo(distance(a, b) * fit.scale, 6);
    near(short.torso(a), long.torso(a));
  });

  it("bends long sleeves onto elbows and wrists when the arms are seen", () => {
    const fit = fitGarment(withArms, jacket);
    const { left, right } = fit.sleeves;
    expect(left.source).toEqual([jacket.sleeves.left.shoulder, jacket.sleeves.left.elbow, jacket.sleeves.left.end]);
    // It starts between the shoulder joint and the garment's own (looser) seam, so it sits on the arm.
    const seam = fit.torso(jacket.sleeves.left.shoulder);
    const joint = withArms.shoulderLeft;
    near(left.target[0]!, { x: joint.x + (seam.x - joint.x) * DEFAULT_FIT.sleeveSeam, y: joint.y + (seam.y - joint.y) * DEFAULT_FIT.sleeveSeam });
    near(left.target[1]!, withArms.elbowLeft!);
    near(left.target[2]!, withArms.wristLeft!);
    near(right.target[2]!, withArms.wristRight!);
    expect(left.halfWidthTarget).toBeCloseTo(jacket.sleeves.left.halfWidth * fit.scale, 9);
  });

  it("hangs long sleeves where the packshot has them when the arms are not seen", () => {
    const fit = fitGarment(standing, jacket);
    near(fit.sleeves.left.target[0]!, fit.torso(jacket.sleeves.left.shoulder));
    near(fit.sleeves.left.target[1]!, fit.torso(jacket.sleeves.left.elbow!));
    near(fit.sleeves.left.target[2]!, fit.torso(jacket.sleeves.left.end));
  });

  it("points a short sleeve along the upper arm, at its own length", () => {
    const body: Body = { ...standing, elbowLeft: { x: 300, y: 450 }, wristLeft: { x: 250, y: 550 } };
    const fit = fitGarment(body, tee);
    const [attach, end] = fit.sleeves.left.target as [Point, Point];
    const length = distance(tee.sleeves.left.shoulder, tee.sleeves.left.end) * fit.scale;
    expect(distance(attach, end)).toBeCloseTo(length, 6);
    const direction = { x: (end.x - attach.x) / length, y: (end.y - attach.y) / length };
    const arm = { x: -100 / Math.hypot(100, 50), y: 50 / Math.hypot(100, 50) };
    near(direction, arm);
  });

  it("lets the neck through, the hands past long sleeves and the bare arms below short ones", () => {
    expect(fitGarment(standing, jacket).skin).toMatchObject({ body: [expect.anything()], hands: [] });
    // Long sleeves cover the arms: only the neck shows over the torso.
    const fit = fitGarment({ ...withArms, handLeft: { x: 348, y: 740 } }, jacket);
    expect(fit.skin.body).toHaveLength(1);
    expect(fit.skin.hands).toHaveLength(2);
    // Short sleeves: each forearm may cross in front of the torso.
    expect(fitGarment(withArms, tee).skin.body).toHaveLength(3);
    // The hand starts just past the wrist, cut square there, and reaches past the knuckles.
    const [start, end] = fit.skin.hands[0]!.points as [Point, Point];
    expect(fit.skin.hands[0]!.roundStart).toBe(false);
    expect(start.y).toBeGreaterThan(withArms.wristLeft!.y);
    near(end, { x: 350 + (348 - 350) * 1.8, y: 700 + 40 * 1.8 });
  });

  it("shows the neck down to the garment's front neckline and no further", () => {
    for (const rig of [jacket, tee, toPixels(rigForCategory("hudi"), SIZE, SIZE)]) {
      const fit = fitGarment(standing, rig);
      const neck = fit.skin.body[0]!;
      const lowest = neck.points[0]!.y + neck.radius;
      expect(lowest).toBeCloseTo(fit.torso({ x: SIZE / 2, y: rig.neckline }).y, 6);
      expect(neck.points[1]!.y).toBeLessThan(neck.points[0]!.y);
    }
  });
});

describe("triangles", () => {
  it("maps a source triangle exactly onto its target", () => {
    const source = [{ x: 10, y: 20 }, { x: 110, y: 30 }, { x: 40, y: 160 }] as const;
    const target = [{ x: 300, y: 310 }, { x: 380, y: 290 }, { x: 330, y: 420 }] as const;
    const matrix = affine(source, target)!;
    source.forEach((point, index) => near(apply(matrix, point), target[index]!));
  });

  it("refuses a flat source triangle", () => {
    expect(affine([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBeNull();
  });

  it("covers a grid with two triangles a cell, each corner mapped", () => {
    const shift = (point: Point) => ({ x: point.x + 5, y: point.y * 2 });
    const triangles = gridTriangles({ left: 0, top: 0, right: 100, bottom: 60 }, 4, 3, shift);
    expect(triangles).toHaveLength(24);
    for (const triangle of triangles) triangle.source.forEach((point, index) => near(triangle.target[index]!, shift(point)));
  });

  it("cuts a sleeve into one quad per segment, half its width either side", () => {
    const path = { source: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 200 }], target: [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 0, y: 200 }], halfWidthSource: 10, halfWidthTarget: 10 };
    const quads = sleeveQuads(path);
    expect(quads).toHaveLength(2);
    expect(quads.flatMap(quadTriangles)).toHaveLength(4);
    expect(new Set(quads[0]!.source.map((point) => Math.abs(point.x)))).toEqual(new Set([10]));
    // The first reaches two half widths back over the shoulder, the last one past the cuff point.
    expect(Math.min(...quads[0]!.source.map((point) => point.y))).toBeCloseTo(-20, 9);
    expect(Math.max(...quads[1]!.source.map((point) => point.y))).toBeCloseTo(210, 9);
    // Wider cover, same mapping along the sleeve.
    expect(new Set(sleeveQuads(path, 1.5)[0]!.source.map((point) => Math.abs(point.x)))).toEqual(new Set([15]));
  });

  it("gives the torso the band between its sides, collar included, and the sleeves the rest", () => {
    const outline = torsoOutline(jacket, SIZE);
    const inside = (point: Point) => {
      let hit = false;
      for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const a = outline[i]!;
        const b = outline[j]!;
        if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
      }
      return hit;
    };
    expect(inside({ x: 500, y: 100 })).toBe(true); // collar
    expect(inside({ x: 150, y: 200 })).toBe(false); // the slope of the shoulder goes with the sleeve
    expect(inside({ x: 500, y: 600 })).toBe(true); // chest
    expect(inside({ x: 500, y: 950 })).toBe(true); // below the hem, straight down
    for (const sleeve of [jacket.sleeves.left, jacket.sleeves.right]) {
      expect(inside(sleeve.elbow!)).toBe(false);
      expect(inside(sleeve.end)).toBe(false);
    }
  });

  it("grows a triangle away from its centre", () => {
    const triangle = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 0, y: 30 }] as const;
    const grown = inflate(triangle, 2);
    const centre = { x: 10, y: 10 };
    grown.forEach((point, index) => expect(distance(point, centre)).toBeCloseTo(distance(triangle[index]!, centre) + 2, 9));
  });
});

describe("reading the body from pose landmarks", () => {
  function landmarks(overrides: Record<number, Partial<Landmark>> = {}): Landmark[] {
    const points: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
    const set = (index: number, x: number, y: number) => (points[index] = { x, y, z: 0, visibility: 0.99 });
    set(12, 0.4, 0.4); // wearer's right shoulder, image left
    set(11, 0.6, 0.4);
    set(14, 0.35, 0.55);
    set(13, 0.65, 0.55);
    set(16, 0.34, 0.7);
    set(15, 0.66, 0.7);
    set(18, 0.32, 0.76);
    set(20, 0.36, 0.76);
    set(24, 0.42, 0.8);
    set(23, 0.58, 0.8);
    for (const [index, change] of Object.entries(overrides)) points[Number(index)] = { ...points[Number(index)]!, ...change };
    return points;
  }
  const frame = { width: 1000, height: 500 };

  it("names joints by the side of the image they are on, in frame pixels", () => {
    const body = bodyFromLandmarks(landmarks(), frame);
    near(body.shoulderLeft, { x: 400, y: 200 });
    near(body.shoulderRight, { x: 600, y: 200 });
    near(body.elbowLeft!, { x: 350, y: 275 });
    near(body.wristRight!, { x: 660, y: 350 });
    near(body.handLeft!, { x: 340, y: 380 });
    near(body.hipLeft!, { x: 420, y: 400 });
  });

  it("leaves out an arm unless both elbow and wrist are seen, and hips unless both are", () => {
    const body = bodyFromLandmarks(landmarks({ 16: { visibility: 0.2 }, 23: { visibility: 0.3 } }), frame);
    expect(body.elbowLeft).toBeUndefined();
    expect(body.wristLeft).toBeUndefined();
    expect(body.handLeft).toBeUndefined();
    expect(body.elbowRight).toBeDefined();
    expect(body.hipLeft).toBeUndefined();
    expect(body.hipRight).toBeUndefined();
  });

  it("smooths only the joints the fit uses, and starts over after a reset", () => {
    const smoother = new LandmarkSmoother();
    const first = landmarks();
    expect(smoother.smooth(first, 0)[12]).toEqual(first[12]);
    const jumped = landmarks({ 12: { x: 0.5 }, 0: { x: 0.9 } });
    const smoothed = smoother.smooth(jumped, 1 / 30);
    expect(smoothed[12]!.x).toBeGreaterThan(0.4);
    expect(smoothed[12]!.x).toBeLessThan(0.5);
    expect(smoothed[0]).toBe(jumped[0]);
    smoother.reset();
    expect(smoother.smooth(jumped, 2 / 30)[12]!.x).toBe(0.5);
  });
});
