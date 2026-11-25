"use client";

import type { CSSProperties } from "react";
import { useCallback, useId } from "react";
import { copy } from "@/content/copy";
import type { WorldSlug } from "@/content/types";
import { formatUzs } from "@/lib/money";
import type { ShopFacets, ShopQuery } from "@/lib/shop";
import { parsePrice } from "@/lib/shop";
import { useDraft } from "@/lib/use-draft";

const text = copy.shop.filters;

export type ShopUpdate = (patch: Partial<ShopQuery>, mode?: "push" | "replace") => void;

const toggle = <T,>(list: readonly T[], value: T) => (list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);

/** A price as grouped digits without the currency, which the legend already names. */
const digits = (amount: number) => formatUzs(amount).replace(/\s*soʻm$/, "");

/** Typed price text in the form the URL keeps: whole soʻm digits, or nothing. */
const priceText = (raw: string) => {
  const amount = parsePrice(raw);
  return amount === null ? "" : String(amount);
};

function PriceField({ label, value, placeholder, onCommit }: { label: string; value: number | null; placeholder: string; onCommit: (amount: number | null) => void }) {
  const id = useId();
  const commit = useCallback((next: string) => onCommit(parsePrice(next)), [onCommit]);
  const [draft, setDraft, flush] = useDraft(value === null ? "" : String(value), commit, { delay: 700, normalize: priceText });
  return (
    <div className="price-field">
      <label htmlFor={id} className="t-micro text-muted">
        {label}
      </label>
      <input
        id={id}
        className="price-input"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d\s]/g, ""))}
        onBlur={() => flush()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            flush();
          }
        }}
      />
    </div>
  );
}

/** Every filter in one panel: the desktop sidebar and the phone drawer render this same component. */
export function FilterPanel({ query, facets, onChange }: { query: ShopQuery; facets: ShopFacets; onChange: ShopUpdate }) {
  const setMin = useCallback((min: number | null) => onChange({ min }, "replace"), [onChange]);
  const setMax = useCallback((max: number | null) => onChange({ max }, "replace"), [onChange]);

  return (
    <div className="filter-panel">
      <fieldset className="filter-group">
        <legend className="filter-legend">{text.category}</legend>
        <ul className="filter-options">
          {facets.categories.map((option) => {
            const checked = query.categories.includes(option.value);
            return (
              <li key={option.value}>
                <label className="filter-option" data-empty={option.count === 0 && !checked ? "true" : undefined}>
                  <input
                    type="checkbox"
                    className="filter-check"
                    checked={checked}
                    disabled={option.count === 0 && !checked}
                    onChange={() => onChange({ categories: toggle(query.categories, option.value) })}
                  />
                  <span className="filter-option-label">{option.label}</span>
                  <span className="filter-count">{option.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="filter-group">
        <legend className="filter-legend">{text.line}</legend>
        <ul className="filter-options">
          {facets.lines.map((option) => {
            const checked = query.lines.includes(option.value);
            return (
              <li key={option.value}>
                <label className="filter-option" data-empty={option.count === 0 && !checked ? "true" : undefined}>
                  <input
                    type="checkbox"
                    className="filter-check"
                    checked={checked}
                    disabled={option.count === 0 && !checked}
                    onChange={() => onChange({ lines: toggle<WorldSlug>(query.lines, option.value) })}
                  />
                  <span className="filter-option-label">
                    <span className="menu-swatch" style={{ "--swatch": option.swatch } as CSSProperties} aria-hidden="true" />
                    {option.label}
                  </span>
                  <span className="filter-count">{option.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="filter-group">
        <legend className="filter-legend">{text.price}</legend>
        <div className="price-fields">
          <PriceField label={text.priceMin} value={query.min} placeholder={digits(facets.price.min)} onCommit={setMin} />
          <span className="price-dash" aria-hidden="true">
            –
          </span>
          <PriceField label={text.priceMax} value={query.max} placeholder={digits(facets.price.max)} onCommit={setMax} />
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend className="filter-legend">{text.availability}</legend>
        <ul className="filter-options">
          <li>
            <label className="filter-option filter-switch">
              <input type="checkbox" role="switch" className="switch-input" checked={query.inStock} onChange={() => onChange({ inStock: !query.inStock })} />
              <span className="filter-option-label">{text.inStock}</span>
              <span className="filter-count">{facets.inStock}</span>
            </label>
          </li>
          <li>
            <label className="filter-option filter-switch">
              <input type="checkbox" role="switch" className="switch-input" checked={query.newOnly} onChange={() => onChange({ newOnly: !query.newOnly })} />
              <span className="filter-option-label">{text.newOnly}</span>
              <span className="filter-count">{facets.newOnly}</span>
            </label>
          </li>
        </ul>
      </fieldset>
    </div>
  );
}
