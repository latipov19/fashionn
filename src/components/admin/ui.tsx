import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/content/copy";
import type { IconName } from "./icons";
import { icons } from "./icons";

const text = copy.admin;

export type SearchParams = Record<string, string | string[] | undefined>;

/** One value from a search param, or undefined. */
export const param = (params: SearchParams, key: string): string | undefined => {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 200) || undefined;
};

/** A positive page number from the URL, 1 when missing or nonsense. */
export const pageParam = (params: SearchParams): number => {
  const value = Number(param(params, "page"));
  return Number.isInteger(value) && value > 0 && value < 100_000 ? value : 1;
};

/** The value only when it is one of `allowed`, so the URL can never pick an unknown filter. */
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T;
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined;
export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback?: T): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** The current query with some keys replaced. Empty values are dropped, and a filter change goes back to page 1. */
export function withParams(path: string, params: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, page: undefined, ...changes })) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export function PageHeader({ kicker, title, lead, actions }: { kicker: string; title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="admin-page-head">
      <div className="admin-page-titles">
        <p className="kicker">{kicker}</p>
        <h1 className="admin-title">{title}</h1>
        {lead ? <p className="admin-lead">{lead}</p> : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className ? `admin-panel ${className}` : "admin-panel"} aria-label={title}>
      {title || actions ? (
        <div className="admin-panel-head">
          {title ? <h2 className="admin-panel-title">{title}</h2> : null}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, note, href, icon, tone }: { label: string; value: ReactNode; note?: ReactNode; href?: string; icon?: IconName; tone?: "warn" | "danger" }) {
  const body = (
    <>
      <span className="admin-stat-label">
        {icon ? icons[icon] : null}
        {label}
      </span>
      <span className="admin-stat-value tabular-nums">{value}</span>
      {note ? <span className="admin-stat-note">{note}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="admin-stat" data-tone={tone}>
      {body}
    </Link>
  ) : (
    <div className="admin-stat" data-tone={tone}>
      {body}
    </div>
  );
}

export type BadgeTone = "ok" | "warn" | "danger" | "muted" | "info";

export function Badge({ tone = "muted", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className="admin-badge" data-tone={tone}>
      {children}
    </span>
  );
}

/** Publication state as one badge: archived wins over draft, draft over published. */
export function ProductStatusBadge({ published, archived }: { published: boolean; archived: boolean }) {
  if (archived) return <Badge tone="muted">{text.status.archived}</Badge>;
  return published ? <Badge tone="ok">{text.status.published}</Badge> : <Badge tone="warn">{text.status.draft}</Badge>;
}

const ORDER_TONES: Record<string, BadgeTone> = {
  pending: "warn",
  confirmed: "info",
  packed: "info",
  shipped: "info",
  delivered: "ok",
  canceled: "muted",
  returned: "danger",
};

export function OrderStatusBadge({ status }: { status: keyof typeof copy.order.status }) {
  return <Badge tone={ORDER_TONES[status]}>{copy.order.status[status]}</Badge>;
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="admin-empty">
      <span className="admin-empty-mark" aria-hidden="true">
        {icons.cube}
      </span>
      <p className="admin-empty-title">{title}</p>
      {body ? <p className="admin-empty-body">{body}</p> : null}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <p className="admin-notice" data-tone={tone}>
      {icons.alert}
      <span>{children}</span>
    </p>
  );
}

export function Pagination({ path, params, page, pages, total }: { path: string; params: Record<string, string | undefined>; page: number; pages: number; total: number }) {
  if (pages <= 1) return <p className="admin-results">{text.common.results(total)}</p>;
  const link = (target: number) => withParams(path, params, { page: target > 1 ? String(target) : undefined });
  return (
    <nav className="admin-pagination" aria-label={text.common.pagination}>
      <p className="admin-results">{text.common.results(total)}</p>
      <div className="admin-pagination-links">
        {page > 1 ? (
          <Link href={link(page - 1)} className="btn btn-secondary admin-btn-sm" rel="prev">
            ← {text.common.prev}
          </Link>
        ) : null}
        <span className="admin-page-of tabular-nums">{text.common.page(page, pages)}</span>
        {page < pages ? (
          <Link href={link(page + 1)} className="btn btn-secondary admin-btn-sm" rel="next">
            {text.common.next} →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export type FilterSelect = { name: string; label: string; value?: string; options: { value: string; label: string }[]; allLabel?: string };

/**
 * Search and filters as a plain GET form: works without scripts, shareable as a link, and the
 * server reads only known values from it.
 */
export function FilterBar({ path, q, placeholder, selects, hidden }: { path: string; q?: string; placeholder?: string; selects?: FilterSelect[]; hidden?: Record<string, string | undefined> }) {
  return (
    <form className="admin-filters" action={path} method="get" role="search">
      {Object.entries(hidden ?? {}).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      {placeholder !== undefined ? (
        <label className="admin-search">
          <span className="sr-only">{text.common.search}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <input type="search" name="q" defaultValue={q} placeholder={placeholder} maxLength={120} />
        </label>
      ) : null}
      {selects?.map((select) => (
        <label key={select.name} className="admin-select">
          <span className="admin-select-label">{select.label}</span>
          <select name={select.name} defaultValue={select.value ?? ""}>
            {select.allLabel !== undefined ? <option value="">{select.allLabel}</option> : null}
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="admin-filter-actions">
        <button type="submit" className="btn btn-secondary admin-btn-sm">
          {text.common.apply}
        </button>
        <Link href={path} className="admin-link-muted">
          {text.common.reset}
        </Link>
      </div>
    </form>
  );
}

export function NoAccess() {
  return (
    <div className="admin-empty admin-no-access">
      <span className="admin-empty-mark" aria-hidden="true">
        {icons.team}
      </span>
      <h1 className="admin-empty-title">{text.noAccess.title}</h1>
      <p className="admin-empty-body">{text.noAccess.body}</p>
      <Link href="/admin" className="btn btn-secondary admin-btn-sm">
        {text.noAccess.back}
      </Link>
    </div>
  );
}

/** Tashkent keeps UTC+5 all year. */
const TASHKENT_OFFSET = 5 * 60 * 60 * 1000;
const two = (value: number) => String(value).padStart(2, "0");

/**
 * Dates in Tashkent time, the store's own clock, as 16.11.2026. Written out by hand rather than
 * with Intl: Node and browsers ship different locale data for uz-UZ, and a client component
 * must print exactly what the server printed.
 */
export function formatDate(date: Date): string {
  const local = new Date(date.getTime() + TASHKENT_OFFSET);
  return `${two(local.getUTCDate())}.${two(local.getUTCMonth() + 1)}.${local.getUTCFullYear()}`;
}

export function formatDateTime(date: Date): string {
  const local = new Date(date.getTime() + TASHKENT_OFFSET);
  return `${formatDate(date)} ${two(local.getUTCHours())}:${two(local.getUTCMinutes())}`;
}
