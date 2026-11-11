"use client";

import { useLayoutEffect, useRef } from "react";
import { gsapNow, loadGsap } from "@/lib/gsap-client";
import { useMotionAllowed } from "@/lib/use-motion";

/**
 * A heading whose words rise out of their own line boxes once, when it scrolls into view. The
 * heading is named by its full text, so assistive technology reads one sentence, not fragments.
 * Without scripts, under reduced motion and in light mode, the words simply stand.
 */
export function RevealWords({ text, id, className, as: Heading = "h2" }: { text: string; id?: string; className?: string; as?: "h1" | "h2" }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const motion = useMotionAllowed();

  useLayoutEffect(() => {
    const el = heading.current;
    if (!motion || !el) return;
    let revert: (() => void) | undefined;
    let cancelled = false;

    const run = ({ gsap }: NonNullable<ReturnType<typeof gsapNow>>) => {
      if (cancelled) return;
      const ctx = gsap.context(() => {
        gsap.from(el.querySelectorAll(".rw-inner"), {
          yPercent: 110,
          duration: 0.9,
          ease: "power4.out",
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
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

  const words = text.split(/\s+/).filter(Boolean);

  return (
    <Heading ref={heading} id={id} className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true">
          <span className="rw-word">
            <span className="rw-inner">{word}</span>
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </Heading>
  );
}
