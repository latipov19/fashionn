import { describe, expect, it } from "vitest";
import { clampPitch, frontOf, PITCH_MAX, PITCH_MIN, withinReach, wrapOffset } from "@/lib/showroom";

describe("clampPitch", () => {
  it("passes a small tilt through and holds a large one at the limit", () => {
    expect(clampPitch(0.1)).toBe(0.1);
    expect(clampPitch(5)).toBe(PITCH_MAX);
    expect(clampPitch(-5)).toBe(PITCH_MIN);
  });
});

describe("frontOf", () => {
  it("finds the nearest whole turn, so a reset never spins a model more than half way", () => {
    expect(frontOf(0.4)).toBe(0);
    expect(frontOf(-0.4)).toBeCloseTo(0);
    expect(frontOf(Math.PI * 2 + 0.3)).toBeCloseTo(Math.PI * 2);
    expect(frontOf(Math.PI * 2 * 3 - 1)).toBeCloseTo(Math.PI * 2 * 3);
  });
});

describe("withinReach", () => {
  it("covers the chosen item and two either side, round the end of the list", () => {
    const near = [0, 1, 2, 3, 4, 5, 6].filter((index) => withinReach(index, 0, 7, 2));
    expect(near).toEqual([0, 1, 2, 5, 6]);
  });

  it("follows an unbounded selection", () => {
    expect(withinReach(3, 10, 7, 0)).toBe(true);
    expect(withinReach(0, 10, 7, 2)).toBe(false);
  });
});

describe("wrapOffset", () => {
  it("is zero for the chosen item, however far the selection has wrapped", () => {
    expect(wrapOffset(0, 5)).toBe(0);
    expect(wrapOffset(5, 5)).toBe(0);
    expect(wrapOffset(-10, 5)).toBe(0);
  });

  it("goes the short way round", () => {
    // Item 4 of 5 sits just left of item 0, not four places right.
    expect(wrapOffset(4 - 0, 5)).toBe(-1);
    expect(wrapOffset(0 - 4, 5)).toBe(1);
    expect(wrapOffset(2, 7)).toBe(2);
    expect(wrapOffset(5, 7)).toBe(-2);
  });

  it("keeps fractions, so the 3D arc can sit between two items while it turns", () => {
    expect(wrapOffset(0.25, 5)).toBeCloseTo(0.25);
    expect(wrapOffset(4.75, 5)).toBeCloseTo(-0.25);
  });

  it("stays in [-count / 2, count / 2)", () => {
    for (let value = -20; value <= 20; value += 0.5) {
      const offset = wrapOffset(value, 6);
      expect(offset).toBeGreaterThanOrEqual(-3);
      expect(offset).toBeLessThan(3);
    }
  });

  it("handles one item and an empty list", () => {
    expect(wrapOffset(3, 1)).toBe(0);
    expect(wrapOffset(3, 0)).toBe(0);
  });
});
