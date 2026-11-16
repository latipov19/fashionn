import type { Metadata } from "next";
import Link from "next/link";
import { CategoryRename } from "@/components/admin/forms";
import { EmptyState, NoAccess, Notice, PageHeader } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { categoryOverview } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.categories };

const text = copy.admin.categories;

/** Categories as the catalogue holds them: a field on each product, renamed or merged across all of them at once. */
export default async function AdminCategories() {
  const session = await requireAdminPage();
  if (!can(session.role, "catalog")) return <NoAccess />;
  const rows = await categoryOverview();

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <Notice>{text.limits}</Notice>
      {rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{text.name}</th>
                <th scope="col" className="admin-num">
                  {text.products}
                </th>
                <th scope="col" className="admin-num">
                  {text.published}
                </th>
                <th scope="col">{copy.admin.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td className="admin-num tabular-nums">{row.total}</td>
                  <td className="admin-num tabular-nums">{row.published}</td>
                  <td>
                    <div className="admin-row-actions">
                      <Link href={`/admin/products?status=all&category=${encodeURIComponent(row.name)}`} className="admin-chip">
                        {text.show}
                      </Link>
                      <CategoryRename name={row.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={text.empty} />
      )}
    </>
  );
}
