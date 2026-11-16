import type { Metadata } from "next";
import Link from "next/link";
import type { SearchParams } from "@/components/admin/ui";
import { Badge, EmptyState, FilterBar, formatDate, NoAccess, PageHeader, pageParam, Pagination, param } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { customerListPage } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.customers };

const text = copy.admin.customers;

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "customers")) return <NoAccess />;
  const params = await searchParams;
  const filter = { q: param(params, "q"), page: pageParam(params) };
  const result = await customerListPage(filter);

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <FilterBar path="/admin/customers" q={filter.q} placeholder={text.searchPlaceholder} />
      {result.rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{text.columns.customer}</th>
                <th scope="col">{text.columns.registered}</th>
                <th scope="col" className="admin-num">
                  {text.columns.orders}
                </th>
                <th scope="col" className="admin-num">
                  {text.columns.sessions}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <Link href={`/admin/customers/${customer.id}`} className="admin-strong-link">
                      {customer.name ?? text.noName}
                    </Link>
                    <span className="text-muted admin-block">{customer.email}</span>
                  </td>
                  <td className="text-muted tabular-nums">{formatDate(customer.createdAt)}</td>
                  <td className="admin-num tabular-nums">{customer.orders}</td>
                  <td className="admin-num">{customer.sessions ? <Badge tone="ok">{customer.sessions}</Badge> : <span className="text-muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={filter.q ? copy.admin.products.empty : text.empty} />
      )}
      <Pagination path="/admin/customers" params={{ q: filter.q }} page={result.page} pages={result.pages} total={result.total} />
    </>
  );
}
