"use client";

import Link from "next/link";
import type { CSSProperties, MouseEvent, RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Magnetic } from "@/components/motion/magnetic";
import { ButtonLink } from "@/components/ui/button";
import type { WorldSlug } from "@/content/types";
import { withWorld, worldList, worlds } from "@/content/worlds";
import { gsapNow, loadGsap } from "@/lib/gsap-client";
import { useMediaQuery, useMotionAllowed } from "@/lib/use-motion";
import type { Aperture } from "./portal";
import { Portal } from "./portal";

export type HeroCopy = {
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
  switcherLabel: string;
  openProduct: string;
  scrollCue: string;
  demoTag: string;
};

type Props = {
  initial: WorldSlug;
  copy: HeroCopy;
  apertures: Record<WorldSlug, Aperture | null>;
};

/**
 * The hero stage follows the pointer a little, and its light only travels while the hero is on
 * screen. Pointer depth needs a fine pointer and allowed motion; the pause applies always.
 */
function useHeroStage(hero: RefObject<HTMLElement | null>, stage: RefObject<HTMLDivElement | null>, motion: boolean, fine: boolean) {
  useEffect(() => {
    const section = hero.current;
    const el = stage.current;
    if (!section || !el) return;

    const observer = new IntersectionObserver(([entry]) => {
      el.dataset.inview = String(Boolean(entry?.isIntersecting));
    });
    observer.observe(section);
    if (!motion || !fine) return () => observer.disconnect();

    let frame = 0;
    let mx = 0;
    let my = 0;
    let rect = section.getBoundingClientRect();
    const apply = () => {
      frame = 0;
      el.style.setProperty("--mx", mx.toFixed(3));
      el.style.setProperty("--my", my.toFixed(3));
    };
    const enter = () => {
      rect = section.getBoundingClientRect();
    };
    const move = (event: PointerEvent) => {
      mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      my = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      frame ||= requestAnimationFrame(apply);
    };
    const leave = () => {
      mx = 0;
      my = 0;
      frame ||= requestAnimationFrame(apply);
    };

    section.addEventListener("pointerenter", enter);
    section.addEventListener("pointermove", move, { passive: true });
    section.addEventListener("pointerleave", leave);
    return () => {
      observer.disconnect();
      section.removeEventListener("pointerenter", enter);
      section.removeEventListener("pointermove", move);
      section.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
  }, [hero, stage, motion, fine]);
}

/**
 * The home page: the Sunray Portal and the world switcher. All four worlds' portal products are
 * server rendered; switching only chooses which one shows, retints the page through
 * `data-world-root`, runs the portal wave and writes `?world=` so the other pages open in it.
 */
export function HomeWorlds({ initial, copy, apertures }: Props) {
  const [active, setActive] = useState<WorldSlug>(initial);
  const world = worlds[active];
  const motion = useMotionAllowed();
  const fine = useMediaQuery("(hover: hover) and (pointer: fine)");
  const headline = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useHeroStage(hero, stage, motion, fine);

  // Warm GSAP up after first paint, so the first switch can animate without waiting.
  useEffect(() => {
    if (motion) void loadGsap();
  }, [motion]);

  // Headline swap, before paint so the new text never flashes in its final place.
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const g = gsapNow();
    const el = headline.current;
    if (!motion || !g || !el) return;
    const ctx = g.gsap.context(() => {
      g.gsap.fromTo(el.children, { yPercent: 18, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", stagger: 0.06 });
    }, el);
    return () => ctx.revert();
  }, [active, motion]);

  function choose(event: MouseEvent<HTMLAnchorElement>, slug: WorldSlug) {
    // Without scripts the link reloads the page in that world. With them, switch in place.
    event.preventDefault();
    if (slug === active) return;
    setActive(slug);
    window.history.replaceState(null, "", withWorld("/", slug));
  }

  const activeIndex = Math.max(0, worldList.findIndex((item) => item.slug === active));
  const step = (i: number) => ({ "--i": i }) as CSSProperties;

  return (
    <div data-world-root={active}>
      <section ref={hero} className="hero grain" aria-labelledby="hero-title">
        <div className="shell grid-12 hero-grid">
          <div className="hero-copy">
            <p className="kicker hero-in" style={step(0)}>
              {world.index} · {world.name} · {world.mood}
            </p>
            <div ref={headline} className="grid gap-5 hero-in" style={step(1)} aria-live="polite">
              <h1 id="hero-title" className="t-hero">
                <span className="t-slant">{world.headline}</span>
              </h1>
              <p className="t-lead measure text-muted">{world.lead}</p>
            </div>
            <div className="hero-ctas hero-in" style={step(3)}>
              <Magnetic>
                <ButtonLink href={withWorld(copy.primary.href, active)} variant="primary">
                  {copy.primary.label} <span className="arrow" aria-hidden="true">→</span>
                </ButtonLink>
              </Magnetic>
              <Magnetic>
                <ButtonLink href={withWorld(copy.secondary.href, active)} variant="secondary">
                  {copy.secondary.label}
                </ButtonLink>
              </Magnetic>
            </div>
            <nav aria-label={copy.switcherLabel} className="switcher glass-1 hero-in" style={{ ...step(4), "--active": activeIndex } as CSSProperties}>
              <span className="switcher-thumb" aria-hidden="true" />
              {worldList.map((item) => (
                <a
                  key={item.slug}
                  href={withWorld("/", item.slug)}
                  aria-current={item.slug === active ? "true" : undefined}
                  onClick={(event) => choose(event, item.slug)}
                >
                  <span className="idx">
                    <span className="dot" style={{ "--swatch": item.theme.bg } as CSSProperties} aria-hidden="true" />
                    {item.index}
                  </span>
                  <span className="name">{item.name}</span>
                </a>
              ))}
            </nav>
          </div>
          <div className="hero-portal">
            <div ref={stage} className="hero-stage" aria-hidden="true">
              <span className="stage-glow" />
              <span className="stage-dial" />
              <span className="stage-ring" />
              <span className="stage-sweep" />
            </div>
            <Portal world={active} aperture={apertures[active]} labels={{ openProduct: copy.openProduct, demoTag: copy.demoTag }} />
          </div>
        </div>
        <Link href={withWorld(copy.primary.href, active)} className="scroll-cue">
          <span className="scroll-cue-line" aria-hidden="true" />
          {copy.scrollCue}
        </Link>
      </section>
    </div>
  );
}
