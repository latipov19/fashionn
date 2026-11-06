/**
 * Payment seam. The order transaction calls `authorize` after stock is reserved. A failed
 * result rolls the whole order back. Stripe slots in here later.
 */
export type PaymentRequest = {
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  email: string;
};

export type PaymentResult =
  | { ok: true; provider: string; status: "pending" | "paid"; reference: string | null }
  | { ok: false; provider: string };

export interface PaymentProvider {
  readonly id: string;
  authorize(request: PaymentRequest): Promise<PaymentResult>;
}
