"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { WorldSlug } from "@/content/types";
import { withWorld, worldOr } from "@/content/worlds";

export type NavItem = { href: string; label: string };

/** True when the item is the current page or a page inside its section. The home page matches only itself. */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The world in the address bar, so links between pages keep it. The hero's switcher updates it in place. */
export function useCurrentWorld(): WorldSlug {
  return worldOr(useSearchParams().get("world"));
}

/** Desktop navigation. The current page keeps the glass pill that hover shows elsewhere. */
export function NavLinks({ items, label }: { items: readonly NavItem[]; label: string }) {
  const pathname = usePathname();
  const world = useCurrentWorld();

  return (
    <nav aria-label={label} className="nav-links">
      {items.map((item) => (
        <Link
          key={item.href}
          href={withWorld(item.href, world)}
          className="nav-link"
          aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** The same links before the address bar is known: default world, nothing marked current. */
export function NavLinksFallback({ items, label }: { items: readonly NavItem[]; label: string }) {
  return (
    <nav aria-label={label} className="nav-links">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="nav-link">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
