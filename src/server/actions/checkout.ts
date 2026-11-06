"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copy } from "@/content/copy";
import type { CheckoutState } from "@/lib/checkout-state";
import { CHECKOUT_FIELDS } from "@/lib/checkout-state";
import type { CartLine } from "@/lib/validation";
import { readCartCookie, writeCartCookie } from "../cart";
import { placeOrder } from "../orders";
import { checkoutLimiter } from "../rate-limit";
import { getClientIp } from "../request";

/**
 * Form fields: the names in CHECKOUT_FIELDS plus a hidden `idempotencyKey`, generated once when the
 * checkout page renders. Lines come only from the cookie. On success this redirects to
 * `/order/[token]`, and it clears the cart.
 */
export async function placeOrderAction(_previous: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const values: CheckoutState["values"] = {};
  for (const field of CHECKOUT_FIELDS) {
    const entry = formData.get(field);
    if (typeof entry === "string") values[field] = entry;
  }
  const base = { values, fieldErrors: {}, cartChanged: false, emptyCart: false };

  const ip = await getClientIp();
  if (!checkoutLimiter.check(ip).allowed) return { ...base, message: copy.checkout.tooManyAttempts };

  const lines = await readCartCookie();
  const key = formData.get("idempotencyKey");

  let token: string;
  try {
    const result = await placeOrder({
      email: values.email ?? "",
      phone: values.phone,
      address: {
        fullName: values.fullName ?? "",
        line1: values.line1 ?? "",
        line2: values.line2,
        city: values.city ?? "",
        region: values.region ?? "",
        postalCode: values.postalCode ?? "",
        country: values.country ?? "",
      },
      shippingMethod: values.shippingMethod ?? "",
      idempotencyKey: typeof key === "string" ? key : "",
      lines,
    });

    if (!result.ok) {
      switch (result.code) {
        case "validation":
          return { ...base, message: result.message, fieldErrors: result.fieldErrors };
        case "empty_cart":
          return { ...base, message: result.message, emptyCart: true };
        case "payment":
          return { ...base, message: result.message };
        case "stock": {
          const next = applyShortfalls(lines, result.shortfalls);
          await writeCartCookie(next);
          revalidatePath("/", "layout");
          return { ...base, message: result.message, cartChanged: true, emptyCart: next.length === 0 };
        }
      }
    }
    token = result.order.token;
  } catch (error) {
    console.error("placeOrderAction failed", error);
    return { ...base, message: copy.micro.checkoutError };
  }

  await writeCartCookie([]);
  revalidatePath("/", "layout");
  redirect(`/order/${token}`);
}

function applyShortfalls(lines: readonly CartLine[], shortfalls: readonly { variantId: string; available: number }[]): CartLine[] {
  const available = new Map(shortfalls.map((line) => [line.variantId, line.available]));
  return lines.flatMap((line) => {
    const limit = available.get(line.variantId);
    if (limit === undefined) return [line];
    return limit > 0 ? [{ variantId: line.variantId, quantity: Math.min(line.quantity, limit) }] : [];
  });
}
