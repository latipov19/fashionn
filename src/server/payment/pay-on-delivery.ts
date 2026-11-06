import type { PaymentProvider } from "./provider";

/** No money moves online. The order is taken and payment stays pending until delivery. */
export const payOnDelivery: PaymentProvider = {
  id: "pay_on_delivery",
  async authorize() {
    return { ok: true, provider: "pay_on_delivery", status: "pending", reference: null };
  },
};
