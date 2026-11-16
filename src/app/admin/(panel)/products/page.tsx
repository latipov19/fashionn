import type { Metadata } from "next";
import Link from "next/link";
import { icons } from "@/components/admin/icons";
import { ProductTable } from "@/components/admin/product-table";
import type { SearchParams } from "@/components/admin/ui";
import { EmptyState, FilterBar, NoAccess, oneOf, PageHeader, pageParam, Pagination, param } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { WORLD_SLUGS } from "@/content/types";
import { worlds } from "@/content/worlds";
import { can } from "@/lib/admin-roles";
import { categoryNames, PRODUCT_SORTS, PRODUCT_STATUSES, productListPage } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.products };

const text = copy.admin.products;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "catalog")) return <NoAccess />;

  const params = await searchParams;
  const filter = {
    q: param(params, "q"),
    status: oneOf(param(params, "status"), PRODUCT_STATUSES, "active"),
    world: oneOf(param(params, "world"), WORLD_SLUGS),
    category: param(params, "category"),
    kind: oneOf(param(params, "kind"), ["demo", "real"] as const),
    sort: oneOf(param(params, "sort"), PRODUCT_SORTS, "updated"),
    page: pageParam(params),
  };
  const [result, categories] = await Promise.all([productListPage(filter), categoryNames()]);
  const current = { q: filter.q, status: filter.status === "active" ? undefined : filter.status, world: filter.world, category: filter.category, kind: filter.kind, sort: filter.sort === "updated" ? undefined : filter.sort };

  return (
    <>
      <PageHeader
        kicker={text.kicker}
        title={text.title}
        lead={text.lead}
        actions={
          <Link href="/admin/products/new" className="btn btn-primary admin-btn-sm">
            {icons.plus} {text.new}
          </Link>
        }
      />
      <FilterBar
        path="/admin/products"
        q={filter.q}
        placeholder={copy.admin.common.searchPlaceholder}
        selects={[
          {
            name: "status",
            label: text.filters.status,
            value: filter.status,
            options: [
              { value: "active", label: text.filters.active },
              { value: "published", label: copy.admin.status.published },
              { value: "draft", label: copy.admin.status.draft },
              { value: "archived", label: copy.admin.status.archived },
              { value: "all", label: copy.admin.common.all },
            ],
          },
          { name: "world", label: text.filters.world, value: filter.world, allLabel: copy.admin.common.all, options: WORLD_SLUGS.map((slug) => ({ value: slug, label: worlds[slug].name })) },
          { name: "category", label: text.filters.category, value: filter.category, allLabel: copy.admin.common.all, options: categories.map((name) => ({ value: name, label: name })) },
          {
            name: "kind",
            label: text.filters.kind,
            value: filter.kind,
            allLabel: copy.admin.common.all,
            options: [
              { value: "demo", label: text.filters.demo },
              { value: "real", label: text.filters.real },
            ],
          },
          {
            name: "sort",
            label: text.filters.sort,
            value: filter.sort,
            options: [
              { value: "updated", label: text.filters.sortUpdated },
              { value: "name", label: text.filters.sortName },
              { value: "price_asc", label: text.filters.sortPriceAsc },
              { value: "price_desc", label: text.filters.sortPriceDesc },
              { value: "stock", label: text.filters.sortStock },
            ],
          },
        ]}
      />
      {result.rows.length ? <ProductTable rows={result.rows} /> : <EmptyState title={text.empty} />}
      <Pagination path="/admin/products" params={current} page={result.page} pages={result.pages} total={result.total} />
    </>
  );
}
