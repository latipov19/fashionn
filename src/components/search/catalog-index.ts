"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShopItem } from "@/lib/shop";

/*
 * The overlay's copy of the catalogue, fetched from /api/catalog once and shared by every open
 * in the tab. A minute later the next open fetches it again, so admin changes show up.
 */

const FRESH_MS = 60_000;
let cache: { at: number; request: Promise<ShopItem[]> } | null = null;

export function loadCatalogIndex(): Promise<ShopItem[]> {
  const now = Date.now();
  if (cache && now - cache.at < FRESH_MS) return cache.request;
  const request = fetch("/api/catalog", { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`catalog index ${response.status}`);
      const body = (await response.json()) as { items?: ShopItem[] };
      if (!Array.isArray(body.items)) throw new Error("catalog index malformed");
      return body.items;
    })
    .catch((error: unknown) => {
      // A failed load is not cached: the retry button and the next open try again.
      cache = null;
      throw error;
    });
  cache = { at: now, request };
  return request;
}

export type CatalogIndexState = { status: "loading" } | { status: "ready"; items: ShopItem[] } | { status: "error" };

/** Loads the index while `active`. `retry` starts a failed load again. */
export function useCatalogIndex(active: boolean): CatalogIndexState & { retry: () => void } {
  const [state, setState] = useState<CatalogIndexState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let live = true;
    loadCatalogIndex().then(
      (items) => live && setState({ status: "ready", items }),
      () => live && setState({ status: "error" }),
    );
    return () => {
      live = false;
    };
  }, [active, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);

  return { ...state, retry };
}

/* Recent searches: a convenience kept in this browser only. Storage can be missing or blocked. */

const RECENT_KEY = "vv:recent-searches";
const RECENT_MAX = 5;

export function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(query: string): string[] {
  const text = query.trim();
  if (!text) return readRecentSearches();
  const next = [text, ...readRecentSearches().filter((entry) => entry.toLowerCase() !== text.toLowerCase())].slice(0, RECENT_MAX);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode or blocked storage: the search still works, it just is not remembered.
  }
  return next;
}

export function forgetSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Nothing to do.
  }
}
