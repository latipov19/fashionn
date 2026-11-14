"use client";

import { useSyncExternalStore } from "react";

/*
 * Motion gates shared by the portal, the headline swap and the scroll reveals. The server
 * snapshot is always the calm one, so the first paint never depends on scripts.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

/** False under prefers-reduced-motion, and on the server. */
export function useMotionAllowed(): boolean {
  return !useMediaQuery(REDUCED, true);
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
