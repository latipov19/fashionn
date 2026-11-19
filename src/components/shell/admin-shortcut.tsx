"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * A key combination to the staff panel, so the owner never types the address: Ctrl+Shift+A
 * (Cmd+Shift+A on a Mac) on any shop page. Nothing on screen points to it. It is a convenience,
 * not a lock: /admin still asks for a staff sign-in, and every page and action there checks it.
 *
 * The physical key is read (`code`), so it works whatever the keyboard layout. The page claims
 * the combination before the browser does, where the browser allows it.
 */
export function AdminShortcut() {
  const router = useRouter();
  const pathname = usePathname();
  const inPanel = pathname === "/admin" || pathname?.startsWith("/admin/");

  useEffect(() => {
    if (inPanel) return;
    function onKey(event: KeyboardEvent) {
      if (event.repeat || event.altKey || !event.shiftKey || !(event.ctrlKey || event.metaKey) || event.code !== "KeyA") return;
      event.preventDefault();
      router.push("/admin");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inPanel, router]);

  return null;
}
