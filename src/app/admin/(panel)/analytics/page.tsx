import type { Metadata } from "next";
import Link from "next/link";
import { BarList, ColumnChart, SegmentedBar } from "@/components/admin/charts";
import type { SearchParams } from "@/components/admin/ui";
import { EmptyState, NoAccess, Notice, PageHeader, Panel, param, StatCard } from "@/components/admin/ui";
import { commerce } from "@/content/commerce";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { formatUzs } from "@/lib/money";
import { ANALYTICS_RANGES, analyticsData } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";
import { ORDER_STATUSES } from "@/server/db/schema";

export const metadata: Metadata = { title: copy.admin.pages.analytics };

const text = copy.admin.analytics;
const DAY = 24 * 60 * 60 * 1000;
const TASHKENT_OFFSET = 5 * 60 * 60 * 1000;

/** Calendar days in Tashkent from `since` to `now`, so a day with no sales shows as zero instead of vanishing. */
function daysBetween(since: Date, now: Date): string[] {
  const days: string[] = [];
  const start = new Date(since.getTime() + TASHKENT_OFFSET);
  const end = now.getTime() + TASHKENT_OFFSET;
  for (let day = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()); day <= end; day += DAY) {
    days.push(new Date(day).toISOString().slice(0, 10));
  }
  return days;
}

/** The Mondays (Tashkent) of the last 12 weeks, oldest first, matching Postgres `date_trunc('week')`. */
function lastMondays(now: Date): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const date = new Date(now.getTime() + TASHKENT_OFFSET - (11 - i) * 7 * DAY);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((date.getUTCDay() + 6) % 7))).toISOString().slice(0, 10);
  });
}

const shortDay = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** Reports from real rows only. With no sales the charts say so instead of drawing invented numbers. */
export default async function AdminAnalytics({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "analytics")) return <NoAccess />;
  const params = await searchParams;
  const requested = Number(param(params, "days"));
  const days = (ANALYTICS_RANGES as readonly number[]).includes(requested) ? (requested as (typeof ANALYTICS_RANGES)[number]) : 30;
  const data = await analyticsData(days);

  const revenueByDay = new Map(data.daily.map((row) => [row.day, row.revenue]));
  const daily = daysBetween(data.since, data.now).map((day) => {
    const value = revenueByDay.get(day) ?? 0;
    return { key: day, label: shortDay(day), value, display: formatUzs(value) };
  });
  const signupsByWeek = new Map(data.signups.map((row) => [row.week, row.value]));
  const weeks = lastMondays(data.now).map((key) => {
    const value = signupsByWeek.get(key) ?? 0;
    return { key, label: shortDay(key), value, display: String(value) };
  });
  const hasSales = data.orders > 0;
  const statusTotal = Object.values(data.statuses).reduce((sum, value) => sum + (value ?? 0), 0);

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <nav className="admin-status-tabs" aria-label={text.range}>
        {ANALYTICS_RANGES.map((range) => (
          <Link key={range} href={`/admin/analytics?days=${range}`} className="admin-tab" aria-current={range === days ? "page" : undefined}>
            {text.ranges[String(range) as keyof typeof text.ranges]}
          </Link>
        ))}
      </nav>

      <div className="admin-stats">
        <StatCard label={text.revenue} value={formatUzs(data.revenue)} icon="analytics" />
        <StatCard label={text.orders} value={data.orders} icon="orders" />
        <StatCard label={text.average} value={data.orders ? formatUzs(data.average) : copy.admin.common.none} />
        <StatCard label={text.units} value={data.units} icon="products" />
      </div>
      <p className="admin-panel-foot">{text.excluded}</p>

      {hasSales ? (
        <>
          <Panel title={text.trend}>
            <ColumnChart data={daily} label={text.trend} table={{ key: copy.admin.common.date, value: text.revenue }} />
          </Panel>
          <div className="admin-grid-2">
            <Panel title={text.top}>
              <BarList label={text.top} data={data.top.map((row) => ({ key: row.handle, label: row.name, value: row.units, display: text.unitsShort(row.units), note: formatUzs(row.revenue) }))} />
            </Panel>
            <Panel title={text.categories}>
              <BarList label={text.categories} data={data.categories.map((row) => ({ key: row.category, label: row.category, value: row.revenue, display: formatUzs(row.revenue), note: text.unitsShort(row.units) }))} />
            </Panel>
          </div>
        </>
      ) : (
        <Panel title={text.trend}>
          <EmptyState title={copy.admin.empty.orders} body={text.noOrders} />
        </Panel>
      )}

      <div className="admin-grid-2">
        <Panel title={text.status}>
          {statusTotal ? (
            <BarList
              label={text.status}
              data={ORDER_STATUSES.filter((status) => data.statuses[status]).map((status) => ({ key: status, label: copy.order.status[status], value: data.statuses[status] ?? 0, display: String(data.statuses[status] ?? 0) }))}
            />
          ) : (
            <EmptyState title={copy.admin.empty.orders} />
          )}
        </Panel>
        <Panel title={text.inventory}>
          <SegmentedBar
            label={text.inventory}
            data={[
              { key: "in", label: text.inStock, value: data.stock.in, tone: "good" },
              { key: "low", label: `${text.low} (≤ ${commerce.lowStockAt})`, value: data.stock.low, tone: "warning" },
              { key: "out", label: text.out, value: data.stock.out, tone: "critical" },
            ]}
          />
        </Panel>
      </div>

      <Panel title={text.customers}>
        {weeks.some((week) => week.value > 0) ? (
          <ColumnChart data={weeks} label={text.customers} table={{ key: copy.admin.common.date, value: copy.admin.pages.customers }} />
        ) : (
          <EmptyState title={text.noCustomers} />
        )}
      </Panel>
      {hasSales ? null : <Notice>{copy.admin.orders.noCheckout}</Notice>}
    </>
  );
}
