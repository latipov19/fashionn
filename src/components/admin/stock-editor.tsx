"use client";

import { useState } from "react";
import { copy } from "@/content/copy";
import type { StockReason } from "@/lib/admin-constants";
import { STOCK_REASONS } from "@/lib/admin-constants";
import { adjustStock } from "@/server/actions/admin";
import { useAdminAction } from "./client";
import { Badge } from "./ui";

const text = copy.admin.inventory;

export type StockRow = { variantId: string; label: string; sku: string; stock: number; inactive?: boolean; hex?: string };

/**
 * One row per variant: type the counted number, pick why, and write it. The server locks the
 * row, records old and new counts with the reason, and refuses anything below zero.
 */
export function StockEditor({ rows, lowAt }: { rows: StockRow[]; lowAt: number }) {
  const { run, pending } = useAdminAction();
  const [drafts, setDrafts] = useState<Record<string, { stock: string; reason: StockReason; note: string }>>({});
  const draft = (row: StockRow) => drafts[row.variantId] ?? { stock: String(row.stock), reason: "count" as StockReason, note: "" };
  const update = (row: StockRow, change: Partial<{ stock: string; reason: StockReason; note: string }>) => setDrafts((current) => ({ ...current, [row.variantId]: { ...draft(row), ...change } }));

  return (
    <div className="admin-table-wrap">
      <table className="admin-table admin-stock-table">
        <thead>
          <tr>
            <th scope="col">{text.columns.variant}</th>
            <th scope="col">{text.columns.sku}</th>
            <th scope="col" className="admin-num">
              {text.columns.stock}
            </th>
            <th scope="col">{text.columns.adjust}</th>
            <th scope="col">{text.reason}</th>
            <th scope="col">
              <span className="sr-only">{copy.admin.common.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const value = draft(row);
            const next = Number(value.stock);
            const valid = value.stock.trim() !== "" && Number.isInteger(next) && next >= 0 && next <= 100_000;
            return (
              <tr key={row.variantId}>
                <td>
                  <span className="admin-variant">
                    {row.hex ? <span className="admin-swatch admin-swatch-sm" style={{ background: row.hex }} aria-hidden="true" /> : null}
                    {row.label}
                    {row.inactive ? <Badge>{text.inactive}</Badge> : null}
                  </span>
                </td>
                <td className="admin-mono text-muted">{row.sku}</td>
                <td className="admin-num tabular-nums">
                  <Badge tone={row.stock === 0 ? "danger" : row.stock <= lowAt ? "warn" : "ok"}>{row.stock}</Badge>
                </td>
                <td>
                  <input
                    className="admin-input admin-input-num"
                    inputMode="numeric"
                    aria-label={`${text.columns.adjust}: ${row.label}`}
                    aria-invalid={!valid || undefined}
                    value={value.stock}
                    onChange={(event) => update(row, { stock: event.target.value.replace(/[^\d]/g, "") })}
                  />
                </td>
                <td>
                  <select className="admin-input" aria-label={`${text.reason}: ${row.label}`} value={value.reason} onChange={(event) => update(row, { reason: event.target.value as StockReason })}>
                    {STOCK_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {text.reasons[reason]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary admin-btn-sm"
                    disabled={pending || !valid || next === row.stock}
                    onClick={() =>
                      run(
                        () => adjustStock({ variantId: row.variantId, stock: next, reason: value.reason, note: value.note || undefined }),
                        (data) => (data.changed ? text.applied : text.unchanged),
                        () => setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== row.variantId))),
                      )
                    }
                  >
                    {text.apply}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
