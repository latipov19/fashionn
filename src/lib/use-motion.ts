"use client";

import { useSyncExternalStore } from "react";
import { LITE_KEY } from "./lite";

/*
 * Motion gates shared by the portal, the headline swap and the scroll reveals. The server
 * snapshot is always the calm one, so the first paint never depends on scripts.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lite"] });
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", onChange);
  };
}

export const isLite = () => document.documentElement.dataset.lite === "on";
const motionAllowed = () => !isLite() && !window.matchMedia(REDUCED).matches;

/** False under prefers-reduced-motion, in light mode, and on the server. */
export function useMotionAllowed(): boolean {
  return useSyncExternalStore(subscribeMotion, motionAllowed, () => false);
}

/** True when the site's light mode is on. */
export function useLiteMode(): boolean {
  return useSyncExternalStore(subscribeMotion, isLite, () => false);
}

export function setLiteMode(on: boolean) {
  if (on) document.documentElement.dataset.lite = "on";
  else delete document.documentElement.dataset.lite;
  try {
    window.localStorage.setItem(LITE_KEY, on ? "on" : "off");
  } catch {
    // Storage can be blocked. The setting then lasts for this page only.
  }
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
