"use client";

import type { MouseEvent, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Reveal } from "@/components/motion/reveal";
import { ButtonLink } from "@/components/ui/button";
import type { WorldSlug } from "@/content/types";
import { worldList, worlds } from "@/content/worlds";
import { gsapNow, loadGsap } from "@/lib/gsap-client";
import { useMotionAllowed } from "@/lib/use-motion";
import type { Aperture } from "./portal";
import { Portal } from "./portal";
import type { ShowroomCopy, ShowroomItem } from "./showroom";
import { Showroom } from "./showroom";

export type HomeCopy = {
  explore: string;
  shopFast: string;
  switcherLabel: string;
  openProduct: string;
  demoTag: string;
  drop: { kicker: string; title: string; all: string[] };
  showroom: ShowroomCopy;
  look: { kicker: string; title: string; body: string; total: string };
};

type Props = {
  initial: WorldSlug;
  copy: HomeCopy;
  apertures: Record<WorldSlug, Aperture | null>;
  drops: Record<WorldSlug, ReactNode>;
  showrooms: Record<WorldSlug, ShowroomItem[]>;
  looks: Record<WorldSlug, { items: ReactNode; total: string } | null>;
};

/**
 * The world-dependent part of the home page: hero, The Current Drop and the look. Everything
 * is server rendered for all four worlds. Switching only chooses which one shows, retints the
 * page through `data-world-root`, and runs the portal wave.
 */
export function HomeWorlds({ initial, copy, apertures, drops, showrooms, looks }: Props) {
  const [active, setActive] = useState<WorldSlug>(initial);
  const world = worlds[active];
  const motion = useMotionAllowed();
  const headline = useRef<HTMLDivElement>(null);
  const first = useRef(true);

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
    const url = new URL(window.location.href);
    url.searchParams.set("world", slug);
    window.history.replaceState(null, "", url);
  }

  const look = looks[active];
  const allLabel = copy.drop.all[worldList.findIndex((item) => item.slug === active)] ?? "";

  return (
    <div data-world-root={active}>
      <section className="hero" aria-labelledby="hero-title">
        <div className="shell grid-12 hero-grid">
          <div className="hero-copy">
            <p className="kicker">
              {world.index} · {world.name} · {world.mood}
            </p>
            <div ref={headline} className="grid gap-5" aria-live="polite">
              <h1 id="hero-title" className="t-hero">
                <span className="t-slant">{world.headline}</span>
              </h1>
              <p className="t-lead measure text-muted">{world.lead}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/worlds" variant="primary">
                {copy.explore} <span className="arrow" aria-hidden="true">→</span>
              </ButtonLink>
              <ButtonLink href="/shop" variant="secondary">
                {copy.shopFast}
              </ButtonLink>
            </div>
            <nav aria-label={copy.switcherLabel} className="switcher mt-4">
              {worldList.map((item) => (
                <a
                  key={item.slug}
                  href={`/?world=${item.slug}`}
                  aria-current={item.slug === active ? "true" : undefined}
                  onClick={(event) => choose(event, item.slug)}
                >
                  <span className="idx">{item.index}</span>
                  <span className="name">{item.name}</span>
                </a>
              ))}
            </nav>
          </div>
          <div className="hero-portal">
            <Portal world={active} aperture={apertures[active]} labels={{ openProduct: copy.openProduct, demoTag: copy.demoTag }} />
          </div>
        </div>
      </section>

      <section className="section bg-bg-raised" aria-labelledby="drop-title">
        <div className="shell grid gap-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="grid gap-3">
              <p className="kicker">{copy.drop.kicker}</p>
              <h2 id="drop-title" className="t-display">
                {copy.drop.title}
              </h2>
            </div>
            <a href={`/worlds/${active}`} className="btn btn-text">
              {allLabel} <span className="arrow" aria-hidden="true">→</span>
            </a>
          </div>
          <Reveal key={active} className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {drops[active]}
          </Reveal>
        </div>
      </section>

      <Showroom world={active} items={showrooms[active]} copy={copy.showroom} />

      {look ? (
        <section className="section" aria-labelledby="look-title">
          <div className="shell grid gap-10">
            <div className="grid-12 gap-y-6 items-end">
              <div className="col-span-12 md:col-span-6 grid gap-3">
                <p className="kicker">{copy.look.kicker}</p>
                <h2 id="look-title" className="t-display">
                  {copy.look.title}
                </h2>
              </div>
              <p className="col-span-12 md:col-span-5 md:col-start-8 t-lead text-muted">{copy.look.body}</p>
            </div>
            <Reveal key={`look-${active}`} className="look-grid">
              {look.items}
            </Reveal>
            <div className="look-total">
              <span className="t-micro text-muted">
                {copy.look.total} · {world.name}
              </span>
              <span className="t-title t-price">{look.total}</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
