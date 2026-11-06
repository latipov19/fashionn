/**
 * Store settings the client will replace. Prices are integer cents. Shipping and tax come
 * from this server config (brief section 15). Tax stays at zero until the client's tax
 * position is known. The bracketed note is a placeholder, like the policy text.
 */
export const commerce = {
  currency: "USD",
  taxBasisPoints: 0,
  maxCartLines: 20,
  maxLineQuantity: 10,
  /** Variants at or under this count show "Only N left". */
  lowStockAt: 2,
  seedStockPerVariant: 8,
  shippingMethods: [{ id: "standard", label: "Standard delivery", note: "[3 to 7] working days", cents: 1800 }],
} as const;

export type ShippingMethodId = (typeof commerce.shippingMethods)[number]["id"];

export function shippingMethodById(id: string) {
  return commerce.shippingMethods.find((method) => method.id === id);
}
