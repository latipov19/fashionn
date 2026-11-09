"use client";

import type { gsap as Gsap } from "gsap";
import type { ScrollTrigger as ScrollTriggerType } from "gsap/ScrollTrigger";

/*
 * GSAP is loaded once, on demand, after first paint. Components that animate ask for it here;
 * if it is already loaded they get it synchronously, so an animation can start before paint.
 */

type Loaded = { gsap: typeof Gsap; ScrollTrigger: typeof ScrollTriggerType };

let loaded: Loaded | null = null;
let pending: Promise<Loaded> | null = null;

export function loadGsap(): Promise<Loaded> {
  pending ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([core, plugin]) => {
    core.gsap.registerPlugin(plugin.ScrollTrigger);
    loaded = { gsap: core.gsap, ScrollTrigger: plugin.ScrollTrigger };
    return loaded;
  });
  return pending;
}

export const gsapNow = (): Loaded | null => loaded;
