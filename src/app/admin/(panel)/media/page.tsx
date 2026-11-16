import type { Metadata } from "next";
import Link from "next/link";
import { icons } from "@/components/admin/icons";
import type { SearchParams } from "@/components/admin/ui";
import { Badge, EmptyState, FilterBar, NoAccess, Notice, oneOf, PageHeader, pageParam, Pagination, param, StatCard } from "@/components/admin/ui";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { mediaLibrary } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";

export const metadata: Metadata = { title: copy.admin.pages.media };

const text = copy.admin.media;
const SHOW = ["all", "model", "no_model", "uploads"] as const;

/** Every product colour with its lead image, image counts and 3D model. Uploads happen in the product editor, where the colour is chosen. */
export default async function AdminMedia({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "catalog")) return <NoAccess />;
  const params = await searchParams;
  const filter = { q: param(params, "q"), show: oneOf(param(params, "show"), SHOW, "all"), page: pageParam(params) };
  const result = await mediaLibrary(filter);

  return (
    <>
      <PageHeader kicker={text.kicker} title={text.title} lead={text.lead} />
      <div className="admin-stats admin-stats-3">
        <StatCard label={text.color} value={result.counts.colors} icon="media" />
        <StatCard label={text.modelReady} value={result.counts.models} icon="cube" href="/admin/media?show=model" />
        <StatCard label={text.upload_source} value={result.counts.uploads} icon="plus" href="/admin/media?show=uploads" />
      </div>
      <Notice>{text.modelHowTo}</Notice>
      <Notice tone="warn">{text.modelUploadNote}</Notice>
      <FilterBar
        path="/admin/media"
        q={filter.q}
        placeholder={copy.admin.common.searchPlaceholder}
        selects={[
          {
            name: "show",
            label: copy.admin.common.filter,
            value: filter.show,
            options: [
              { value: "all", label: text.filterAll },
              { value: "model", label: text.filterModel },
              { value: "no_model", label: text.filterNoModel },
              { value: "uploads", label: text.filterUploads },
            ],
          },
        ]}
      />
      {result.rows.length ? (
        <ul className="admin-media-library">
          {result.rows.map((row) => (
            <li key={row.colorId}>
              <Link href={`/admin/products/${row.productId}#media`} className="admin-media-card">
                <span className="admin-media-thumb" style={row.lead ? { backgroundImage: `url(${row.lead.blur})` } : { background: row.hex }}>
                  {row.lead ? (
                    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
                    <img src={row.lead.srcSet[0]?.url ?? row.lead.url} alt="" width={160} height={200} loading="lazy" decoding="async" />
                  ) : null}
                  {row.model ? <span className="admin-media-3d">{icons.cube} 3D</span> : null}
                </span>
                <span className="admin-media-card-text">
                  <span className="admin-product-name">{row.productName}</span>
                  <span className="admin-variant text-muted">
                    <span className="admin-swatch admin-swatch-sm" style={{ background: row.hex }} aria-hidden="true" />
                    {row.colorName}
                  </span>
                  <span className="admin-media-tags">
                    <Badge>
                      {text.images}: {row.images}
                    </Badge>
                    {row.uploads ? <Badge tone="info">{text.upload_source}: {row.uploads}</Badge> : null}
                    {row.hidden ? <Badge tone="warn">{text.hidden}: {row.hidden}</Badge> : null}
                    {row.model ? <Badge tone="info">{text.modelSize((row.model.bytes / 1024 / 1024).toFixed(1))}</Badge> : <Badge>{text.modelMissing}</Badge>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={text.empty} />
      )}
      <Pagination path="/admin/media" params={{ q: filter.q, show: filter.show === "all" ? undefined : filter.show }} page={result.page} pages={result.pages} total={result.total} />
    </>
  );
}
