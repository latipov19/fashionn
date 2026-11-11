import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { copy } from "@/content/copy";
import { closeDb, getDb } from "@/server/db/client";
import { orderItems, products } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { PlaceOrderInput } from "@/lib/validation";
import { adminGetOrder, adminListOrders, cancelOrder, getOrderByToken, placeOrder, setOrderStatus } from "@/server/orders";
import type { PaymentProvider } from "@/server/payment/provider";
import { checkoutInput, forceStock, orderCount, signIn, stockOf, uniqueKey, variantOf } from "./helpers";

beforeAll(async () => {
  await getDb();
});
afterAll(closeDb);

async function mustPlace(input: PlaceOrderInput) {
  const result = await placeOrder(input);
  if (!result.ok) throw new Error(`Expected an order, got ${result.code}`);
  return result;
}

describe("totals", () => {
  it("ignores every price the client sends", async () => {
    const coat = await variantOf("quiet-uzun-palto", "tosh", "M");
    const tote = await variantOf("signal-tote", "sut", "Yagona");
    const tampered = {
      ...checkoutInput([
        { variantId: coat.id, quantity: 2, unitPriceUzs: 1, priceUzs: 1 } as never,
        { variantId: tote.id, quantity: 1, unitPriceUzs: 1 } as never,
      ]),
      subtotalUzs: 1,
      totalUzs: 1,
      deliveryUzs: 0,
    };

    const { order } = await mustPlace(tampered as PlaceOrderInput);

    expect(order.subtotalUzs).toBe(1_890_000 * 2 + 320_000);
    expect(order.deliveryUzs).toBe(30_000);
    expect(order.totalUzs).toBe(4_100_000 + 30_000);
    expect(order.lines.map((line) => line.unitPriceUzs).sort((a, b) => a - b)).toEqual([320_000, 1_890_000]);
    expect(order.phone).toBe("+998901234567");
    expect(order.address).toEqual({ region: "toshkent-shahri", city: "Toshkent", line: "Chilonzor 9, 12-uy" });
    expect(order.deliveryZone).toBe("tashkent");
    expect(order.status).toBe("pending");
    expect(order.email).toBe("shopper@example.com");
    expect(order.paymentProvider).toBe("pay_on_delivery");
    expect(order.paymentStatus).toBe("pending");
    expect(order.number).toMatch(/^VV-\d{6}$/);
  });

  it("sums duplicate lines before taking stock", async () => {
    const variant = await variantOf("noir-oversize-hudi", "qora", "S");
    await forceStock(variant.id, 3);
    const { order } = await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 2 }, { variantId: variant.id, quantity: 1 }]));
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]?.quantity).toBe(3);
    expect(await stockOf(variant.id)).toBe(0);
  });
});

describe("stock", () => {
  it("decrements in the same transaction as the order", async () => {
    const variant = await variantOf("still-zigir-koylak", "sut", "S");
    const before = variant.stock;
    await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 2 }]));
    expect(await stockOf(variant.id)).toBe(before - 2);
  });

  it("lets exactly one of two orders take the last unit", async () => {
    const variant = await variantOf("calm-keng-shim", "qum", "M");
    await forceStock(variant.id, 1);
    const before = await orderCount();

    const results = await Promise.all([
      placeOrder(checkoutInput([{ variantId: variant.id, quantity: 1 }])),
      placeOrder(checkoutInput([{ variantId: variant.id, quantity: 1 }])),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const loser = results.find((result) => !result.ok);
    expect(loser).toMatchObject({ ok: false, code: "stock", message: copy.checkout.stockChanged(0) });
    expect(await stockOf(variant.id)).toBe(0);
    expect(await orderCount()).toBe(before + 1);
  });

  it("rolls the whole order back when one line lacks stock", async () => {
    const plenty = await variantOf("drift-midi-yubka", "sut", "M");
    const short = await variantOf("drift-midi-yubka", "tosh", "M");
    await forceStock(plenty.id, 5);
    await forceStock(short.id, 1);
    const before = await orderCount();

    const result = await placeOrder(
      checkoutInput([
        { variantId: plenty.id, quantity: 2 },
        { variantId: short.id, quantity: 2 },
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      code: "stock",
      message: copy.checkout.stockChanged(1),
      shortfalls: [{ variantId: short.id, requested: 2, available: 1 }],
    });
    expect(await stockOf(plenty.id)).toBe(5);
    expect(await stockOf(short.id)).toBe(1);
    expect(await orderCount()).toBe(before);
  });

  it("rolls back when payment is refused", async () => {
    const variant = await variantOf("vector-texnik-shim", "komir", "S");
    const refusing: PaymentProvider = { id: "test", authorize: async () => ({ ok: false, provider: "test" }) };
    const before = await orderCount();
    const result = await placeOrder(checkoutInput([{ variantId: variant.id, quantity: 1 }]), refusing);
    expect(result).toMatchObject({ ok: false, code: "payment", message: copy.micro.checkoutError });
    expect(await stockOf(variant.id)).toBe(variant.stock);
    expect(await orderCount()).toBe(before);
  });

  it("refuses an empty cart and invalid details", async () => {
    expect(await placeOrder(checkoutInput([]))).toMatchObject({ ok: false, code: "empty_cart" });
    const variant = await variantOf("vector-texnik-shim", "komir", "M");
    const bad = checkoutInput([{ variantId: variant.id, quantity: 1 }]);
    const result = await placeOrder({ ...bad, email: "nope", city: " " });
    expect(result).toMatchObject({ ok: false, code: "validation" });
    if (!result.ok && result.code === "validation") {
      expect(result.fieldErrors.email).toBe(copy.forms.email);
      expect(result.fieldErrors.city).toBe(copy.forms.required);
    }
    expect(await stockOf(variant.id)).toBe(variant.stock);
  });
});

describe("idempotency", () => {
  it("returns the first order for a repeated key and takes stock once", async () => {
    const variant = await variantOf("grid-termo-futbolka", "komir", "S");
    const before = await orderCount();
    const key = uniqueKey();
    const input = checkoutInput([{ variantId: variant.id, quantity: 1 }], key);

    const first = await mustPlace(input);
    const second = await mustPlace(input);

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(second.order.token).toBe(first.order.token);
    expect(second.order.lines).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(variant.stock - 1);
    expect(await orderCount()).toBe(before + 1);
  });

  it("handles a double submit racing itself", async () => {
    const variant = await variantOf("grid-termo-futbolka", "kumush", "S");
    const key = uniqueKey();
    const input = checkoutInput([{ variantId: variant.id, quantity: 1 }], key);

    const [a, b] = await Promise.all([placeOrder(input), placeOrder(input)]);
    if (!a.ok || !b.ok) throw new Error("Both submits should succeed");
    expect(a.order.id).toBe(b.order.id);
    expect(await stockOf(variant.id)).toBe(variant.stock - 1);
  });

  it("still returns the order after the first submit cleared the cart", async () => {
    const variant = await variantOf("field-ish-kurtka", "zaytun", "S");
    const key = uniqueKey();
    const first = await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 1 }], key));
    const second = await mustPlace(checkoutInput([], key));
    expect(second.order.id).toBe(first.order.id);
  });
});

describe("confirmation token", () => {
  it("is at least 32 random bytes and is the only public lookup", async () => {
    const variant = await variantOf("field-ish-kurtka", "loy", "M");
    const { order } = await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 1 }]));
    expect(Buffer.from(order.token, "base64url").length).toBeGreaterThanOrEqual(32);
    expect((await getOrderByToken(order.token))?.id).toBe(order.id);
    expect(await getOrderByToken(order.number)).toBeNull();
    expect(await getOrderByToken("A".repeat(43))).toBeNull();
    expect(await getOrderByToken("")).toBeNull();
  });
});

describe("status changes", () => {
  it("walks the happy path and lists for admin", async () => {
    await signIn();
    const variant = await variantOf("mono-shell-kurtka", "komir", "S");
    const { order } = await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 2 }]));

    expect(await setOrderStatus(order.id, "confirmed")).toEqual({ ok: true, status: "confirmed" });
    expect(await setOrderStatus(order.id, "packed")).toEqual({ ok: true, status: "packed" });
    expect(await setOrderStatus(order.id, "shipped")).toEqual({ ok: true, status: "shipped" });
    expect(await setOrderStatus(order.id, "delivered")).toEqual({ ok: true, status: "delivered" });
    expect(await stockOf(variant.id)).toBe(variant.stock - 2);

    const list = await adminListOrders();
    const row = list.find((item) => item.id === order.id);
    expect(row).toMatchObject({ status: "delivered", itemCount: 2, number: order.number });
    expect(row).not.toHaveProperty("token");
    expect((await adminGetOrder(order.id))?.lines[0]?.quantity).toBe(2);
    expect((await adminListOrders({ status: "delivered" })).every((item) => item.status === "delivered")).toBe(true);

    // A return after delivery brings the stock back, once.
    expect(await setOrderStatus(order.id, "returned")).toEqual({ ok: true, status: "returned" });
    expect(await stockOf(variant.id)).toBe(variant.stock);
    expect(await setOrderStatus(order.id, "returned")).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(await stockOf(variant.id)).toBe(variant.stock);
  });

  it("refuses invalid changes", async () => {
    await signIn();
    const variant = await variantOf("mono-shell-kurtka", "kumush", "M");
    const { order } = await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 1 }]));

    expect(await setOrderStatus(order.id, "shipped")).toEqual({ ok: false, code: "invalid_transition", from: "pending", to: "shipped" });
    expect(await setOrderStatus(order.id, "delivered")).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(await setOrderStatus(order.id, "pending")).toMatchObject({ ok: false, code: "invalid_transition" });

    await setOrderStatus(order.id, "confirmed");
    expect(await setOrderStatus(order.id, "shipped")).toMatchObject({ ok: false, code: "invalid_transition" });
    await setOrderStatus(order.id, "packed");
    expect(await setOrderStatus(order.id, "packed")).toMatchObject({ ok: false, code: "invalid_transition" });
    await setOrderStatus(order.id, "shipped");
    expect(await cancelOrder(order.id)).toEqual({ ok: false, code: "invalid_transition", from: "shipped", to: "canceled" });
    await setOrderStatus(order.id, "delivered");
    expect(await setOrderStatus(order.id, "shipped")).toMatchObject({ ok: false, code: "invalid_transition" });

    expect(await setOrderStatus("00000000-0000-4000-8000-000000000000", "packed")).toEqual({ ok: false, code: "not_found" });
  });

  it("restores stock on cancel exactly once", async () => {
    await signIn();
    const variant = await variantOf("alloy-krossovka", "kumush", "40");
    const other = await variantOf("orbit-sling", "kumush", "Yagona");
    const { order } = await mustPlace(
      checkoutInput([
        { variantId: variant.id, quantity: 3 },
        { variantId: other.id, quantity: 1 },
      ]),
    );
    expect(await stockOf(variant.id)).toBe(variant.stock - 3);

    expect(await cancelOrder(order.id)).toEqual({ ok: true, status: "canceled" });
    expect(await stockOf(variant.id)).toBe(variant.stock);
    expect(await stockOf(other.id)).toBe(other.stock);

    expect(await cancelOrder(order.id)).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(await setOrderStatus(order.id, "canceled")).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(await setOrderStatus(order.id, "packed")).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(await stockOf(variant.id)).toBe(variant.stock);
  });

  it("restores stock once when two cancels race", async () => {
    await signIn();
    const variant = await variantOf("alloy-krossovka", "kumush", "41");
    const { order } = await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 2 }]));
    const results = await Promise.all([cancelOrder(order.id), cancelOrder(order.id)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(variant.stock);
  });

  it("keeps the price paid even if the product is repriced later", async () => {
    await signIn();
    const variant = await variantOf("pulse-kepka", "loy", "Yagona");
    const { order } = await mustPlace(checkoutInput([{ variantId: variant.id, quantity: 1 }]));
    const db = await getDb();
    await db.update(products).set({ priceUzs: 1, name: "Renamed" }).where(eq(products.handle, "pulse-kepka"));
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    expect(items[0]).toMatchObject({ unitPriceUzs: 190_000, productName: "Pulse Kepka", colorName: "Loy", size: "Yagona" });
    expect((await adminGetOrder(order.id))?.totalUzs).toBe(190_000 + 30_000);
  });
});
