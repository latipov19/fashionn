"use client";

import dynamic from "next/dynamic";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadCatalogIndex } from "./catalog-index";
import { SearchGlyph } from "./search-glyph";

const loadDialog = () => import("./search-dialog").then((module) => module.SearchDialog);
// The dialog and its index load on first intent (hover, focus or a shortcut), not with the page.
const SearchDialog = dynamic(loadDialog, { ssr: false });

function warm() {
  void loadDialog();
  loadCatalogIndex().catch(() => undefined);
}

/** True when a key press belongs to a field the shopper is typing in. */
function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

/**
 * The header's search icon. Without scripts it is the plain link to the shop it always was; with
 * them it opens the search overlay. `/` and Ctrl or ⌘ + K open it from anywhere.
 */
export function SearchLauncher({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);

  const show = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = (event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey);
      if (!shortcut && !(event.key === "/" && !typingIn(event.target))) return;
      if (event.altKey || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window still opens the shop.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    show();
  };

  return (
    <>
      <a ref={trigger} href="/shop" className="icon-link search-link" aria-haspopup="dialog" aria-expanded={open} onClick={onClick} onPointerEnter={warm} onFocus={warm}>
        <SearchGlyph />
        <span className="search-label">{label}</span>
      </a>
      {mounted ? <SearchDialog open={open} onClose={close} /> : null}
    </>
  );
}
