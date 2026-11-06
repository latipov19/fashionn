import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { commerce } from "@/content/commerce";
import { copy } from "@/content/copy";
import type { CartActionState } from "@/server/actions/cart";
import { addToCartAction, removeCartLineAction, updateCartLineAction } from "@/server/actions/cart";
import { placeOrderAction } from "@/server/actions/checkout";
import { initialCheckoutState } from "@/lib/checkout-state";
import { CART_COOKIE, getCart, parseCartCookie, serializeCart } from "@/server/cart";
import { closeDb, getDb } from "@/server/db/client";
import { products } from "@/server/db/schema";
import { resetRateLimits } from "@/server/rate-limit";
import { forceStock, jar, orderCount, stockOf, uniqueKey, variantOf } from "./helpers";

beforeAll(async () => {
  await getDb();
});
afterAll(closeDb);

const idle: CartActionState = { status: "idle" };
const form = (fields: Record<string, string | number>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
};
const setCookie = (value: string) => jar().set(CART_COOKIE, { value });
const cookieLines = () => parseCartCookie(jar().get(CART_COOKIE)?.value);

describe("cart cookie tampering", () => {
  const id = randomUUID();

  it("round trips and holds only ids and quantities", () => {
    const raw = serializeCart([{ variantId: id, quantity: 2 }]);
    expect(JSON.parse(raw)).toEqual([[id, 2]]);
    expect(parseCartCookie(raw)).toEqual([{ variantId: id, quantity: 2 }]);
  });

  it("drops anything malformed", () => {
    for (const raw of [undefined, "", "not json", "{}", "null", "42", '"x"', `{"${id}":1}`, "x".repeat(5000)]) {
      expect(parseCartCookie(raw)).toEqual([]);
    }
  });

  it("drops bad ids and quantities line by line, and keeps good lines", () => {
    const raw = JSON.stringify([
      [id, 1],
      ["'; drop table variants; --", 1],
      [randomUUID(), 0],
      [randomUUID(), -3],
      [randomUUID(), 1.5],
      [randomUUID(), "1e9"],
      [randomUUID(), 11],
      [null, null],
      "line",
    ]);
    expect(parseCartCookie(raw)).toEqual([{ variantId: id, quantity: 1 }]);
  });

  it("ignores extra fields such as a price", () => {
    expect(parseCartCookie(JSON.stringify([[id, 2, { priceUzs: 1 }]]))).toEqual([{ variantId: id, quantity: 2 }]);
  });

  it("merges duplicates, caps the quantity and caps lines at 20", () => {
    expect(
      parseCartCookie(
        JSON.stringify([
          [id, 6],
          [id, 7],
        ]),
      ),
    ).toEqual([{ variantId: id, quantity: commerce.maxLineQuantity }]);

    const many = Array.from({ length: 40 }, () => [randomUUID(), 1]);
    expect(parseCartCookie(JSON.stringify(many))).toHaveLength(20);
    expect(JSON.parse(serializeCart(many.map(([variantId]) => ({ variantId: variantId as string, quantity: 1 }))))).toHaveLength(20);
  });

  it("prices a tampered cart from the database, dropping unknown variants", async () => {
    const coat = await variantOf("quiet-uzun-palto", "slate", "S");
    setCookie(JSON.stringify([[coat.id, 2, 1], [randomUUID(), 3]]));
    const cart = await getCart();
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ unitPriceUzs: 92_000, lineTotalUzs: 184_000, productName: "Lintel Coat", colorName: "Slate", size: "S" });
    expect(cart.subtotalUzs).toBe(184_000);
    expect(cart.count).toBe(2);
    expect(cart.changed).toBe(true);
  });
});

describe("cart view", () => {
  it("caps a line at current stock and flags the change", async () => {
    const variant = await variantOf("transom-cape", "oat", "One size");
    await forceStock(variant.id, 1);
    setCookie(serializeCart([{ variantId: variant.id, quantity: 3 }]));
    const cart = await getCart();
    expect(cart.lines[0]).toMatchObject({ quantity: 1, requestedQuantity: 3, stock: 1, lineTotalUzs: 68_000 });
    expect(cart.changed).toBe(true);
  });

  it("treats an unpublished product as unavailable", async () => {
    const variant = await variantOf("transom-cape", "fir", "One size");
    const db = await getDb();
    await db.update(products).set({ published: false }).where(eq(products.slug, "transom-cape"));
    setCookie(serializeCart([{ variantId: variant.id, quantity: 1 }]));
    const cart = await getCart();
    expect(cart.lines[0]).toMatchObject({ quantity: 0, stock: 0, lineTotalUzs: 0 });
    await db.update(products).set({ published: true }).where(eq(products.slug, "transom-cape"));
  });
});

describe("cart actions", () => {
  it("adds, merges and stays within stock", async () => {
    const variant = await variantOf("purlin-vest", "black", "M");
    await forceStock(variant.id, 3);

    expect(await addToCartAction(idle, form({ variantId: variant.id, quantity: 2 }))).toEqual({ status: "added", message: copy.micro.added });
    expect(cookieLines()).toEqual([{ variantId: variant.id, quantity: 2 }]);
    expect(jar().get(CART_COOKIE)?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });

    expect(await addToCartAction(idle, form({ variantId: variant.id, quantity: 2 }))).toEqual({ status: "added", message: "Only 3 left" });
    expect(cookieLines()).toEqual([{ variantId: variant.id, quantity: 3 }]);
  });

  it("refuses sold out, unknown and malformed input", async () => {
    const variant = await variantOf("purlin-vest", "black", "L");
    await forceStock(variant.id, 0);
    expect(await addToCartAction(idle, form({ variantId: variant.id }))).toEqual({ status: "error", message: copy.micro.soldOut });
    expect(await addToCartAction(idle, form({ variantId: randomUUID() }))).toEqual({ status: "error", message: copy.micro.soldOut });
    expect(await addToCartAction(idle, form({ variantId: "x" }))).toEqual({ status: "error", message: copy.micro.addFailed });
    expect(await addToCartAction(idle, form({ variantId: variant.id, quantity: 999 }))).toMatchObject({ status: "error" });
    expect(jar().has(CART_COOKIE)).toBe(false);
  });

  it("refuses a 21st line", async () => {
    const variant = await variantOf("purlin-vest", "flax", "L");
    setCookie(serializeCart(Array.from({ length: 20 }, () => ({ variantId: randomUUID(), quantity: 1 }))));
    expect(await addToCartAction(idle, form({ variantId: variant.id }))).toEqual({ status: "error", message: copy.cart.full });
  });

  it("updates, caps, removes at zero and removes outright", async () => {
    const a = await variantOf("arcade-trouser", "clay", "28");
    const b = await variantOf("arcade-trouser", "clay", "30");
    await forceStock(a.id, 4);
    setCookie(serializeCart([{ variantId: a.id, quantity: 1 }, { variantId: b.id, quantity: 1 }]));

    expect(await updateCartLineAction(idle, form({ variantId: a.id, quantity: 3 }))).toEqual({ status: "updated" });
    expect(cookieLines()[0]?.quantity).toBe(3);

    expect(await updateCartLineAction(idle, form({ variantId: a.id, quantity: 9 }))).toEqual({ status: "updated", message: "Only 4 left" });
    expect(cookieLines()[0]?.quantity).toBe(4);

    expect(await updateCartLineAction(idle, form({ variantId: a.id, quantity: 0 }))).toEqual({ status: "removed" });
    expect(cookieLines()).toEqual([{ variantId: b.id, quantity: 1 }]);

    expect(await removeCartLineAction(idle, form({ variantId: b.id }))).toEqual({ status: "removed" });
    expect(jar().has(CART_COOKIE)).toBe(false);
  });
});

describe("checkout action", () => {
  const details = (key: string) => ({
    email: "shopper@example.com",
    fullName: "Ana Shopper",
    line1: "1 Long Street",
    city: "Portland",
    region: "OR",
    postalCode: "97201",
    country: "United States",
    shippingMethod: "standard",
    idempotencyKey: key,
  });

  it("reads lines from the cookie only, clears the cart and redirects", async () => {
    resetRateLimits();
    const variant = await variantOf("cornice-scarf", "rose-clay", "One size");
    setCookie(serializeCart([{ variantId: variant.id, quantity: 1 }]));
    const data = form(details(uniqueKey()));
    data.set("lines", JSON.stringify([{ variantId: randomUUID(), quantity: 5 }]));
    data.set("totalUzs", "1");

    await expect(placeOrderAction(initialCheckoutState, data)).rejects.toMatchObject({ url: expect.stringMatching(/^\/order\/[\w-]{43}$/) });
    expect(jar().has(CART_COOKIE)).toBe(false);
    expect(await stockOf(variant.id)).toBe(variant.stock - 1);
  });

  it("a double submit lands on the same order even though the cookie is gone", async () => {
    resetRateLimits();
    const variant = await variantOf("cornice-scarf", "saffron", "One size");
    setCookie(serializeCart([{ variantId: variant.id, quantity: 1 }]));
    const data = form(details(uniqueKey()));
    const first = await placeOrderAction(initialCheckoutState, data).catch((error) => error);
    const second = await placeOrderAction(initialCheckoutState, data).catch((error) => error);
    expect(second.url).toBe(first.url);
    expect(await stockOf(variant.id)).toBe(variant.stock - 1);
  });

  it("keeps typed values and field errors, and takes nothing", async () => {
    resetRateLimits();
    const variant = await variantOf("apse-skirt", "camel", "M");
    setCookie(serializeCart([{ variantId: variant.id, quantity: 1 }]));
    const state = await placeOrderAction(initialCheckoutState, form({ ...details(uniqueKey()), email: "nope" }));
    expect(state.values.email).toBe("nope");
    expect(state.values.city).toBe("Portland");
    expect(state.fieldErrors.email).toBe(copy.forms.email);
    expect(await stockOf(variant.id)).toBe(variant.stock);
  });

  it("rewrites the cart and says so when stock has changed", async () => {
    resetRateLimits();
    const variant = await variantOf("apse-skirt", "camel", "L");
    await forceStock(variant.id, 1);
    setCookie(serializeCart([{ variantId: variant.id, quantity: 3 }]));
    const state = await placeOrderAction(initialCheckoutState, form(details(uniqueKey())));
    expect(state.message).toBe("Only 1 left in this size. We changed your cart.");
    expect(state.cartChanged).toBe(true);
    expect(cookieLines()).toEqual([{ variantId: variant.id, quantity: 1 }]);
  });

  it("is rate limited", async () => {
    resetRateLimits();
    const before = await orderCount();
    let last = initialCheckoutState;
    for (let i = 0; i < 11; i += 1) last = await placeOrderAction(initialCheckoutState, form(details(uniqueKey())));
    expect(last.message).toBe(copy.checkout.tooManyAttempts);
    expect(await orderCount()).toBe(before);
  });
});
