import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { GeneratedMediaEntry } from "@/content/types";
import type { CreateProductInput } from "@/lib/validation";
import { MAX_UPLOAD_BYTES } from "@/lib/validation";
import {
  createProduct,
  hideMedia,
  reorderMedia,
  reorderProducts,
  revertToGenerated,
  setProductPublished,
  setStock,
  setStockMany,
  updateOrderStatus,
  updateProduct,
  uploadMedia,
} from "@/server/actions/admin";
import { adminGetProduct, adminListCloths, adminListProducts, getProductByHandle, listProducts } from "@/server/catalog";
import { closeDb, getDb } from "@/server/db/client";
import { colors, products } from "@/server/db/schema";
import { focalCrop, getAllMediaFor, getMediaFor, hourImages, mergeMedia, needsRenderedDisclosure, primaryMedia, processUpload } from "@/server/media";
import { placeOrder } from "@/server/orders";
import { UPLOAD_NAME, localStorage } from "@/server/storage/local";
import type { StorageProvider } from "@/server/storage/provider";
import { setStorage } from "@/server/storage/provider";
import { checkoutInput, signIn, stockOf, variantOf } from "./helpers";

// One generated entry per image, standing in for the manifest the pipeline writes.
vi.mock("@/content/media.generated.json", () => ({
  default: {
    version: 1,
    items: [
      {
        id: "lintel-coat/chalk/room/morning",
        productHandle: "quiet-uzun-palto",
        colorId: "tosh",
        role: "room",
        hour: "morning",
        url: "/media/generated/a-1600.webp",
        width: 1600,
        height: 2000,
        srcSet: [{ url: "/media/generated/a-1600.webp", width: 1600 }],
        blur: "data:image/webp;base64,AA",
        alt: "Lintel Coat in Chalk",
      },
      {
        id: "lintel-coat/chalk/room/noon",
        productHandle: "quiet-uzun-palto",
        colorId: "tosh",
        role: "room",
        hour: "noon",
        url: "/media/generated/b-1600.webp",
        width: 1600,
        height: 2000,
        srcSet: [{ url: "/media/generated/b-1600.webp", width: 1600 }],
        blur: "data:image/webp;base64,AA",
        alt: "Lintel Coat in Chalk at noon",
      },
      {
        id: "lintel-coat/chalk/cloth",
        productHandle: "quiet-uzun-palto",
        colorId: "tosh",
        role: "cloth",
        url: "/media/generated/c-960.webp",
        width: 960,
        height: 960,
        srcSet: [{ url: "/media/generated/c-960.webp", width: 960 }],
        blur: "data:image/webp;base64,AA",
        alt: "Heavy wool twill in Chalk",
      },
    ] satisfies GeneratedMediaEntry[],
  },
}));

const stored = new Map<string, Buffer>();
const memoryStorage: StorageProvider = {
  async put(name, bytes) {
    stored.set(name, bytes);
    return { url: `/uploads/${name}` };
  },
  async remove(url) {
    stored.delete(url.replace("/uploads/", ""));
  },
};

beforeAll(async () => {
  await getDb();
  setStorage(memoryStorage);
});
afterAll(closeDb);
beforeEach(async () => {
  stored.clear();
  await signIn();
});

const newProduct: CreateProductInput = {
  slug: "keystone-apron",
  peg: "II.05",
  name: "Keystone Apron",
  category: "Shirts",
  room: "II",
  hour: "noon",
  frameClass: "mid",
  hang: "shoulderRod",
  priceUzs: 15_000,
  sizes: ["S", "M"],
  colors: [
    { slug: "plaster", name: "Plaster", hex: "#D8CDB8", lining: "#847B6A" },
    { slug: "moss", name: "Moss", hex: "#24504B", lining: "#1A3A36" },
  ],
  clothId: "cotton-canvas-340",
  description: "A square apron in cotton canvas.",
  cut: { template: "vest", lengthCm: 80, bodyWidthCm: 60, spanCm: 60, sleeveDepthCm: 0, neckWidthCm: 20, neckDropCm: 10 },
};

async function chalk() {
  const db = await getDb();
  const [row] = await db
    .select({ productId: products.id, colorId: colors.id })
    .from(colors)
    .innerJoin(products, eq(products.id, colors.productId))
    .where(eq(colors.slug, "tosh"));
  if (!row) throw new Error("No chalk");
  return row;
}

const chalkOwner = async () => ({ product: { slug: "quiet-uzun-palto" }, color: { id: (await chalk()).colorId, slug: "tosh" } });

function imageBuffer(width: number, height: number, format: "png" | "jpeg" = "png") {
  return sharp({ create: { width, height, channels: 3, background: "#884422" } })
    .toFormat(format)
    .toBuffer();
}

function uploadForm(fields: Record<string, string>, bytes: Buffer, name = "my photo.png", type = "image/png") {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  data.set("file", new File([new Uint8Array(bytes)], name, { type }));
  return data;
}

describe("products", () => {
  it("creates a draft with colors and zero-stock variants", async () => {
    const result = await createProduct(newProduct);
    if (!result.ok) throw new Error(result.message);
    expect(result.data.slug).toBe("keystone-apron");
    expect(result.data.warnings).toEqual([expect.stringContaining("Moss")]);

    expect(await getProductByHandle("keystone-apron")).toBeNull();
    const product = await adminGetProduct(result.data.id);
    expect(product).toMatchObject({ published: false, gatherPct: 5, details: [] });
    expect(product?.colors.map((c) => c.slug)).toEqual(["plaster", "moss"]);
    expect(product?.colors[0]?.variants).toHaveLength(2);
    expect(product?.colors.flatMap((c) => c.variants).every((v) => v.stock === 0)).toBe(true);
    expect(product?.colors[0]?.variants[0]?.sku).toBe("KEYSTONE-APRON-PLASTER-S");
  });

  it("refuses duplicates and bad input with field errors", async () => {
    expect(await createProduct(newProduct)).toMatchObject({ ok: false, code: "conflict", fieldErrors: { slug: expect.any(String) } });
    expect(await createProduct({ ...newProduct, slug: "another", peg: "I.01" })).toMatchObject({ ok: false, code: "conflict", fieldErrors: { peg: expect.any(String) } });
    expect(await createProduct({ ...newProduct, slug: "Bad Slug", peg: "X.9" })).toMatchObject({ ok: false, code: "validation", fieldErrors: { slug: expect.any(String) } });
    expect(await createProduct({ ...newProduct, slug: "x1", peg: "X.1", clothId: "no-cloth" })).toMatchObject({ ok: false, code: "validation", fieldErrors: { clothId: expect.any(String) } });
    expect(await createProduct({ ...newProduct, slug: "x2", peg: "X.2", priceUzs: 19.99 })).toMatchObject({ ok: false, code: "validation" });
  });

  it("updates only the fields sent, and keeps existing stock", async () => {
    const before = await variantOf("jamb-jacket", "putty", "M");
    const [product] = (await adminListProducts()).filter((item) => item.slug === "jamb-jacket");

    const result = await updateProduct({ id: product!.id, priceUzs: 55_000, description: "Changed." });
    expect(result.ok).toBe(true);

    const after = await adminGetProduct(product!.id);
    expect(after).toMatchObject({ priceUzs: 55_000, description: "Changed.", name: "Jamb Jacket", slug: "jamb-jacket" });
    expect(await stockOf(before.id)).toBe(before.stock);
    expect(await updateProduct({ id: "00000000-0000-4000-8000-000000000000", name: "X" })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("adds and removes sizes and colors without losing variants", async () => {
    const product = (await adminListProducts()).find((item) => item.slug === "spandrel-top")!;
    const ivory = product.colors.find((c) => c.slug === "ivory")!;
    await updateProduct({
      id: product.id,
      sizes: ["S", "M", "L", "XL"],
      colors: [{ slug: "ivory", name: "Ivory", hex: ivory.hex, lining: ivory.lining }],
    });

    const shop = await getProductByHandle("spandrel-top");
    expect(shop?.colors.map((c) => c.slug)).toEqual(["ivory"]);
    expect(shop?.colors[0]?.variants.map((v) => v.size)).toEqual(["S", "M", "L", "XL"]);
    expect(shop?.colors[0]?.variants.at(-1)?.stock).toBe(0);

    const ochre = await variantOf("spandrel-top", "ochre", "S");
    expect(await placeOrder(checkoutInput([{ variantId: ochre.id, quantity: 1 }]))).toMatchObject({ ok: false, code: "stock" });
    const removedSize = await variantOf("spandrel-top", "ivory", "XS");
    expect(await placeOrder(checkoutInput([{ variantId: removedSize.id, quantity: 1 }]))).toMatchObject({ ok: false, code: "stock" });
  });

  it("publishes, unpublishes and reorders", async () => {
    const all = await adminListProducts();
    const first = all[0]!;
    expect((await setProductPublished({ id: first.id, published: false })).ok).toBe(true);
    expect((await listProducts()).map((p) => p.id)).not.toContain(first.id);
    await setProductPublished({ id: first.id, published: true });

    const reversed = all.map((p) => p.id).reverse();
    expect((await reorderProducts({ ids: reversed })).ok).toBe(true);
    expect((await adminListProducts())[0]?.id).toBe(reversed[0]);
    await reorderProducts({ ids: all.map((p) => p.id) });
    expect(await setProductPublished({ id: "x" as string, published: true })).toMatchObject({ ok: false, code: "validation" });
  });

  it("sets stock, one or many, and refuses negatives", async () => {
    const a = await variantOf("mullion-shirt", "white", "L");
    const b = await variantOf("mullion-shirt", "white", "XL");
    expect((await setStock({ variantId: a.id, stock: 5 })).ok).toBe(true);
    expect(await stockOf(a.id)).toBe(5);
    expect(await setStock({ variantId: a.id, stock: -1 })).toMatchObject({ ok: false, code: "validation" });
    expect(await setStock({ variantId: "00000000-0000-4000-8000-000000000000", stock: 1 })).toMatchObject({ ok: false, code: "not_found" });

    expect(
      (
        await setStockMany({
          items: [
            { variantId: a.id, stock: 1 },
            { variantId: b.id, stock: 2 },
          ],
        })
      ).ok,
    ).toBe(true);
    expect(await stockOf(b.id)).toBe(2);
  });

  it("lists cloths for the form", async () => {
    expect(await adminListCloths()).toHaveLength(10);
  });
});

describe("orders through the admin action", () => {
  it("explains an invalid change in words", async () => {
    const variant = await variantOf("nave-dress", "garnet", "M");
    const placed = await placeOrder(checkoutInput([{ variantId: variant.id, quantity: 1 }]));
    if (!placed.ok) throw new Error("Order failed");
    expect(await updateOrderStatus({ orderId: placed.order.id, status: "delivered" })).toMatchObject({
      ok: false,
      code: "invalid_transition",
      message: "An order that is placed cannot become delivered.",
    });
    expect(await updateOrderStatus({ orderId: placed.order.id, status: "canceled" })).toEqual({ ok: true, data: { status: "canceled" } });
    expect(await stockOf(variant.id)).toBe(variant.stock);
    expect(await updateOrderStatus({ orderId: placed.order.id, status: "bogus" as never })).toMatchObject({ ok: false, code: "validation" });
  });
});

describe("media merging", () => {
  it("merges the manifest and leads with the first generated room image", async () => {
    const { product, color } = await chalkOwner();
    const media = await getMediaFor(product, color);
    expect(media.map((item) => item.id)).toEqual(["lintel-coat/chalk/room/morning", "lintel-coat/chalk/room/noon", "lintel-coat/chalk/cloth"]);
    expect(needsRenderedDisclosure(media)).toBe(true);
    expect(Object.keys(hourImages(media))).toEqual(["morning", "noon"]);
  });

  it("orders uploads by position against generated items", () => {
    const generated = [{ id: "g", productHandle: "p", colorId: "c", role: "room", url: "/g", width: 1, height: 1, srcSet: [], blur: "", alt: "G" }] satisfies GeneratedMediaEntry[];
    const upload = { id: "u", productId: "p", colorId: "c", role: "photo", hour: null, url: "/u", width: 1, height: 1, srcSet: [], blur: "", dominant: null, alt: "U", position: 999, hidden: false, createdAt: new Date() } as const;
    expect(mergeMedia(generated, [{ ...upload, srcSet: [] }], []).map((m) => m.id)).toEqual(["u", "g"]);
    expect(mergeMedia(generated, [{ ...upload, srcSet: [] }], [{ mediaKey: "g", hidden: false, position: 0 }]).map((m) => m.id)).toEqual(["g", "u"]);
  });

  it("copes with a color that has no media", () => {
    expect(primaryMedia([])).toBeNull();
    expect(needsRenderedDisclosure([])).toBe(false);
    expect(hourImages([])).toEqual({});
  });
});

describe("upload", () => {
  it("crops around the focal point and stays inside the image", () => {
    expect(focalCrop(1000, 1000, 0.5, 0.5)).toEqual({ left: 100, top: 0, width: 800, height: 1000 });
    expect(focalCrop(1000, 1000, 0, 0.5).left).toBe(0);
    expect(focalCrop(1000, 1000, 1, 0.5).left).toBe(200);
    expect(focalCrop(800, 2000, 0.5, 1).top).toBe(1000);
  });

  it("writes three 4:5 WebP widths with no client metadata", async () => {
    const source = await sharp({ create: { width: 2000, height: 2000, channels: 3, background: "#884422" } })
      .withExif({ IFD0: { Artist: "Secret Name" } })
      .jpeg()
      .toBuffer();
    const result = await processUpload(source, 0.5, 0.5);
    expect(result.images.map((image) => image.width)).toEqual([480, 960, 1600]);
    for (const image of result.images) {
      const meta = await sharp(image.bytes).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(image.width);
      expect((meta.height ?? 0) / (meta.width ?? 1)).toBeCloseTo(1.25, 5);
      expect(meta.exif).toBeUndefined();
      expect(image.name).toMatch(UPLOAD_NAME);
    }
    expect(result.blur.startsWith("data:image/webp;base64,")).toBe(true);
    expect(result.dominant).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("puts a photo first, removes the disclosure and survives a revert", async () => {
    const { productId, colorId } = await chalk();
    const { product, color } = await chalkOwner();

    const result = await uploadMedia(uploadForm({ productId, colorId, alt: "Lintel Coat, photographed", focalX: "0.4", focalY: "0.6" }, await imageBuffer(1200, 1600)));
    if (!result.ok) throw new Error(result.message);

    expect(stored.size).toBe(3);
    expect([...stored.keys()].every((name) => UPLOAD_NAME.test(name) && !name.includes("my photo"))).toBe(true);

    const media = await getMediaFor(product, color);
    expect(media[0]).toMatchObject({ id: result.data.id, source: "upload", role: "photo", alt: "Lintel Coat, photographed", width: 1600, height: 2000 });
    expect(media[0]?.srcSet.map((src) => src.width)).toEqual([480, 960, 1600]);
    expect(needsRenderedDisclosure(media)).toBe(false);
    expect(hourImages(media)).toEqual({});

    const shop = await getProductByHandle("quiet-uzun-palto");
    expect(primaryMedia(shop!.colors[0]!.media)?.source).toBe("upload");

    expect((await revertToGenerated({ productId, colorId })).ok).toBe(true);
    const reverted = await getMediaFor(product, color);
    expect(reverted[0]?.source).toBe("generated");
    expect(needsRenderedDisclosure(reverted)).toBe(true);
    expect((await getAllMediaFor(product, color)).filter((item) => item.hidden).map((item) => item.id)).toEqual([result.data.id]);
  });

  it("refuses non-images, spoofed types, tiny images and missing files, and writes nothing", async () => {
    const { productId, colorId } = await chalk();
    const base = { productId, colorId, alt: "x" };

    const fake = uploadForm(base, Buffer.from("<?php echo 1; ?>"), "shell.png", "image/png");
    expect(await uploadMedia(fake)).toMatchObject({ ok: false, code: "validation", fieldErrors: { file: expect.stringContaining("not an image") } });

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2500"><rect width="2000" height="2500"/></svg>');
    expect(await uploadMedia(uploadForm(base, svg, "x.svg", "image/svg+xml"))).toMatchObject({ ok: false, code: "validation" });

    const tiny = await imageBuffer(300, 300);
    expect(await uploadMedia(uploadForm(base, tiny))).toMatchObject({ ok: false, fieldErrors: { file: expect.stringContaining("too small") } });

    const none = new FormData();
    for (const [key, value] of Object.entries(base)) none.set(key, value);
    expect(await uploadMedia(none)).toMatchObject({ ok: false, code: "validation" });

    const big = uploadForm(base, Buffer.alloc(MAX_UPLOAD_BYTES + 1));
    expect(await uploadMedia(big)).toMatchObject({ ok: false, fieldErrors: { file: expect.stringContaining("10 MB") } });

    const noAlt = uploadForm({ productId, colorId, alt: " " }, await imageBuffer(1000, 1000));
    expect(await uploadMedia(noAlt)).toMatchObject({ ok: false, code: "validation", fieldErrors: { alt: expect.any(String) } });

    expect(stored.size).toBe(0);
  });

  it("refuses a color from another product", async () => {
    const { colorId } = await chalk();
    const other = (await adminListProducts()).find((product) => product.slug === "nave-dress")!;
    const form = uploadForm({ productId: other.id, colorId, alt: "x" }, await imageBuffer(1000, 1000));
    expect(await uploadMedia(form)).toMatchObject({ ok: false, code: "not_found" });
  });

  it("removes written files when storage fails part way", async () => {
    const { productId, colorId } = await chalk();
    let calls = 0;
    setStorage({
      async put(name, bytes, type) {
        calls += 1;
        if (calls === 2) throw new Error("Disk full");
        return memoryStorage.put(name, bytes, type);
      },
      remove: memoryStorage.remove,
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await uploadMedia(uploadForm({ productId, colorId, alt: "x" }, await imageBuffer(1000, 1000)));
    spy.mockRestore();
    setStorage(memoryStorage);
    expect(result).toMatchObject({ ok: false, code: "error" });
    expect(stored.size).toBe(0);
  });
});

describe("hide and order", () => {
  it("hides and shows a generated image and an upload", async () => {
    const { productId, colorId } = await chalk();
    const { product, color } = await chalkOwner();
    await revertToGenerated({ productId, colorId });

    expect((await hideMedia({ colorId, mediaId: "lintel-coat/chalk/room/morning", hidden: true })).ok).toBe(true);
    expect((await getMediaFor(product, color))[0]?.id).toBe("lintel-coat/chalk/room/noon");
    expect(await hideMedia({ colorId, mediaId: "nave-dress/pearl/room/evening", hidden: true })).toMatchObject({ ok: false, code: "not_found" });

    const upload = await uploadMedia(uploadForm({ productId, colorId, alt: "Photo" }, await imageBuffer(1000, 1000)));
    if (!upload.ok) throw new Error(upload.message);
    expect((await getMediaFor(product, color))[0]?.id).toBe(upload.data.id);
    expect((await hideMedia({ colorId, mediaId: upload.data.id, hidden: true })).ok).toBe(true);
    expect((await getMediaFor(product, color))[0]?.source).toBe("generated");
    expect((await hideMedia({ colorId, mediaId: upload.data.id, hidden: false })).ok).toBe(true);
    expect((await getMediaFor(product, color))[0]?.id).toBe(upload.data.id);
  });

  it("reorders mixed media, and a generated image can lead again", async () => {
    const { productId, colorId } = await chalk();
    const { product, color } = await chalkOwner();
    await revertToGenerated({ productId, colorId });
    const upload = await uploadMedia(uploadForm({ productId, colorId, alt: "Photo" }, await imageBuffer(1000, 1000)));
    if (!upload.ok) throw new Error(upload.message);

    expect((await reorderMedia({ productId, colorId, orderedIds: ["lintel-coat/chalk/room/noon"] })).ok).toBe(true);
    const media = await getMediaFor(product, color);
    expect(media[0]?.id).toBe("lintel-coat/chalk/room/noon");
    expect(media[1]?.id).toBe(upload.data.id);
    expect(needsRenderedDisclosure(media)).toBe(true);

    expect(await reorderMedia({ productId, colorId, orderedIds: ["nonsense"] })).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("local storage", () => {
  it("refuses a name it did not generate", async () => {
    await expect(localStorage.put("../../evil.webp", Buffer.alloc(1), "image/webp")).rejects.toThrow();
  });

  it("ignores removal outside the uploads folder", async () => {
    await expect(localStorage.remove("/../../package.json")).resolves.toBeUndefined();
  });
});
