/** Prices are integer cents everywhere. Formatting happens only at the edge. */

const whole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const exact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `92000` becomes `$920`, and `92050` becomes `$920.50`. */
export function formatCents(cents: number): string {
  return (cents % 100 === 0 ? whole : exact).format(cents / 100);
}

export function usdToCents(usd: number): number {
  return Math.round(usd * 100);
}

/** Parses an admin-typed price such as `920` or `920.50`. Returns null when it is not a price. */
export function parsePriceToCents(input: string): number | null {
  const match = /^\s*\$?\s*(\d{1,7})(?:\.(\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  return dollars * 100 + cents;
}

export type Totals = {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

/** Tax is a whole number of cents, rounded half up, from basis points of the subtotal. */
export function calculateTotals(
  lines: readonly { unitPriceCents: number; quantity: number }[],
  shippingCents: number,
  taxBasisPoints: number,
): Totals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const taxCents = Math.round((subtotalCents * taxBasisPoints) / 10_000);
  return { subtotalCents, shippingCents, taxCents, totalCents: subtotalCents + shippingCents + taxCents };
}
