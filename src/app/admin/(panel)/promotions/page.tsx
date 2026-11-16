import type { Metadata } from "next";
import type { PromotionDraft } from "@/components/admin/forms";
import { emptyPromotion, PromotionEditToggle, PromotionForm } from "@/components/admin/forms";
import type { BadgeTone } from "@/components/admin/ui";
import { Badge, EmptyState, formatDateTime, NoAccess, Notice, PageHeader, Panel } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { formatUzs } from "@/lib/money";
import type { PromotionState } from "@/server/admin/queries";
import { promotionList } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.promotions };

const text = copy.admin.promotions;
const TONES: Record<PromotionState, BadgeTone> = { active: "ok", scheduled: "info", expired: "muted", inactive: "muted", exhausted: "warn" };

/** A datetime-local value in Tashkent time, for editing a stored instant. */
function localInput(date: Date | null): string {
  if (!date) return "";
  const shifted = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export default async function AdminPromotions() {
  const session = await requireAdminPage();
  if (!can(session.role, "promotions")) return <NoAccess />;
  const rows = await promotionList();

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <Notice tone="warn">{text.notApplied}</Notice>
      <div className="admin-edit-layout">
        <div className="admin-edit-main">
          {rows.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">{text.columns.code}</th>
                    <th scope="col">{text.columns.discount}</th>
                    <th scope="col">{text.columns.window}</th>
                    <th scope="col" className="admin-num">
                      {text.columns.usage}
                    </th>
                    <th scope="col">{text.columns.state}</th>
                    <th scope="col">
                      <span className="sr-only">{copy.admin.common.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const draft: PromotionDraft = {
                      id: row.id,
                      code: row.code,
                      kind: row.kind,
                      value: String(row.value),
                      minOrderUzs: String(row.minOrderUzs),
                      startsAt: localInput(row.startsAt),
                      endsAt: localInput(row.endsAt),
                      usageLimit: row.usageLimit === null ? "" : String(row.usageLimit),
                      active: row.active,
                      note: row.note ?? "",
                    };
                    return (
                      <tr key={row.id}>
                        <td>
                          <strong className="admin-mono">{row.code}</strong>
                          {row.note ? <span className="text-muted admin-block">{row.note}</span> : null}
                        </td>
                        <td className="tabular-nums">
                          {row.kind === "percent" ? `−${row.value}%` : `−${formatUzs(row.value)}`}
                          {row.minOrderUzs ? <span className="text-muted admin-block">{text.minOrderShort(formatUzs(row.minOrderUzs))}</span> : null}
                        </td>
                        <td className="text-muted tabular-nums">
                          {row.startsAt || row.endsAt ? `${row.startsAt ? formatDateTime(row.startsAt) : "…"} — ${row.endsAt ? formatDateTime(row.endsAt) : "…"}` : text.always}
                        </td>
                        <td className="admin-num tabular-nums">
                          {row.usedCount} / {row.usageLimit ?? text.unlimited}
                        </td>
                        <td>
                          <Badge tone={TONES[row.state]}>{text.states[row.state]}</Badge>
                        </td>
                        <td>
                          <PromotionEditToggle initial={draft} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={text.empty} />
          )}
        </div>
        <aside className="admin-edit-side">
          <Panel title={text.new}>
            <PromotionForm initial={emptyPromotion} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
