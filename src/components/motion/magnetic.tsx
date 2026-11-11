"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useMediaQuery, useMotionAllowed } from "@/lib/use-motion";

/**
 * Leans its child a little toward the pointer. Only with a fine pointer that can hover and when
 * motion is allowed; on touch, under reduced motion and in light mode the child stays put.
 * One rAF write per frame, transform only.
 */
export function Magnetic({ children, strength = 0.22 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motion = useMotionAllowed();
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");

  useEffect(() => {
    const el = ref.current;
    if (!el || !motion || !fine) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    let centre = { x: 0, y: 0 };

    const apply = () => {
      frame = 0;
      el.style.transform = x || y ? `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` : "";
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(apply);
    };
    // Measured once per entry, before any lean, so the pull never feeds back on itself.
    const enter = () => {
      const rect = el.getBoundingClientRect();
      centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const move = (event: PointerEvent) => {
      x = (event.clientX - centre.x) * strength;
      y = (event.clientY - centre.y) * strength;
      schedule();
    };
    const leave = () => {
      x = 0;
      y = 0;
      schedule();
    };

    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, [motion, fine, strength]);

  return (
    <span ref={ref} className="magnetic">
      {children}
    </span>
  );
}
