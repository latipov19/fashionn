"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * The shop's header and footer, left out of the admin panel, which has its own navigation.
 * The pathname is known while the server renders, so neither side flashes the other's chrome.
 */
export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return null;
  return children;
}
