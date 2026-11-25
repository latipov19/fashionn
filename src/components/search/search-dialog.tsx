"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useCurrentWorld } from "@/components/shell/nav-links";
import { copy } from "@/content/copy";
import { DEFAULT_WORLD, withWorld, worlds } from "@/content/worlds";
import { formatUzs } from "@/lib/money";
import type { ShopItem } from "@/lib/shop";
import { EMPTY_QUERY, MAX_QUERY_LENGTH, searchCatalog, shopFacets, shopHref } from "@/lib/shop";
import { useDebouncedValue } from "@/lib/use-draft";
import { forgetSearches, readRecentSearches, rememberSearch, useCatalogIndex } from "./catalog-index";
import { Highlight } from "./highlight";
import { CloseGlyph, SearchGlyph } from "./search-glyph";

const text = copy.search;
const RESULT_LIMIT = 6;
const DEBOUNCE_MS = 120;

type Option = { id: string; href: string };

const lineNames = (item: ShopItem) => item.lines.map((line) => worlds[line].name).join(", ");

/**
 * The header's search. A modal dialog, so focus stays inside, the page behind is inert and Escape
 * closes it natively. The input is a combobox: arrows move through the suggestions and products,
 * Enter opens the highlighted one or, with none highlighted, the full results in the shop. A
 * panel under the header on wide screens, the whole screen on phones (CSS decides).
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const world = useCurrentWorld();
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;

  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecentSearches);
  const query = useDebouncedValue(value.trim(), DEBOUNCE_MS);
  const index = useCatalogIndex(open);
  const items = useMemo(() => (index.status === "ready" ? index.items : []), [index]);
  const result = useMemo(() => searchCatalog(items, query, RESULT_LIMIT), [items, query]);
  const facets = useMemo(() => shopFacets(items, EMPTY_QUERY), [items]);
  const typed = query.length > 0;

  // The shop keeps the world the shopper is in; the URL's `world` only retints the page.
  const base = world === DEFAULT_WORLD ? undefined : `world=${world}`;
  const productHref = (item: ShopItem) => withWorld(`/products/${item.handle}`, world);

  const options: Option[] = typed
    ? [
        ...result.suggestions.map((suggestion) => ({ id: `${baseId}-s-${suggestion.kind}-${suggestion.value}`, href: shopHref(suggestion.kind === "category" ? { categories: [suggestion.value] } : { lines: [suggestion.value as ShopItem["lines"][number]] }, base) })),
        ...result.products.map((item) => ({ id: `${baseId}-p-${item.id}`, href: productHref(item) })),
        ...(result.total > 0 ? [{ id: `${baseId}-all`, href: shopHref({ q: query }, base) }] : []),
      ]
    : [];

  // The highlighted option resets whenever the results change.
  const [active, setActive] = useState(-1);
  const [activeFor, setActiveFor] = useState(query);
  if (activeFor !== query) {
    setActiveFor(query);
    setActive(-1);
  }
  const activeId = options[active]?.id;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      input.current?.select();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  // Leaving for a result starts the next search fresh; closing without choosing keeps the text,
  // selected, so it can be refined or typed over.
  const leave = (searched: string) => {
    if (searched) setRecent(rememberSearch(searched));
    setValue("");
    onClose();
  };

  const go = (href: string) => {
    leave(query);
    router.push(href);
  };

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    leave(q);
    router.push(shopHref({ q }, base));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (options.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      // -1 is the input itself, so the cycle passes through it, as in a native combobox.
      setActive((current) => {
        const next = current + step;
        if (next >= options.length) return -1;
        if (next < -1) return options.length - 1;
        return next;
      });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = options[active];
      if (option) go(option.href);
      else submit();
    }
  };

  // A press on the dim area around the panel closes it; a drag that ends there does not.
  const onBackdrop = (event: PointerEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const optionProps = (index: number) => ({
    id: options[index]?.id,
    role: "option" as const,
    "aria-selected": index === active,
    tabIndex: -1,
    onPointerMove: () => setActive(index),
    onClick: () => leave(query),
  });

  const suggestionCount = typed ? result.suggestions.length : 0;

  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-label={text.dialogLabel}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={onBackdrop}
    >
      <div className="search-panel">
        <form
          role="search"
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor={inputId} className="search-bar-icon">
            <SearchGlyph />
            <span className="sr-only">{text.dialogLabel}</span>
          </label>
          <input
            ref={input}
            id={inputId}
            className="search-input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={MAX_QUERY_LENGTH}
            placeholder={text.placeholder}
            role="combobox"
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
          />
          {value ? (
            <button
              type="button"
              className="search-clear"
              aria-label={text.clear}
              onClick={() => {
                setValue("");
                input.current?.focus();
              }}
            >
              <CloseGlyph />
            </button>
          ) : null}
          <button type="button" className="search-close" onClick={onClose}>
            <span>{text.close}</span>
            <kbd aria-hidden="true">{text.escHint}</kbd>
          </button>
        </form>

        <div className="search-body">
          <p className="sr-only" aria-live="polite">
            {typed && index.status === "ready" ? text.count(result.total) : ""}
          </p>

          {index.status === "loading" ? (
            <div className="search-skeleton" role="status" aria-label={text.loading}>
              {[0, 1, 2, 3].map((row) => (
                <span key={row} className="search-skeleton-row" style={{ "--i": row } as CSSProperties} />
              ))}
            </div>
          ) : index.status === "error" ? (
            <div className="search-empty">
              <p className="search-empty-title">{text.failed}</p>
              <button type="button" className="btn btn-secondary" onClick={index.retry}>
                {text.retry}
              </button>
            </div>
          ) : !typed ? (
            <div className="search-idle">
              {recent.length ? (
                <section className="search-group" aria-labelledby={`${baseId}-recent`}>
                  <div className="search-group-head">
                    <h2 id={`${baseId}-recent`} className="t-micro text-muted">
                      {text.recent}
                    </h2>
                    <button
                      type="button"
                      className="search-text-btn"
                      onClick={() => {
                        forgetSearches();
                        setRecent([]);
                      }}
                    >
                      {text.clearRecent}
                    </button>
                  </div>
                  <ul className="search-chips">
                    {recent.map((entry) => (
                      <li key={entry}>
                        <button
                          type="button"
                          className="search-chip"
                          onClick={() => {
                            setValue(entry);
                            input.current?.focus();
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                            <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
                            <path d="M12 8v4l3 2" />
                          </svg>
                          {entry}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section className="search-group" aria-labelledby={`${baseId}-categories`}>
                <div className="search-group-head">
                  <h2 id={`${baseId}-categories`} className="t-micro text-muted">
                    {text.categories}
                  </h2>
                  <Link href={shopHref({}, base)} className="search-text-btn" onClick={onClose}>
                    {copy.worlds.shopAll} →
                  </Link>
                </div>
                <ul className="search-chips">
                  {facets.categories.map((option) => (
                    <li key={option.value}>
                      <Link className="search-chip" href={shopHref({ categories: [option.value] }, base)} onClick={onClose}>
                        {option.label}
                        <span className="search-chip-count">{option.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="search-group" aria-labelledby={`${baseId}-lines`}>
                <h2 id={`${baseId}-lines`} className="t-micro text-muted">
                  {text.lines}
                </h2>
                <ul className="search-chips">
                  {facets.lines.map((option) => (
                    <li key={option.value}>
                      <Link className="search-chip" href={shopHref({ lines: [option.value] }, base)} onClick={onClose}>
                        <span className="menu-swatch" style={{ "--swatch": option.swatch } as CSSProperties} aria-hidden="true" />
                        {option.label}
                        <span className="search-chip-count">{option.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : options.length === 0 ? (
            <div className="search-empty">
              <p className="search-empty-title">{text.noResults(query)}</p>
              <p className="t-small text-muted">{text.noResultsHint}</p>
              <ul className="search-chips">
                {facets.categories.map((option) => (
                  <li key={option.value}>
                    <Link className="search-chip" href={shopHref({ categories: [option.value] }, base)} onClick={onClose}>
                      {option.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div id={listId} role="listbox" aria-label={text.dialogLabel} className="search-results">
              {suggestionCount ? (
                <div role="group" aria-labelledby={`${baseId}-suggestions`} className="search-group">
                  <p id={`${baseId}-suggestions`} className="t-micro text-muted" role="presentation">
                    {text.suggestions}
                  </p>
                  {result.suggestions.map((suggestion, index) => (
                    <Link key={`${suggestion.kind}-${suggestion.value}`} href={options[index]!.href} className="search-suggestion" {...optionProps(index)}>
                      <span className="search-suggestion-icon" aria-hidden="true">
                        <SearchGlyph />
                      </span>
                      <span className="search-suggestion-label">
                        {suggestion.kind === "category" ? text.inCategory(suggestion.label) : text.inLine(suggestion.label)}
                      </span>
                      <span className="search-chip-count">{suggestion.count}</span>
                      <span className="search-arrow" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {result.products.length ? (
                <div role="group" aria-labelledby={`${baseId}-products`} className="search-group">
                  <p id={`${baseId}-products`} className="t-micro text-muted" role="presentation">
                    {text.products} <span className="tabular-nums">· {result.total}</span>
                  </p>
                  {result.products.map((item, offset) => {
                    const index = suggestionCount + offset;
                    return (
                      <Link key={item.id} href={options[index]!.href} className="search-product" {...optionProps(index)}>
                        <span className="search-thumb" style={item.image ? { backgroundImage: `url(${item.image.blur})` } : undefined}>
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
                            <img src={item.image.src} srcSet={item.image.srcSet} sizes="64px" width={item.image.width} height={item.image.height} alt="" loading="lazy" decoding="async" />
                          ) : null}
                        </span>
                        <span className="search-product-text">
                          <span className="search-product-name">
                            <Highlight text={item.name} query={query} />
                          </span>
                          <span className="search-product-meta">
                            {item.category} · {lineNames(item)}
                            {item.available ? null : ` · ${copy.micro.soldOut}`}
                          </span>
                        </span>
                        <span className="search-product-price">
                          <span>{formatUzs(item.priceUzs)}</span>
                          {item.compareAtUzs ? <s>{formatUzs(item.compareAtUzs)}</s> : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              {result.total > 0 ? (
                <Link href={options.at(-1)!.href} className="search-all" {...optionProps(options.length - 1)}>
                  {text.seeAll(result.total)}
                  <span className="search-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              ) : null}
            </div>
          )}
        </div>

        {typed && options.length ? (
          <p className="search-foot t-micro text-muted" aria-hidden="true">
            {text.keyboardHint}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
