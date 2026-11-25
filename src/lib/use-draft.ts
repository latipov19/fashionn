"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A text field whose committed value lives somewhere else, such as the address bar. Typing stays
 * local and is committed after `delay` ms of quiet, or at once with `flush` (Enter, blur). When
 * the committed value changes from outside (back button, a link, the search overlay), the field
 * follows it; the echo of its own commit never overwrites what the shopper kept typing meanwhile.
 *
 * `normalize` turns typed text into the committed form, so "  hudi " and "hudi" are one value.
 */
export function useDraft(value: string, commit: (next: string) => void, { delay, normalize }: { delay: number; normalize: (text: string) => string }) {
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const [pending, setPending] = useState<string | null>(null);

  // Adjusting state while rendering, React's pattern for following a prop without an effect.
  if (value !== seen) {
    setSeen(value);
    if (value === pending) setPending(null);
    else setText(value);
  }

  const latest = useRef({ commit, normalize, value });
  useEffect(() => {
    latest.current = { commit, normalize, value };
  });

  const send = useCallback((raw: string) => {
    const { commit: run, normalize: clean, value: current } = latest.current;
    const next = clean(raw);
    if (next === current) return;
    setPending(next);
    run(next);
  }, []);

  useEffect(() => {
    if (normalize(text) === value) return;
    const timer = setTimeout(() => send(text), delay);
    return () => clearTimeout(timer);
  }, [text, value, delay, normalize, send]);

  /** Commits now, skipping the wait. Pass text to commit something other than what is typed. */
  const flush = useCallback(
    (override?: string) => {
      const raw = override ?? text;
      if (override !== undefined) setText(override);
      send(raw);
    },
    [send, text],
  );

  return [text, setText, flush] as const;
}

/** The value after `delay` ms without a change. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
