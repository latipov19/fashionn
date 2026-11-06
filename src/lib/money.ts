/**
 * Money is an integer number of whole soʻm everywhere. Tiyin are not used: a provider that
 * needs them converts inside its own adapter. Formatting is by hand, not Intl, so server and
 * client always print the same string, and the separator is a no-break space.
 */
const NBSP = " ";

export function formatUzs(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${digits}${NBSP}soʻm`;
}

/** Reads an admin-typed price such as `590 000`. Returns null when it is not a whole amount. */
export function parseUzs(input: string): number | null {
  const compact = input.replace(/[\s ]/g, "").replace(/soʻm$/i, "");
  if (!/^\d{1,10}$/.test(compact)) return null;
  const value = Number(compact);
  return Number.isSafeInteger(value) ? value : null;
}

export type Totals = {
  subtotalUzs: number;
  deliveryUzs: number;
  totalUzs: number;
};

export function calculateTotals(lines: readonly { unitPriceUzs: number; quantity: number }[], deliveryUzs: number): Totals {
  const subtotalUzs = lines.reduce((sum, line) => sum + line.unitPriceUzs * line.quantity, 0);
  return { subtotalUzs, deliveryUzs, totalUzs: subtotalUzs + deliveryUzs };
}

/** Whole percent off, or null when there is no real discount to show. */
export function discountPercent(priceUzs: number, compareAtUzs: number | null): number | null {
  if (!compareAtUzs || compareAtUzs <= priceUzs) return null;
  return Math.round(((compareAtUzs - priceUzs) / compareAtUzs) * 100);
}
