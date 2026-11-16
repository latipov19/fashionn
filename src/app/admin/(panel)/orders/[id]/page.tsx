import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusControl } from "@/components/admin/forms";
import { formatDateTime, NoAccess, OrderStatusBadge, PageHeader, Panel } from "@/components/admin/ui";
import { regionById } from "@/content/commerce";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { formatUzs } from "@/lib/money";
import { idSchema } from "@/lib/validation";
import { customerForEmail } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";
import { adminGetOrder, allowedNextStatuses } from "@/server/orders";

export const metadata: Metadata = { title: copy.admin.pages.orders };

const text = copy.admin.orders;

/** One order: lines and totals as stored at purchase, delivery details, and the next allowed steps. Payment is never marked paid here. */
export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "orders")) return <NoAccess />;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const order = await adminGetOrder(id);
  if (!order) notFound();
  const account = can(session.role, "customers") ? await customerForEmail(order.email) : null;
  const detail = text.detail;

  return (
    <>
      <PageHeader kicker={text.kicker} title={order.number} lead={formatDateTime(order.createdAt)} actions={<OrderStatusBadge status={order.status} />} />
      <div className="admin-edit-layout">
        <div className="admin-edit-main">
          <Panel title={detail.items}>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">{copy.admin.products.columns.product}</th>
                    <th scope="col">SKU</th>
                    <th scope="col" className="admin-num">
                      {text.columns.items}
                    </th>
                    <th scope="col" className="admin-num">
                      {copy.admin.products.columns.price}
                    </th>
                    <th scope="col" className="admin-num">
                      {detail.total}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.productName}
                        <span className="text-muted admin-block">
                          {line.colorName} · {line.size}
                        </span>
                      </td>
                      <td className="admin-mono text-muted">{line.sku}</td>
                      <td className="admin-num tabular-nums">{line.quantity}</td>
                      <td className="admin-num tabular-nums">{formatUzs(line.unitPriceUzs)}</td>
                      <td className="admin-num tabular-nums">{formatUzs(line.lineTotalUzs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="admin-totals">
              <div>
                <dt>{detail.subtotal}</dt>
                <dd className="tabular-nums">{formatUzs(order.subtotalUzs)}</dd>
              </div>
              <div>
                <dt>{detail.deliveryFee}</dt>
                <dd className="tabular-nums">{formatUzs(order.deliveryUzs)}</dd>
              </div>
              <div className="admin-totals-sum">
                <dt>{detail.total}</dt>
                <dd className="tabular-nums">{formatUzs(order.totalUzs)}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title={detail.status}>
            <OrderStatusControl orderId={order.id} next={allowedNextStatuses(order.status)} />
          </Panel>
        </div>
        <aside className="admin-edit-side">
          <Panel title={detail.customer}>
            <dl className="admin-facts">
              <div>
                <dt>{copy.admin.customers.columns.customer}</dt>
                <dd>{order.customerName}</dd>
              </div>
              <div>
                <dt>{detail.phone}</dt>
                <dd>
                  <a href={`tel:${order.phone}`}>{order.phone}</a>
                </dd>
              </div>
              <div>
                <dt>{detail.email}</dt>
                <dd>{order.email ?? copy.admin.common.none}</dd>
              </div>
              {can(session.role, "customers") ? (
                <div>
                  <dt>{detail.account}</dt>
                  <dd>{account ? <Link href={`/admin/customers/${account.id}`}>{copy.admin.common.open}</Link> : <span className="text-muted">{detail.noAccount}</span>}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>
          <Panel title={detail.delivery}>
            <dl className="admin-facts">
              <div>
                <dt>{detail.region}</dt>
                <dd>{regionById(order.address.region)?.label ?? order.address.region}</dd>
              </div>
              <div>
                <dt>{detail.city}</dt>
                <dd>{order.address.city}</dd>
              </div>
              <div>
                <dt>{detail.address}</dt>
                <dd>{order.address.line}</dd>
              </div>
            </dl>
            {order.notes ? (
              <>
                <p className="admin-panel-title">{detail.notes}</p>
                <p className="admin-quote">{order.notes}</p>
              </>
            ) : null}
          </Panel>
          <Panel title={detail.payment}>
            <dl className="admin-facts">
              <div>
                <dt>{detail.payment}</dt>
                <dd>{text.payment[order.paymentProvider as keyof typeof text.payment] ?? order.paymentProvider}</dd>
              </div>
              <div>
                <dt>{detail.status}</dt>
                <dd>{text.payment[order.paymentStatus as keyof typeof text.payment] ?? order.paymentStatus}</dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </>
  );
}
