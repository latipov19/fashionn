import { describe, expect, it } from "vitest";
import { products } from "@/content/catalog.demo";
import { copy, stockLabel } from "@/content/copy";
import { generateCutSheet, cutForSize, middleSizeIndex, sizeStep } from "@/lib/cut-sheet";
import { bladeWidth, crossingAzimuth, HOUR_TABLE, litTop, solveWindowZ, sunDirection } from "@/lib/hours";
import { calculateTotals, formatCents, parsePriceToCents, usdToCents } from "@/lib/money";
import { checkoutSchema, updateProductSchema } from "@/lib/validation";

const product = (slug: string) => {
  const found = products.find((candidate) => candidate.slug === slug);
  if (!found) throw new Error(slug);
  return found;
};

describe("money", () => {
  it("formats whole dollars without cents, as the copy does", () => {
    expect(formatCents(92_000)).toBe("$920");
    expect(formatCents(92_050)).toBe("$920.50");
    expect(formatCents(0)).toBe("$0");
    expect(formatCents(123_456_700)).toBe("$1,234,567");
  });

  it("converts and parses", () => {
    expect(usdToCents(920)).toBe(92_000);
    expect(parsePriceToCents("920")).toBe(92_000);
    expect(parsePriceToCents("$920.5")).toBe(92_050);
    expect(parsePriceToCents("19.99")).toBe(1999);
    expect(parsePriceToCents("-1")).toBeNull();
    expect(parsePriceToCents("1.234")).toBeNull();
    expect(parsePriceToCents("abc")).toBeNull();
  });

  it("adds totals in integer cents", () => {
    expect(calculateTotals([{ unitPriceUzs: 1999, quantity: 3 }], 1800, 0)).toEqual({
      subtotalUzs: 5997,
      deliveryUzs: 1800,
      taxCents: 0,
      totalUzs: 7797,
    });
    expect(calculateTotals([{ unitPriceUzs: 1000, quantity: 1 }], 0, 825).taxCents).toBe(83);
  });
});

describe("hours", () => {
  it("transcribes the table", () => {
    expect(HOUR_TABLE.morning).toMatchObject({ clock: "08:30", azimuth: 35, elevation: 14, sunColour: "#FFC48A", roomDefault: "I" });
    expect(HOUR_TABLE.noon).toMatchObject({ clock: "13:00", azimuth: 40, elevation: 34, sunColour: "#FFF1DC", roomDefault: "II" });
    expect(HOUR_TABLE.evening).toMatchObject({ clock: "19:00", azimuth: 24, elevation: 6, sunColour: "#FF8A4A", roomDefault: "III" });
  });

  it("matches the worked numbers in 8.5", () => {
    expect(bladeWidth(35)).toBeCloseTo(1.0, 1);
    expect(bladeWidth(40)).toBeCloseTo(0.83, 1);
    expect(bladeWidth(24)).toBeCloseTo(1.57, 2);
    expect(litTop(35, 14)).toBeCloseTo(4.4, 1);
    expect(litTop(40, 34)).toBeCloseTo(2.33, 2);
    expect(litTop(24, 6)).toBeCloseTo(5.09, 2);
  });

  it("gives a unit sun vector pointing up and from the left", () => {
    const [x, y, z] = sunDirection(35, 14);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10);
    expect(x).toBeLessThan(0);
    expect(y).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
  });

  it("solves the window position and the crossing", () => {
    expect(solveWindowZ(-7.5, -3.6, 35)).toBeCloseTo(-7.5, 10);
    expect(solveWindowZ(-7.5, 0.1, 35)).toBeCloseTo(-7.5 + 3.7 * Math.tan((35 * Math.PI) / 180), 10);
    expect(crossingAzimuth(0)).toBe(58);
    expect(crossingAzimuth(0.14)).toBe(58);
    expect(crossingAzimuth(0.43)).toBe(35);
    expect(crossingAzimuth(1)).toBe(35);
  });
});

describe("cut sheet sizing", () => {
  it("treats M as the middle size, else the centre of the list", () => {
    expect(middleSizeIndex(["S", "M", "L", "XL"])).toBe(1);
    expect(middleSizeIndex(["XS", "S", "M", "L"])).toBe(2);
    expect(middleSizeIndex(["S", "M", "L"])).toBe(1);
    expect(middleSizeIndex(["28", "30", "32", "34", "36"])).toBe(2);
    expect(middleSizeIndex(["One size"])).toBe(0);
  });

  it("leaves the middle size at spec", () => {
    const coat = product("quiet-uzun-palto");
    expect(cutForSize(coat.cut, coat.sizes, "M")).toEqual(coat.cut);
  });

  it("applies 4, 1.5 and 3 cm per step in both directions", () => {
    const coat = product("quiet-uzun-palto");
    expect(cutForSize(coat.cut, coat.sizes, "XL")).toMatchObject({ bodyWidthCm: 74, lengthCm: 121, spanCm: 148 });
    expect(cutForSize(coat.cut, coat.sizes, "S")).toMatchObject({ bodyWidthCm: 62, lengthCm: 116.5, spanCm: 139 });
    expect(cutForSize(coat.cut, coat.sizes, "M").sleeveDepthCm).toBe(34);
  });

  it("steps trousers by listed waist size", () => {
    const trouser = product("arcade-trouser");
    expect(sizeStep(trouser.sizes, "36")).toBe(2);
    expect(cutForSize(trouser.cut, trouser.sizes, "36")).toMatchObject({ bodyWidthCm: 50, lengthCm: 107, spanCm: 64 });
    expect(cutForSize(trouser.cut, trouser.sizes, "28")).toMatchObject({ bodyWidthCm: 34, lengthCm: 101, spanCm: 52 });
  });

  it("does not change one-size products or unknown sizes", () => {
    const scarf = product("cornice-scarf");
    expect(cutForSize(scarf.cut, scarf.sizes, "One size")).toEqual(scarf.cut);
    const coat = product("quiet-uzun-palto");
    expect(cutForSize(coat.cut, coat.sizes, "XXL")).toEqual(coat.cut);
  });
});

describe("cut sheet drawing", () => {
  it("draws every seed product at every size", () => {
    for (const item of products) {
      for (const size of item.sizes) {
        const sheet = generateCutSheet(item, size);
        expect(sheet.svg).toMatch(/^<svg class="cut-sheet"/);
        expect(sheet.svg).toMatch(/<\/svg>$/);
        expect(sheet.svg).toContain('role="img"');
        expect(sheet.svg).not.toContain("NaN");
        expect(sheet.svg).not.toContain("undefined");
        expect(sheet.measurements.length).toBeGreaterThan(0);
      }
    }
  });

  it("builds the measurement table from the sized cut", () => {
    const sheet = generateCutSheet(product("quiet-uzun-palto"), "L");
    expect(sheet.measurements).toEqual([
      { key: "length", label: "Length", value: "119.5 cm" },
      { key: "body", label: "Body width", value: "70 cm" },
      { key: "span", label: "Sleeve span", value: "145 cm" },
      { key: "sleeveDepth", label: "Sleeve depth", value: "34 cm" },
      { key: "neckWidth", label: "Neck width", value: "20 cm" },
    ]);
    expect(sheet.svg).toContain("119.5 cm");
    expect(sheet.svg).toContain("145 cm");
  });

  it("changes the drawing when the size changes", () => {
    const coat = product("quiet-uzun-palto");
    expect(generateCutSheet(coat, "S").svg).not.toBe(generateCutSheet(coat, "XL").svg);
  });

  it("labels trouser waist in inches", () => {
    expect(generateCutSheet(product("arcade-trouser"), "32").measurements[0]).toEqual({ key: "waistSize", label: "Waist size", value: "32 in" });
  });

  it("escapes names in the accessible label", () => {
    const svg = generateCutSheet({ ...product("cornice-scarf"), name: `<script>"x"` }, "One size").svg;
    expect(svg).not.toContain("<script>");
  });
});

describe("copy", () => {
  it("uses the brief's stock labels", () => {
    expect(stockLabel(8)).toBe("In stock");
    expect(stockLabel(2)).toBe("Only 2 left");
    expect(stockLabel(1)).toBe("Only 1 left");
    expect(stockLabel(0)).toBe("Sold out");
  });

  it("never uses the banned words", () => {
    const text = JSON.stringify(copy).toLowerCase();
    for (const word of ["luxury", "timeless", "curated", "elevate", "iconic", "essential", "journey", "crafted", "effortless"]) {
      expect(text).not.toContain(word);
    }
    const productText = JSON.stringify(products).toLowerCase();
    expect(productText).not.toContain("luxury");
  });
});

describe("validation", () => {
  const good = {
    email: " Shopper@Example.com ",
    address: { fullName: "A", line1: "B", city: "C", region: "D", postalCode: "E", country: "F" },
    shippingMethod: "standard",
    idempotencyKey: "a".repeat(22),
  };

  it("normalises email and blank optionals", () => {
    const parsed = checkoutSchema.parse({ ...good, phone: "", address: { ...good.address, line2: "  " } });
    expect(parsed.email).toBe("shopper@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.address.line2).toBeNull();
  });

  it("refuses bad shipping methods, keys and phones", () => {
    expect(checkoutSchema.safeParse({ ...good, shippingMethod: "free" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...good, idempotencyKey: "short" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...good, phone: "<script>" }).success).toBe(false);
  });

  it("does not allow slug changes through update", () => {
    const parsed = updateProductSchema.parse({ id: "00000000-0000-4000-8000-000000000000", slug: "new", name: "A" });
    expect(parsed).not.toHaveProperty("slug");
  });
});
