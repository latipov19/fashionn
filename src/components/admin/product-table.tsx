"use client";

import Link from "next/link";
import { useState } from "react";
import { copy } from "@/content/copy";
import type { WorldSlug } from "@/content/types";
import { worlds } from "@/content/worlds";
import { formatUzs } from "@/lib/money";
import { bulkProducts } from "@/server/actions/admin";
import type { MediaRecord } from "@/content/types";
import { ConfirmButton, useAdminAction } from "./client";
import { icons } from "./icons";
import { Badge, formatDate, ProductStatusBadge } from "./ui";

const text = copy.admin.products;

export type ProductTableRow = {
  id: string;
  handle: string;
  name: string;
  category: string;
  priceUzs: number;
  compareAtUzs: number | null;
  published: boolean;
  archived: boolean;
  isDemo: boolean;
  stock: number;
  updatedAt: Date;
  worlds: WorldSlug[];
  thumb: MediaRecord | null;
  hasModel: boolean;
};

/** The products table with row selection. Bulk actions run on the server for at most one page at a time. */
export function ProductTable({ rows }: { rows: ProductTableRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { run, pending } = useAdminAction();
  const ids = [...selected].filter((id) => rows.some((row) => row.id === id));
  const all = rows.length > 0 && ids.length === rows.length;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const bulk = (op: "publish" | "unpublish" | "archive") =>
    run(() => bulkProducts({ ids, op }), (data) => text.bulk.done(data.count), () => setSelected(new Set()));

  return (
    <>
      <div className="admin-bulk" data-active={ids.length > 0} aria-live="polite">
        <span className="tabular-nums">{ids.length ? text.selected(ids.length) : text.bulk.none}</span>
        <button type="button" className="btn btn-secondary admin-btn-sm" disabled={!ids.length || pending} onClick={() => bulk("publish")}>
          {text.bulk.publish}
        </button>
        <button type="button" className="btn btn-secondary admin-btn-sm" disabled={!ids.length || pending} onClick={() => bulk("unpublish")}>
          {text.bulk.unpublish}
        </button>
        <ConfirmButton label={text.bulk.archive} message={text.bulk.confirmArchive(ids.length)} confirmLabel={text.bulk.archive} disabled={!ids.length || pending} onConfirm={() => bulk("archive")} />
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col" className="admin-col-check">
                <input type="checkbox" checked={all} aria-label={text.selectAll} onChange={() => setSelected(all ? new Set() : new Set(rows.map((row) => row.id)))} />
              </th>
              <th scope="col">{text.columns.product}</th>
              <th scope="col">{text.columns.status}</th>
              <th scope="col" className="admin-num">
                {text.columns.price}
              </th>
              <th scope="col" className="admin-num">
                {text.columns.stock}
              </th>
              <th scope="col">{text.columns.worlds}</th>
              <th scope="col">{text.columns.model}</th>
              <th scope="col">{text.columns.updated}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-selected={selected.has(row.id)}>
                <td className="admin-col-check">
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`${text.select}: ${row.name}`} />
                </td>
                <td>
                  <Link href={`/admin/products/${row.id}`} className="admin-product-cell">
                    <span className="admin-thumb" style={row.thumb ? { backgroundImage: `url(${row.thumb.blur})` } : undefined}>
                      {row.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
                        <img src={row.thumb.srcSet[0]?.url ?? row.thumb.url} alt="" width={40} height={50} loading="lazy" decoding="async" />
                      ) : null}
                    </span>
                    <span className="admin-product-text">
                      <span className="admin-product-name">
                        {row.name}
                        {row.isDemo ? <span className="demo-tag">{copy.admin.common.demo}</span> : null}
                      </span>
                      <span className="admin-product-meta">
                        {row.category} · <span className="admin-mono">{row.handle}</span>
                      </span>
                    </span>
                  </Link>
                </td>
                <td>
                  <ProductStatusBadge published={row.published} archived={row.archived} />
                </td>
                <td className="admin-num tabular-nums">
                  {formatUzs(row.priceUzs)}
                  {row.compareAtUzs ? <s className="admin-was">{formatUzs(row.compareAtUzs)}</s> : null}
                </td>
                <td className="admin-num tabular-nums">{row.stock === 0 ? <Badge tone="danger">{text.soldOut}</Badge> : row.stock}</td>
                <td>
                  <span className="admin-worlds">
                    {row.worlds.map((slug) => (
                      <span key={slug} className="admin-world-dot" style={{ background: worlds[slug].theme.bg }} title={worlds[slug].name} aria-label={worlds[slug].name} />
                    ))}
                  </span>
                </td>
                <td>{row.hasModel ? <Badge tone="info">{icons.cube} 3D</Badge> : <span className="text-muted">{text.noModel}</span>}</td>
                <td className="text-muted tabular-nums">{formatDate(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
