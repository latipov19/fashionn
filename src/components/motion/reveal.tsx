"use client";

import type { HTMLAttributes, ReactNode, Ref } from "react";
import { useLayoutEffect, useRef } from "react";
import { gsapNow, loadGsap } from "@/lib/gsap-client";
import { useMotionAllowed } from "@/lib/use-motion";

type Props = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  children: ReactNode;
  /** A list by default. Use `div` for a block of headings and text. */
  as?: "ul" | "div";
  [data: `data-${string}`]: string | undefined;
};

/**
 * Children rise in once, staggered, when the element scrolls into view. The hidden start state is
 * set by script, so without scripts, under reduced motion and in light mode nothing is hidden.
 */
export function Reveal({ children, as: Tag = "ul", ...rest }: Props) {
  const box = useRef<HTMLElement>(null);
  const motion = useMotionAllowed();

  useLayoutEffect(() => {
    const el = box.current;
    if (!motion || !el) return;
    let revert: (() => void) | undefined;
    let cancelled = false;

    const run = ({ gsap }: NonNullable<ReturnType<typeof gsapNow>>) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.from(el.children, {
          y: 36,
          autoAlpha: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.07,
          scrollTrigger: { trigger: el, start: "top 88%", once: true },
        });
      }, el);
      revert = () => ctx.revert();
    };

    const ready = gsapNow();
    if (ready) run(ready);
    else void loadGsap().then(run);

    return () => {
      cancelled = true;
      revert?.();
    };
  }, [motion]);

  return (
    <Tag ref={box as Ref<HTMLUListElement & HTMLDivElement>} {...rest}>
      {children}
    </Tag>
  );
}
