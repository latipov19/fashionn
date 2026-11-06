/**
 * Payment seam. The order transaction calls `authorize` after stock is reserved. A failed
 * result rolls the whole order back. Click and Payme slot in here once merchant accounts exist.
 * A provider that bills in tiyin converts `amountUzs` itself, and it must verify signed
 * callbacks, check amount and currency on the server, and treat retries as duplicates.
 */
export type PaymentRequest = {
  idempotencyKey: string;
  amountUzs: number;
  currency: string;
  phone: string;
};

export type PaymentResult =
  | { ok: true; provider: string; status: "pending" | "paid"; reference: string | null }
  | { ok: false; provider: string };

export interface PaymentProvider {
  readonly id: string;
  authorize(request: PaymentRequest): Promise<PaymentResult>;
}
