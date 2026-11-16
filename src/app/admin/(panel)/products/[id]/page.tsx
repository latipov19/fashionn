import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DangerZone } from "@/components/admin/danger-zone";
import { icons } from "@/components/admin/icons";
import { MediaManager } from "@/components/admin/media-manager";
import type { EditorValues } from "@/components/admin/product-editor";
import { ProductEditor } from "@/components/admin/product-editor";
import { StockEditor } from "@/components/admin/stock-editor";
import { Badge, EmptyState, formatDateTime, NoAccess, PageHeader, Panel, ProductStatusBadge } from "@/components/admin/ui";
import { ProductCard } from "@/components/product/product-card";
import { commerce } from "@/content/commerce";
import { copy } from "@/content/copy";
import { can } from "@/lib/admin-roles";
import { idSchema } from "@/lib/validation";
import { categoryNames, productAdminFacts, stockHistory } from "@/server/admin/queries";
import { requireAdminPage } from "@/server/auth";
import { adminGetProduct } from "@/server/catalog";

export const metadata: Metadata = { title: copy.admin.shell.edit };

const text = copy.admin.editor;
const mediaText = copy.admin.media;

/**
 * One product: the editor, then stock, images and 3D per colour, how it looks in the shop, its
 * stock history and the archive and delete controls. Removed colours stay out of the editor but
 * keep their stock rows, so past orders still read.
 */
export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage();
  if (!can(session.role, "catalog")) return <NoAccess />;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const [product, facts, categories] = await Promise.all([adminGetProduct(id), productAdminFacts(id), categoryNames()]);
  if (!product || !facts) notFound();
  const canInventory = can(session.role, "inventory");
  const history = await stockHistory({ productId: id, limit: 10 });

  const activeColors = product.colors.filter((color) => color.active);
  const initial: EditorValues = {
    name: product.name,
    handle: product.handle,
    category: product.category,
    slot: product.slot,
    priceUzs: String(product.priceUzs),
    compareAtUzs: product.compareAtUzs === null ? "" : String(product.compareAtUzs),
    description: product.description,
    fabric: product.fabric,
    fit: product.fit,
    care: product.care,
    colors: activeColors.map((color) => ({ slug: color.slug, name: color.name, hex: color.hex })),
    sizes: product.sizes.join(", "),
    worlds: product.worlds,
    published: product.published,
    isDemo: product.isDemo,
  };
  // The shop's own card, fed what the shop would show: active colours and visible images only.
  const preview = { ...product, colors: activeColors.map((color) => ({ ...color, media: color.media.filter((item) => !item.hidden) })) };
  const archived = facts.archivedAt !== null;

  return (
    <>
      <PageHeader
        kicker={copy.admin.products.kicker}
        title={product.name}
        lead={text.editLead}
        actions={
          <>
            <ProductStatusBadge published={product.published} archived={archived} />
            {product.isDemo ? <span className="demo-tag">{copy.admin.common.demo}</span> : null}
          </>
        }
      />

      <div className="admin-edit-layout">
        <div className="admin-edit-main">
          <ProductEditor mode="edit" productId={product.id} initial={initial} categories={categories} />

          <Panel title={text.sections.inventory} className="admin-anchor">
            <span id="inventory" className="admin-anchor" />
            {canInventory ? (
              <StockEditor
                lowAt={commerce.lowStockAt}
                rows={product.colors.flatMap((color) =>
                  color.variants.map((variant) => ({ variantId: variant.id, label: `${color.name} · ${variant.size}`, sku: variant.sku, stock: variant.stock, inactive: !color.active, hex: color.hex })),
                )}
              />
            ) : (
              <p className="text-muted">{copy.admin.errors.forbidden}</p>
            )}
          </Panel>

          <Panel title={text.sections.media} className="admin-anchor">
            <span id="media" className="admin-anchor" />
            <MediaManager productId={product.id} colors={activeColors.map((color) => ({ id: color.id, name: color.name, hex: color.hex, media: color.media }))} />
          </Panel>

          <Panel title={text.sections.danger} className="admin-panel-danger">
            <DangerZone productId={product.id} handle={product.handle} archived={archived} orderLines={facts.orderLines} />
          </Panel>
        </div>

        <aside className="admin-edit-side">
          <Panel title={text.sections.preview}>
            <div className="admin-preview">
              <ProductCard product={preview} compact sizes="280px" />
            </div>
            <p className="admin-panel-foot">{text.previewNote}</p>
          </Panel>

          <Panel title={text.sections.model}>
            <ul className="admin-list">
              {activeColors.map((color) => (
                <li key={color.id} className="admin-list-row">
                  <span className="admin-list-main">
                    <span className="admin-variant">
                      <span className="admin-swatch admin-swatch-sm" style={{ background: color.hex }} aria-hidden="true" />
                      {color.name}
                    </span>
                    {color.model ? <span className="admin-mono text-muted">{color.model.url}</span> : null}
                  </span>
                  {color.model ? (
                    <Badge tone="info">
                      {icons.cube} {mediaText.modelSize((color.model.bytes / 1024 / 1024).toFixed(1))}
                    </Badge>
                  ) : (
                    <Badge>{mediaText.modelMissing}</Badge>
                  )}
                </li>
              ))}
            </ul>
            <p className="admin-panel-foot">{mediaText.modelHowTo}</p>
          </Panel>

          <Panel title={text.sections.history}>
            {history.length ? (
              <ul className="admin-list">
                {history.map((entry) => (
                  <li key={entry.id} className="admin-list-row">
                    <span className="admin-list-main">
                      <span>
                        {entry.colorName} · {entry.size}: <span className="tabular-nums">{entry.previousStock} → {entry.newStock}</span>
                      </span>
                      <span className="text-muted">
                        {copy.admin.inventory.reasons[entry.reason as keyof typeof copy.admin.inventory.reasons] ?? entry.reason} · {entry.actorEmail} · {formatDateTime(entry.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={copy.admin.inventory.historyEmpty} />
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
