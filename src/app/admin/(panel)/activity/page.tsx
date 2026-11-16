import type { Metadata } from "next";
import Link from "next/link";
import type { SearchParams } from "@/components/admin/ui";
import { EmptyState, FilterBar, formatDateTime, NoAccess, oneOf, PageHeader, pageParam, Pagination, param } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { ACTIVITY_TYPES, listActivity } from "@/server/admin/activity";
import type { ActivityRow } from "@/server/admin/activity";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.activity };

const text = copy.admin.activity;

/** Where a trail entry points, when its record still has a page. */
function targetHref(row: ActivityRow): string | null {
  if (!row.targetId) return null;
  if (row.targetType === "product" || row.targetType === "media") return row.action === "product.deleted" ? null : `/admin/products/${row.targetId}`;
  if (row.targetType === "order") return `/admin/orders/${row.targetId}`;
  if (row.targetType === "customer") return `/admin/customers/${row.targetId}`;
  return null;
}

function details(row: ActivityRow): string {
  return Object.entries(row.meta)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

/** The append-only trail: read here, written only by server actions, never edited. */
export default async function AdminActivity({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "activity")) return <NoAccess />;
  const params = await searchParams;
  const type = oneOf(param(params, "type"), ACTIVITY_TYPES);
  const page = pageParam(params);
  const { rows, total } = await listActivity({ type, page, pageSize: 30 });
  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <FilterBar path="/admin/activity" selects={[{ name: "type", label: text.filterType, value: type, allLabel: copy.admin.common.all, options: ACTIVITY_TYPES.map((value) => ({ value, label: text.types[value] })) }]} />
      {rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{text.columns.when}</th>
                <th scope="col">{text.columns.who}</th>
                <th scope="col">{text.columns.action}</th>
                <th scope="col">{text.columns.target}</th>
                <th scope="col">{text.columns.details}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const href = targetHref(row);
                const label = row.targetLabel ?? text.types[row.targetType as keyof typeof text.types] ?? row.targetType;
                return (
                  <tr key={row.id}>
                    <td className="text-muted tabular-nums">{formatDateTime(row.createdAt)}</td>
                    <td>{row.actorEmail}</td>
                    <td>{text.actions[row.action] ?? row.action}</td>
                    <td>{href ? <Link href={href}>{label}</Link> : label}</td>
                    <td className="text-muted admin-small">{details(row)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={text.empty} />
      )}
      <Pagination path="/admin/activity" params={{ type }} page={page} pages={pages} total={total} />
    </>
  );
}
