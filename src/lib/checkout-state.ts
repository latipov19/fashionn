/** State for useActionState with placeOrderAction. A "use server" file can only export functions. */

export const CHECKOUT_FIELDS = ["customerName", "phone", "email", "region", "city", "addressLine", "notes"] as const;

export type CheckoutFieldName = (typeof CHECKOUT_FIELDS)[number];

export type CheckoutState = {
  /** Shown in the summary at the top. Focus moves there. */
  message: string | null;
  /** Keys match CHECKOUT_FIELDS. */
  fieldErrors: Record<string, string>;
  /** What the shopper typed, so nothing is lost on an error. */
  values: Partial<Record<CheckoutFieldName, string>>;
  /** True when stock changed and the cart was rewritten. */
  cartChanged: boolean;
  /** True when the cart is empty and the page should send the shopper to the shop. */
  emptyCart: boolean;
};

export const initialCheckoutState: CheckoutState = {
  message: null,
  fieldErrors: {},
  values: {},
  cartChanged: false,
  emptyCart: false,
};
