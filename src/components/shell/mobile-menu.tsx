"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useId, useRef, useState } from "react";
import type { WorldSlug } from "@/content/types";
import { withWorld } from "@/content/worlds";
import { isCurrent, type NavItem, useCurrentWorld } from "./nav-links";

type WorldItem = { slug: WorldSlug; label: string; index: string; swatch: string };

type Props = {
  items: readonly NavItem[];
  worlds: readonly WorldItem[];
  labels: { open: string; close: string; nav: string; worlds: string };
};

/**
 * Phones and tablets. From 1200 px the page links sit in the header capsule and this is hidden by
 * CSS. Page links keep the current world; world links keep the current page.
 */
export function MobileMenu({ items, worlds, labels }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const worldsId = useId();
  const pathname = usePathname();
  const world = useCurrentWorld();
  const [shownFor, setShownFor] = useState(pathname);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  // Close after navigating (back and forward included).
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  // Escape closes and returns focus to the toggle. A press outside the menu closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || toggle.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={toggle}
        type="button"
        className="icon-link menu-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          {open ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 9h16M4 15h16" />}
        </svg>
      </button>
      <nav ref={panel} id={panelId} aria-label={labels.nav} className="menu-panel" hidden={!open}>
        {open ? (
          <>
            <div className="menu-group menu-primary">
              {items.map((item, index) => (
                <Link
                  key={item.href}
                  href={withWorld(item.href, world)}
                  onClick={close}
                  aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                  style={{ "--i": index } as CSSProperties}
                >
                  {item.label}
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
            <div className="menu-group menu-worlds" role="group" aria-labelledby={worldsId}>
              <p id={worldsId} className="menu-group-title t-micro text-muted">
                {labels.worlds}
              </p>
              {worlds.map((item, index) => (
                <Link
                  key={item.slug}
                  href={withWorld(pathname, item.slug)}
                  onClick={close}
                  aria-current={item.slug === world ? "true" : undefined}
                  style={{ "--i": index + items.length } as CSSProperties}
                >
                  <span className="inline-flex items-center gap-3">
                    <span className="menu-swatch" style={{ "--swatch": item.swatch } as CSSProperties} aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="t-micro text-muted tabular-nums">{item.index}</span>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </nav>
    </>
  );
}
