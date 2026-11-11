import { copy } from "./copy";

/**
 * The store's world pages, in reading order. The header, the phone menu, the footer and each
 * page's "next" link read this list, so adding a page is one line here plus its route.
 */
export const pages = [
  { key: "home", href: "/", label: copy.nav.pages.home },
  { key: "drop", href: "/drop", label: copy.nav.pages.drop },
  { key: "showroom", href: "/showroom", label: copy.nav.pages.showroom },
  { key: "look", href: "/look", label: copy.nav.pages.look },
  { key: "about", href: "/about", label: copy.nav.pages.about },
] as const;

export type PageKey = (typeof pages)[number]["key"];

/** The page after this one, wrapping from the last back to the first. */
export function nextPage(key: PageKey) {
  const index = pages.findIndex((page) => page.key === key);
  return pages[(index + 1) % pages.length]!;
}
