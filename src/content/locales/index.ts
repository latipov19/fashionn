import type { Messages } from "./uz";
import { uz } from "./uz";

/**
 * Adding Russian or English: write `ru.ts` typed as `Messages`, register it here, and choose
 * the locale per request. Product text gains a translations table at the same time.
 */
export const locales = ["uz"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "uz";

const messages: Record<Locale, Messages> = { uz };

export const getMessages = (locale: Locale = defaultLocale): Messages => messages[locale];

export { brand } from "./uz";
export type { Messages } from "./uz";
