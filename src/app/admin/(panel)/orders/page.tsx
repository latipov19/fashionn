import type { Metadata } from "next";
import Link from "next/link";
import type { SearchParams } from "@/components/admin/ui";
import { EmptyState, FilterBar, formatDateTime, NoAccess, Notice, oneOf, OrderStatusBadge, PageHeader, pageParam, Pagination, param } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { formatUzs } from "@/lib/money";
import { orderListPage } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";
import { ORDER_STATUSES } from "@/server/db/schema";

export const metadata: Metadata = { title: copy.admin.pages.orders };

const text = copy.admin.orders;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "orders")) return <NoAccess />;
  const params = await searchParams;
  const filter = { q: param(params, "q"), status: oneOf(param(params, "status"), ORDER_STATUSES), page: pageParam(params) };
  const result = await orderListPage(filter);
  const any = Object.values(result.byStatus).some(Boolean);

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <Notice>{text.noCheckout}</Notice>
      <div className="admin-status-tabs" role="list">
        <Link role="listitem" href="/admin/orders" className="admin-tab" aria-current={!filter.status ? "page" : undefined}>
          {copy.admin.common.all}
        </Link>
        {ORDER_STATUSES.map((status) => (
          <Link role="listitem" key={status} href={`/admin/orders?status=${status}`} className="admin-tab" aria-current={filter.status === status ? "page" : undefined}>
            {copy.order.status[status]} <span className="tabular-nums text-muted">{result.byStatus[status] ?? 0}</span>
          </Link>
        ))}
      </div>
      <FilterBar path="/admin/orders" q={filter.q} placeholder={text.searchPlaceholder} hidden={{ status: filter.status }} />
      {result.rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{text.columns.number}</th>
                <th scope="col">{text.columns.customer}</th>
                <th scope="col">{text.columns.date}</th>
                <th scope="col" className="admin-num">
                  {text.columns.items}
                </th>
                <th scope="col" className="admin-num">
                  {text.columns.total}
                </th>
                <th scope="col">{text.columns.status}</th>
                <th scope="col">{text.columns.payment}</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/orders/${order.id}`} className="admin-mono admin-strong-link">
                      {order.number}
                    </Link>
                  </td>
                  <td>
                    {order.customerName}
                    <span className="text-muted admin-block">{order.phone}</span>
                  </td>
                  <td className="text-muted tabular-nums">{formatDateTime(order.createdAt)}</td>
                  <td className="admin-num tabular-nums">{order.items}</td>
                  <td className="admin-num tabular-nums">{formatUzs(order.totalUzs)}</td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="text-muted">{text.payment[order.paymentStatus as keyof typeof text.payment] ?? order.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={any ? text.empty : copy.admin.empty.orders} body={any ? undefined : copy.admin.dashboard.noOrders} />
      )}
      <Pagination path="/admin/orders" params={{ q: filter.q, status: filter.status }} page={result.page} pages={result.pages} total={result.total} />
    </>
  );
}
