import { describe, expect, it } from "vitest";
import { wrapOffset } from "@/lib/showroom";

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
