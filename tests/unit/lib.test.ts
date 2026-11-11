import { describe, expect, it } from "vitest";
import { demoCatalog } from "@/content/catalog.demo";
import { deliveryForRegion } from "@/content/commerce";
import { copy, stockLabel } from "@/content/copy";
import { nextPage, pages } from "@/content/pages";
import { WORLD_SLUGS } from "@/content/types";
import { contrastRatio, neutralTheme, themeCss, withWorld, worldList, worldOr } from "@/content/worlds";
import { pickLook } from "@/lib/look";
import { calculateTotals, discountPercent, formatUzs, parseUzs } from "@/lib/money";
import { foldText, matchesQuery } from "@/lib/search";
import { checkoutSchema, placeOrderSchema, updateProductSchema } from "@/lib/validation";

const NBSP = " ";

describe("money", () => {
  it("formats whole soʻm with no-break spaces", () => {
    expect(formatUzs(590_000)).toBe(`590${NBSP}000${NBSP}soʻm`);
    expect(formatUzs(1_290_000)).toBe(`1${NBSP}290${NBSP}000${NBSP}soʻm`);
    expect(formatUzs(0)).toBe(`0${NBSP}soʻm`);
    expect(formatUzs(-5_000)).toBe(`-5${NBSP}000${NBSP}soʻm`);
  });

  it("parses admin-typed prices and refuses anything that is not whole soʻm", () => {
    expect(parseUzs("590 000")).toBe(590_000);
    expect(parseUzs(`590${NBSP}000 soʻm`)).toBe(590_000);
    expect(parseUzs("12")).toBe(12);
    expect(parseUzs("-1")).toBeNull();
    expect(parseUzs("1.5")).toBeNull();
    expect(parseUzs("abc")).toBeNull();
    expect(parseUzs("")).toBeNull();
  });

  it("adds totals in whole soʻm", () => {
    expect(calculateTotals([{ unitPriceUzs: 590_000, quantity: 2 }, { unitPriceUzs: 249_000, quantity: 1 }], 30_000)).toEqual({
      subtotalUzs: 1_429_000,
      deliveryUzs: 30_000,
      totalUzs: 1_459_000,
    });
  });

  it("shows a discount only when the earlier price is higher", () => {
    expect(discountPercent(1_290_000, 1_490_000)).toBe(13);
    expect(discountPercent(590_000, null)).toBeNull();
    expect(discountPercent(590_000, 590_000)).toBeNull();
    expect(discountPercent(590_000, 500_000)).toBeNull();
  });
});

describe("search", () => {
  it("folds every way of typing oʻ and gʻ", () => {
    expect(foldText("Oʻzbekiston")).toBe("ozbekiston");
    expect(foldText("O'zbekiston")).toBe("ozbekiston");
    expect(foldText("O`zbekiston")).toBe("ozbekiston");
  });

  it("needs every word of the query, in any order", () => {
    expect(matchesQuery("Noir Oversize Hudi", "hudi noir")).toBe(true);
    expect(matchesQuery("Fargʻona viloyati", "fargona")).toBe(true);
    expect(matchesQuery("Noir Oversize Hudi", "hudi kargo")).toBe(false);
  });
});

describe("copy", () => {
  it("states the real stock count and never invents urgency", () => {
    expect(stockLabel(8)).toBe(copy.micro.inStock);
    expect(stockLabel(2)).toBe("2 ta qoldi");
    expect(stockLabel(1)).toBe("1 ta qoldi");
    expect(stockLabel(0)).toBe(copy.micro.soldOut);
  });

  it("uses the Uzbek letters, not plain apostrophes", () => {
    const text = JSON.stringify(copy);
    expect(text).not.toMatch(/[oOgG]'/);
  });

  it("never uses the banned words", () => {
    const text = `${JSON.stringify(copy)} ${JSON.stringify(demoCatalog)}`.toLowerCase();
    for (const word of ["luxury", "timeless", "curated", "elevate", "iconic", "journey", "effortless"]) {
      expect(text).not.toContain(word);
    }
  });
});

describe("demo catalogue", () => {
  it("has unique handles and a stock row for every listed size", () => {
    const handles = demoCatalog.map((product) => product.handle);
    expect(new Set(handles).size).toBe(handles.length);
    for (const product of demoCatalog) {
      expect(product.sizes.length).toBeGreaterThan(0);
      expect(product.colors.length).toBeGreaterThan(0);
      if (product.compareAtUzs !== null) expect(product.compareAtUzs).toBeGreaterThan(product.priceUzs);
    }
  });

  it("puts every world's look together from real pieces", () => {
    for (const slug of WORLD_SLUGS) {
      const shelf = demoCatalog.filter((product) => product.worlds.includes(slug));
      const look = pickLook(shelf);
      expect(look.length).toBeGreaterThanOrEqual(2);
      expect(new Set(look.map((piece) => piece.slot)).size).toBe(look.length);
    }
  });
});

describe("worlds", () => {
  const themes = [...worldList.map((world) => [world.slug, world.theme] as const), ["neutral", neutralTheme] as const];

  it.each(themes)("%s keeps text readable (WCAG AA)", (_slug, theme) => {
    for (const ground of [theme.bg, theme.bgRaised, theme.bgSunken]) {
      expect(contrastRatio(theme.fg, ground)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.fgMuted, ground)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(theme.accentFg, theme.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("writes one rule per world and the glow token", () => {
    const css = themeCss();
    for (const slug of WORLD_SLUGS) expect(css).toContain(`[data-world-root="${slug}"]`);
    expect(css).toContain("--glow:");
  });

  it("reads the world from the URL and keeps the default world's links clean", () => {
    expect(worldOr("soft-signal")).toBe("soft-signal");
    expect(worldOr("nope")).toBe("dark-mode");
    expect(worldOr(undefined)).toBe("dark-mode");
    expect(withWorld("/drop", "dark-mode")).toBe("/drop");
    expect(withWorld("/drop", "raw-energy")).toBe("/drop?world=raw-energy");
  });
});

describe("pages", () => {
  it("visits every page once and wraps back to the hero", () => {
    expect(pages.map((page) => page.href)).toEqual(["/", "/drop", "/showroom", "/look", "/about"]);
    expect(nextPage("home").href).toBe("/drop");
    expect(nextPage("about").href).toBe("/");
  });
});

describe("validation", () => {
  const good = {
    customerName: " Ali Valiyev ",
    phone: "+998 90 123-45-67",
    email: " Shopper@Example.com ",
    region: "toshkent-shahri",
    city: "Toshkent",
    addressLine: "Chilonzor 9, 12-uy",
    notes: "  ",
    idempotencyKey: "a".repeat(22),
  };

  it("normalises the phone, email and blank optionals", () => {
    const parsed = checkoutSchema.parse(good);
    expect(parsed.customerName).toBe("Ali Valiyev");
    expect(parsed.phone).toBe("+998901234567");
    expect(parsed.email).toBe("shopper@example.com");
    expect(parsed.notes).toBeNull();
    expect(checkoutSchema.parse({ ...good, phone: "901234567", email: "" })).toMatchObject({ phone: "+998901234567", email: null });
  });

  it("refuses unknown regions, short keys and bad phones", () => {
    expect(checkoutSchema.safeParse({ ...good, region: "tashkent" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...good, idempotencyKey: "short" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...good, phone: "<script>" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...good, phone: "12345" }).success).toBe(false);
  });

  it("drops any price a client adds to an order line", () => {
    const parsed = placeOrderSchema.parse({ ...good, lines: [{ variantId: "00000000-0000-4000-8000-000000000000", quantity: 1, priceUzs: 1 }] });
    expect(parsed.lines[0]).not.toHaveProperty("priceUzs");
  });

  it("maps every region to a delivery zone", () => {
    expect(deliveryForRegion("toshkent-shahri")?.id).toBe("tashkent");
    expect(deliveryForRegion("samarqand")?.id).toBe("regions");
    expect(deliveryForRegion("nowhere")).toBeUndefined();
  });

  it("does not allow handle changes through update", () => {
    const parsed = updateProductSchema.parse({ id: "00000000-0000-4000-8000-000000000000", handle: "new", name: "A" });
    expect(parsed).not.toHaveProperty("handle");
  });
});
