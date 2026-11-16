import type { Metadata } from "next";
import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { Badge, EmptyState, formatDate, Notice, OrderStatusBadge, PageHeader, Panel, ProductStatusBadge, StatCard } from "@/components/admin/ui";
import { commerce } from "@/content/commerce";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { formatUzs } from "@/lib/money";
import { dashboardData } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.dashboard };

const text = copy.admin.dashboard;

/** The overview. Every number is a count or sum over real rows; demo catalogue and real sales are told apart. */
export default async function AdminDashboard() {
  const session = await requireAdminPage();
  const data = await dashboardData(session);
  const { products } = data;
  const canCatalog = can(session.role, "catalog");
  const canInventory = can(session.role, "inventory");
  const share = (part: number) => (products.total ? Math.round((part / products.total) * 100) : 0);

  return (
    <>
      <PageHeader
        kicker={text.kicker}
        title={text.title}
        actions={
          canCatalog ? (
            <Link href="/admin/products/new" className="btn btn-primary admin-btn-sm">
              {icons.plus} {text.quickNew}
            </Link>
          ) : null
        }
      />
      {products.demo > 0 ? <Notice>{text.demoNote}</Notice> : null}

      <div className="admin-stats">
        <StatCard label={text.stats.products} value={products.total} note={products.demo ? text.stats.demoProducts(products.demo) : undefined} href={canCatalog ? "/admin/products?status=all" : undefined} icon="products" />
        <StatCard label={text.stats.published} value={products.published} href={canCatalog ? "/admin/products?status=published" : undefined} icon="dashboard" />
        <StatCard label={text.stats.drafts} value={products.drafts} href={canCatalog ? "/admin/products?status=draft" : undefined} tone={products.drafts ? "warn" : undefined} />
        {data.customers ? (
          <StatCard label={text.stats.customers} value={data.customers.total} note={text.stats.newCustomers(data.customers.recent)} href="/admin/customers" icon="customers" />
        ) : null}
        {data.orders ? <StatCard label={text.stats.orders} value={data.orders.total} href="/admin/orders" icon="orders" /> : null}
        {data.orders ? <StatCard label={text.stats.revenue} value={formatUzs(data.orders.revenue)} href="/admin/analytics" icon="analytics" /> : null}
        <StatCard label={text.stats.lowStock} value={data.stock.low} href={canInventory ? "/admin/inventory?state=low" : undefined} icon="inventory" tone={data.stock.low ? "warn" : undefined} />
        <StatCard label={text.stats.outOfStock} value={data.stock.out} href={canInventory ? "/admin/inventory?state=out" : undefined} tone={data.stock.out ? "danger" : undefined} />
      </div>

      <div className="admin-grid-2">
        {data.orders ? (
          <Panel
            title={text.recentOrders}
            actions={
              <Link href="/admin/orders" className="admin-link-muted">
                {copy.admin.common.viewAll}
              </Link>
            }
          >
            {data.recentOrders.length ? (
              <ul className="admin-list">
                {data.recentOrders.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="admin-list-row">
                      <span className="admin-list-main">
                        <span className="admin-mono">{order.number}</span>
                        <span className="text-muted">{order.customerName}</span>
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
              <EmptyState title={copy.admin.empty.orders} body={text.noOrders} />
            )}
          </Panel>
        ) : null}

        <Panel title={text.lowStock} actions={canInventory ? <Link href="/admin/inventory?state=low" className="admin-link-muted">{copy.admin.common.viewAll}</Link> : null}>
          {data.lowStock.length ? (
            <ul className="admin-list">
              {data.lowStock.map((row) => (
                <li key={row.variantId}>
                  <Link href={canCatalog ? `/admin/products/${row.productId}#inventory` : "/admin/inventory"} className="admin-list-row">
                    <span className="admin-list-main">
                      <span>{row.productName}</span>
                      <span className="text-muted">
                        {row.colorName} · {row.size}
                      </span>
                    </span>
                    <Badge tone={row.stock === 0 ? "danger" : "warn"}>{row.stock}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={text.noLowStock} />
          )}
          <p className="admin-panel-foot">{copy.admin.inventory.low(commerce.lowStockAt)}</p>
        </Panel>

        <Panel title={text.recentProducts} actions={canCatalog ? <Link href="/admin/products" className="admin-link-muted">{copy.admin.common.viewAll}</Link> : null}>
          <ul className="admin-list">
            {data.recentProducts.map((product) => (
              <li key={product.id}>
                <Link href={canCatalog ? `/admin/products/${product.id}` : "/admin"} className="admin-list-row">
                  <span className="admin-list-main">
                    <span>{product.name}</span>
                    <span className="text-muted">{formatDate(product.createdAt)}</span>
                  </span>
                  <span className="admin-list-side">
                    {product.isDemo ? <span className="demo-tag">{copy.admin.common.demo}</span> : null}
                    <ProductStatusBadge published={product.published} archived={product.archivedAt !== null} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={text.publication}>
          <div className="admin-meter" role="img" aria-label={`${text.stats.published} ${products.published}, ${text.stats.drafts} ${products.drafts}, ${text.stats.archived} ${products.archived}`}>
            <span data-tone="ok" style={{ flexGrow: products.published }} />
            <span data-tone="warn" style={{ flexGrow: products.drafts }} />
            <span data-tone="muted" style={{ flexGrow: products.archived }} />
          </div>
          <dl className="admin-legend">
            <div>
              <dt>
                <i data-tone="ok" /> {text.stats.published}
              </dt>
              <dd className="tabular-nums">
                {products.published} · {share(products.published)}%
              </dd>
            </div>
            <div>
              <dt>
                <i data-tone="warn" /> {text.stats.drafts}
              </dt>
              <dd className="tabular-nums">
                {products.drafts} · {share(products.drafts)}%
              </dd>
            </div>
            <div>
              <dt>
                <i data-tone="muted" /> {text.stats.archived}
              </dt>
              <dd className="tabular-nums">
                {products.archived} · {share(products.archived)}%
              </dd>
            </div>
          </dl>
          <div className="admin-quick">
            <p className="admin-panel-title">{text.quick}</p>
            {canCatalog ? (
              <Link href="/admin/products/new" className="admin-quick-link">
                {icons.plus} {text.quickNew}
              </Link>
            ) : null}
            {canInventory ? (
              <Link href="/admin/inventory" className="admin-quick-link">
                {icons.inventory} {text.quickInventory}
              </Link>
            ) : null}
            {data.orders ? (
              <Link href="/admin/orders" className="admin-quick-link">
                {icons.orders} {text.quickOrders}
              </Link>
            ) : null}
            {canCatalog ? (
              <Link href="/admin/media" className="admin-quick-link">
                {icons.media} {text.quickMedia}
              </Link>
            ) : null}
          </div>
        </Panel>
      </div>
    </>
  );
}
