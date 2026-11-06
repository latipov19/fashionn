import { commerce } from "./commerce";
import { brand, getMessages } from "./locales";

/** The active locale's text. Only `uz` exists now, so it is resolved once. */
export const copy = getMessages();
export { brand };

/** Text for the stock line. It reads the real count and never invents urgency. */
export function stockLabel(stock: number, lowStockAt: number = commerce.lowStockAt): string {
  if (stock <= 0) return copy.micro.soldOut;
  if (stock <= lowStockAt) return copy.micro.onlyLeft(stock);
  return copy.micro.inStock;
}
