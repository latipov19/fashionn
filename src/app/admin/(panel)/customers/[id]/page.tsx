import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EndSessionsButton } from "@/components/admin/forms";
import { Badge, EmptyState, formatDate, formatDateTime, NoAccess, OrderStatusBadge, PageHeader, Panel } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { formatUzs } from "@/lib/money";
import { idSchema } from "@/lib/validation";
import { customerDetail } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.customers };

const text = copy.admin.customers;

/** One shopper. No password, hash or token is read for this page; staff can close sessions but never act as the shopper. */
export default async function AdminCustomer({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "customers")) return <NoAccess />;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const data = await customerDetail(id);
  if (!data) notFound();
  const { customer, orders } = data;
  const detail = text.detail;

  return (
    <>
      <PageHeader kicker={text.kicker} title={customer.name ?? text.noName} lead={customer.email} />
      <div className="admin-edit-layout">
        <div className="admin-edit-main">
          <Panel title={detail.orders}>
            <p className="admin-panel-foot">{detail.ordersNote}</p>
            {orders.length ? (
              <ul className="admin-list">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link href={can(session.role, "orders") ? `/admin/orders/${order.id}` : "#"} className="admin-list-row">
                      <span className="admin-list-main">
                        <span className="admin-mono">{order.number}</span>
                        <span className="text-muted">{formatDateTime(order.createdAt)}</span>
                      </span>
                      <span className="admin-list-side">
                        <span className="tabular-nums">{formatUzs(order.totalUzs)}</span>
                        <OrderStatusBadge status={order.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={detail.noOrders} />
            )}
          </Panel>
        </div>
        <aside className="admin-edit-side">
          <Panel title={detail.profile}>
            <dl className="admin-facts">
              <div>
                <dt>{detail.registered}</dt>
                <dd className="tabular-nums">{formatDate(customer.createdAt)}</dd>
              </div>
              <div>
                <dt>{detail.status}</dt>
                <dd>
                  <Badge tone="ok">{detail.active}</Badge>
                </dd>
              </div>
              <div>
                <dt>{detail.sessions}</dt>
                <dd className="tabular-nums">{customer.sessions}</dd>
              </div>
            </dl>
            <p className="admin-panel-foot">{detail.endSessionsNote}</p>
            <EndSessionsButton customerId={customer.id} disabled={customer.sessions === 0} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
