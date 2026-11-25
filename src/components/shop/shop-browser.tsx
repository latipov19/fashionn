"use client";

import { useSearchParams } from "next/navigation";
import type { CSSProperties, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductTile } from "@/components/product/product-tile";
import { CloseGlyph, SearchGlyph } from "@/components/search/search-glyph";
import { copy } from "@/content/copy";
import { worlds } from "@/content/worlds";
import { formatUzs } from "@/lib/money";
import type { ShopItem, ShopQuery, ShopSort } from "@/lib/shop";
import { applyShopQuery, EMPTY_QUERY, isFiltered, MAX_QUERY_LENGTH, parseShopQuery, SHOP_SORTS, shopFacets, writeShopQuery } from "@/lib/shop";
import { useDraft } from "@/lib/use-draft";
import { useMediaQuery } from "@/lib/use-motion";
import type { ShopUpdate } from "./filter-panel";
import { FilterPanel } from "./filter-panel";
import { SortMenu } from "./sort-menu";

const text = copy.shop;
const PAGE_SIZE = 24;
const DESKTOP = "(min-width: 56.25rem)";
const SORT_OPTIONS = SHOP_SORTS.map((value) => ({ value, label: text.sort[value] }));
const normalizeQuery = (raw: string) => raw.trim().slice(0, MAX_QUERY_LENGTH);

/** Writes the shop's state into the address bar, keeping other parameters. False when nothing changed. */
function writeUrl(next: ShopQuery, mode: "push" | "replace"): boolean {
  const search = writeShopQuery(next, window.location.search).toString().replace(/%2C/g, ",");
  const url = search ? `${window.location.pathname}?${search}` : window.location.pathname;
  if (url === `${window.location.pathname}${window.location.search}`) return false;
  window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
  return true;
}

const keyOf = (query: ShopQuery) => writeShopQuery(query).toString();

type Chip = { key: string; label: string; remove: () => void };

/**
 * The shop: search, filters, sort and the grid. The address bar holds the state, so a filtered
 * view can be shared, reloaded and walked back through; the server rendered the same view from
 * the same URL, so the first paint is already filtered. Choices (a category, a sort) are history
 * entries; typing (search, price) replaces the current one.
 */
export function ShopBrowser({ items }: { items: ShopItem[] }) {
  /*
   * The grid answers a click at once from local state; the address bar follows. Next applies a
   * history change in a transition, so reading the URL alone would let a ticked box spring back
   * for a moment. A URL change this component did not write (back, forward, a link, the search
   * overlay) replaces the local state; the echo of its own writes is recognised and skipped.
   */
  const params = useSearchParams();
  const fromUrl = useMemo(() => parseShopQuery(params), [params]);
  const urlKey = keyOf(fromUrl);
  const [query, setQuery] = useState(fromUrl);
  const [seen, setSeen] = useState(urlKey);
  const [pending, setPending] = useState<string[]>([]);
  if (urlKey !== seen) {
    setSeen(urlKey);
    const at = pending.indexOf(urlKey);
    if (at === -1) {
      setQuery(fromUrl);
      setPending([]);
    } else {
      setPending(pending.slice(at + 1));
    }
  }

  const update: ShopUpdate = useCallback(
    (patch, mode = "push") => {
      const next = { ...query, ...patch };
      setQuery(next);
      if (writeUrl(next, mode)) setPending((list) => [...list, keyOf(next)]);
    },
    [query],
  );

  const results = useMemo(() => applyShopQuery(items, query), [items, query]);
  const facets = useMemo(() => shopFacets(items, query), [items, query]);
  const desktop = useMediaQuery(DESKTOP, true);

  // How many cards show. A new search or filter starts again from the first page.
  const signature = keyOf(query);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [limitFor, setLimitFor] = useState(signature);
  if (limitFor !== signature) {
    setLimitFor(signature);
    setLimit(PAGE_SIZE);
  }
  const visible = results.slice(0, limit);

  const commitQuery = useCallback((q: string) => update({ q }, "replace"), [update]);
  const [search, setSearch, flushSearch] = useDraft(query.q, commitQuery, { delay: 250, normalize: normalizeQuery });
  const searchInput = useRef<HTMLInputElement>(null);

  // The phone drawer. Desktop shows the same panel in the sidebar instead, so only one exists.
  const drawer = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  if (desktop && drawerOpen) setDrawerOpen(false);
  useEffect(() => {
    const element = drawer.current;
    if (!element) return;
    if (drawerOpen && !element.open) element.showModal();
    else if (!drawerOpen && element.open) element.close();
  }, [drawerOpen]);
  const onDrawerBackdrop = (event: PointerEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) setDrawerOpen(false);
  };

  const categoryLabel = new Map(facets.categories.map((option) => [option.value, option.label]));
  const chips: Chip[] = [
    ...(query.q ? [{ key: "q", label: `“${query.q}”`, remove: () => update({ q: "" }) }] : []),
    ...query.categories.map((slug) => ({ key: `c-${slug}`, label: categoryLabel.get(slug) ?? slug, remove: () => update({ categories: query.categories.filter((entry) => entry !== slug) }) })),
    ...query.lines.map((line) => ({ key: `l-${line}`, label: worlds[line].name, remove: () => update({ lines: query.lines.filter((entry) => entry !== line) }) })),
    ...(query.min !== null || query.max !== null
      ? [
          {
            key: "price",
            label:
              query.min !== null && query.max !== null
                ? text.filters.priceRange(formatUzs(query.min), formatUzs(query.max))
                : query.min !== null
                  ? text.filters.priceFrom(formatUzs(query.min))
                  : text.filters.priceUpTo(formatUzs(query.max ?? 0)),
            remove: () => update({ min: null, max: null }),
          },
        ]
      : []),
    ...(query.inStock ? [{ key: "stock", label: text.filters.inStock, remove: () => update({ inStock: false }) }] : []),
    ...(query.newOnly ? [{ key: "new", label: text.filters.newOnly, remove: () => update({ newOnly: false }) }] : []),
  ];
  const panelFilters = chips.filter((chip) => chip.key !== "q").length;
  const clearAll = () => update({ ...EMPTY_QUERY, sort: query.sort });

  const panel = <FilterPanel query={query} facets={facets} onChange={update} />;
  const lineNames = (item: ShopItem) => item.lines.map((line) => worlds[line].name);

  return (
    <div className="shop-layout">
      <aside className="shop-aside" aria-label={text.filtersTitle}>
        {desktop ? panel : null}
      </aside>

      <div className="shop-main">
        <div className="shop-toolbar">
          <form
            role="search"
            className="shop-search"
            onSubmit={(event) => {
              event.preventDefault();
              flushSearch();
              searchInput.current?.blur();
            }}
          >
            <label htmlFor="shop-search" className="shop-search-icon">
              <SearchGlyph />
              <span className="sr-only">{text.searchLabel}</span>
            </label>
            <input
              ref={searchInput}
              id="shop-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              maxLength={MAX_QUERY_LENGTH}
              className="shop-search-input"
              placeholder={text.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && search) {
                  event.preventDefault();
                  flushSearch("");
                }
              }}
            />
            {search ? (
              <button
                type="button"
                className="search-clear"
                aria-label={text.clearSearch}
                onClick={() => {
                  flushSearch("");
                  searchInput.current?.focus();
                }}
              >
                <CloseGlyph />
              </button>
            ) : null}
          </form>
          <button type="button" className="shop-filter-button" aria-haspopup="dialog" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
            {text.showFilters}
            {panelFilters ? (
              <span className="shop-filter-badge">
                <span aria-hidden="true">{panelFilters}</span>
                <span className="sr-only">{text.filterCount(panelFilters)}</span>
              </span>
            ) : null}
          </button>
          <SortMenu<ShopSort> label={text.sortLabel} value={query.sort} options={SORT_OPTIONS} onChange={(sort) => update({ sort })} />
        </div>

        <div className="shop-status">
          <p className="shop-count" aria-live="polite">
            {query.q ? text.resultsFor(results.length, query.q) : text.results(results.length)}
          </p>
          {chips.length ? (
            <div className="shop-chips" role="group" aria-label={text.activeFilters}>
              {chips.map((chip) => (
                <button key={chip.key} type="button" className="shop-chip" onClick={chip.remove} aria-label={text.removeFilter(chip.label)}>
                  {chip.label}
                  <CloseGlyph />
                </button>
              ))}
              <button type="button" className="search-text-btn" onClick={clearAll}>
                {text.clearAll}
              </button>
            </div>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="shop-empty">
            <p className="t-lead text-muted">{text.emptyCatalog}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="shop-empty">
            <p className="shop-empty-mark" aria-hidden="true">
              0
            </p>
            <h2 className="t-title">{text.emptyTitle}</h2>
            <p className="t-body text-muted measure">{query.q ? text.emptyQuery(query.q) : text.emptyFilters}</p>
            {isFiltered(query) ? (
              <button type="button" className="btn btn-primary" onClick={clearAll}>
                {text.clearAll}
              </button>
            ) : null}
            <p className="t-micro text-muted">{text.tryCategories}</p>
            <ul className="search-chips">
              {shopFacets(items, EMPTY_QUERY).categories.map((option) => (
                <li key={option.value}>
                  <button type="button" className="search-chip" onClick={() => update({ ...EMPTY_QUERY, sort: query.sort, categories: [option.value] })}>
                    {option.label}
                    <span className="search-chip-count">{option.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <ul className="shop-grid" aria-label={text.gridLabel}>
              {visible.map((item, index) => (
                <li key={item.id} style={{ "--i": index % PAGE_SIZE } as CSSProperties}>
                  <ProductTile
                    href={`/products/${item.handle}`}
                    name={item.name}
                    image={item.image}
                    hoverImage={item.hoverImage}
                    meta={[item.category, ...lineNames(item)].join(" · ")}
                    colors={item.colors}
                    priceUzs={item.priceUzs}
                    compareAtUzs={item.compareAtUzs}
                    isDemo={item.isDemo}
                    soldOut={!item.available}
                    isNew={item.isNew}
                    sizes="(max-width: 640px) 46vw, (max-width: 1200px) 30vw, 22vw"
                    eager={index < 4}
                  />
                </li>
              ))}
            </ul>
            {results.length > visible.length ? (
              <div className="shop-more">
                <p className="t-small text-muted">{text.shown(visible.length, results.length)}</p>
                <button type="button" className="btn btn-secondary" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                  {text.showMore}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <dialog
        ref={drawer}
        className="shop-drawer"
        aria-labelledby="shop-drawer-title"
        onCancel={(event) => {
          event.preventDefault();
          setDrawerOpen(false);
        }}
        onPointerDown={onDrawerBackdrop}
      >
        <div className="shop-drawer-panel">
          <div className="shop-drawer-head">
            <h2 id="shop-drawer-title" className="t-micro">
              {text.filtersTitle}
            </h2>
            <button type="button" className="search-clear" aria-label={text.closeFilters} onClick={() => setDrawerOpen(false)}>
              <CloseGlyph />
            </button>
          </div>
          <div className="shop-drawer-body">{desktop ? null : panel}</div>
          <div className="shop-drawer-foot">
            <button type="button" className="btn btn-text" onClick={clearAll} disabled={!isFiltered(query)}>
              {text.clearShort}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDrawerOpen(false)}>
              {text.showResults(results.length)}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
