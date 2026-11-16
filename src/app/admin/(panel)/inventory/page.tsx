import type { Metadata } from "next";
import { StockEditor } from "@/components/admin/stock-editor";
import type { SearchParams } from "@/components/admin/ui";
import { EmptyState, FilterBar, formatDateTime, NoAccess, oneOf, PageHeader, pageParam, Pagination, Panel, param } from "@/components/admin/ui";
import { commerce } from "@/content/commerce";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { inventoryPage, stockHistory } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.inventory };

const text = copy.admin.inventory;
const STATES = ["all", "low", "out", "in"] as const;

export default async function AdminInventory({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "inventory")) return <NoAccess />;
  const params = await searchParams;
  const filter = { q: param(params, "q"), state: oneOf(param(params, "state"), STATES, "all"), page: pageParam(params) };
  const [result, history] = await Promise.all([inventoryPage(filter), stockHistory({ limit: 15 })]);

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <FilterBar
        path="/admin/inventory"
        q={filter.q}
        placeholder={copy.admin.common.searchPlaceholder}
        selects={[
          {
            name: "state",
            label: text.filters.state,
            value: filter.state,
            options: [
              { value: "all", label: copy.admin.common.all },
              { value: "low", label: `${text.filters.low} (${text.low(commerce.lowStockAt)})` },
              { value: "out", label: text.filters.out },
              { value: "in", label: text.filters.inStock },
            ],
          },
        ]}
      />
      {result.rows.length ? (
        <StockEditor
          lowAt={commerce.lowStockAt}
          rows={result.rows.map((row) => ({ variantId: row.variantId, label: `${row.productName} · ${row.colorName} · ${row.size}`, sku: row.sku, stock: row.stock, inactive: !row.colorActive, hex: row.colorHex }))}
        />
      ) : (
        <EmptyState title={text.empty} />
      )}
      <Pagination path="/admin/inventory" params={{ q: filter.q, state: filter.state === "all" ? undefined : filter.state }} page={result.page} pages={result.pages} total={result.total} />

      <Panel title={text.history}>
        {history.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{text.historyColumns.when}</th>
                  <th scope="col">{text.historyColumns.item}</th>
                  <th scope="col" className="admin-num">
                    {text.historyColumns.change}
                  </th>
                  <th scope="col">{text.historyColumns.reason}</th>
                  <th scope="col">{text.historyColumns.who}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-muted tabular-nums">{formatDateTime(entry.createdAt)}</td>
                    <td>
                      {entry.productName} · {entry.colorName} · {entry.size}
                      <span className="admin-mono text-muted admin-block">{entry.sku}</span>
                    </td>
                    <td className="admin-num tabular-nums">
                      {entry.previousStock} → {entry.newStock}
                    </td>
                    <td>{text.reasons[entry.reason as keyof typeof text.reasons] ?? entry.reason}</td>
                    <td className="text-muted">{entry.actorEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={text.historyEmpty} />
        )}
      </Panel>
    </>
  );
}
