"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

type Option<T extends string> = { value: T; label: string };

/**
 * A listbox dropdown in the site's glass. The button names the current choice; the list takes
 * focus when open: arrows, Home and End move, Enter or Space picks, Escape and Tab close.
 */
export function SortMenu<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const show = (at = selected) => {
    setActive(at);
    setOpen(true);
  };

  const hide = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  const pick = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    hide(true);
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
    }
  };

  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(last, active + 1),
      ArrowUp: () => Math.max(0, active - 1),
      Home: () => 0,
      End: () => last,
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setActive(move());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      hide(true);
    } else if (event.key === "Tab") {
      hide(false);
    }
  };

  return (
    <div ref={root} className="sort-menu" data-open={open ? "true" : undefined}>
      <button
        ref={button}
        type="button"
        className="sort-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? hide(false) : show())}
        onKeyDown={onButtonKey}
      >
        <span className="sort-button-label">{label}</span>
        <span className="sort-button-value">{options[selected]?.label}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <ul
        ref={list}
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        tabIndex={-1}
        className="sort-list"
        hidden={!open}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onKeyDown={onListKey}
      >
        {options.map((option, index) => (
          <li
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={index === selected}
            data-active={index === active ? "true" : undefined}
            className="sort-option"
            onPointerMove={() => setActive(index)}
            onClick={() => pick(index)}
          >
            {option.label}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </li>
        ))}
      </ul>
    </div>
  );
}
