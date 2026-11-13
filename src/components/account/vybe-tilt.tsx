"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useMediaQuery, useMotionAllowed } from "@/lib/use-motion";

/**
 * Lets the VYBE ID card lean toward a fine pointer. Writes two CSS variables, --tx and --ty
 * (-1 to 1), once per frame; the card's transform and sheen read them. Touch, reduced motion and
 * light mode leave the card at its resting angle.
 */
export function VybeTilt({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);
  const motion = useMotionAllowed();
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");

  useEffect(() => {
    const el = stage.current;
    if (!el || !motion || !fine) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    let rect = el.getBoundingClientRect();

    const apply = () => {
      frame = 0;
      el.style.setProperty("--tx", x.toFixed(3));
      el.style.setProperty("--ty", y.toFixed(3));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(apply);
    };
    const enter = () => {
      rect = el.getBoundingClientRect();
    };
    const move = (event: PointerEvent) => {
      x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
      y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      schedule();
    };
    const leave = () => {
      x = 0;
      y = 0;
      schedule();
    };

    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointermove", move, { passive: true });
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--tx");
      el.style.removeProperty("--ty");
    };
  }, [motion, fine]);

  return (
    <div ref={stage} className="vybe-stage">
      {children}
    </div>
  );
}
