import { copy } from "@/content/copy";
import { worlds } from "@/content/worlds";
import { discountPercent, formatUzs } from "@/lib/money";
import type { CatalogProduct } from "@/server/catalog";
import { primaryMedia } from "@/server/media";

export function Price({ priceUzs, compareAtUzs }: { priceUzs: number; compareAtUzs: number | null }) {
  const off = discountPercent(priceUzs, compareAtUzs);
  return (
    <p className="price">
      <span className="price-now">{formatUzs(priceUzs)}</span>
      {compareAtUzs && off ? (
        <>
          <span className="sr-only">{copy.product.saleLabel}:</span>
          <s className="price-was">{formatUzs(compareAtUzs)}</s>
          <span className="price-off" aria-hidden="true">
            −{off}%
          </span>
        </>
      ) : null}
    </p>
  );
}

/** The lead image of the first colour that has one. */
export function leadImage(product: CatalogProduct) {
  for (const color of product.colors) {
    const media = primaryMedia(color.media);
    if (media) return media;
  }
  return null;
}

export function ProductCard({ product, sizes = "(max-width: 640px) 78vw, (max-width: 900px) 50vw, 25vw", compact = false }: { product: CatalogProduct; sizes?: string; compact?: boolean }) {
  const image = leadImage(product);
  const href = `/products/${product.handle}`;

  return (
    <article className="card">
      <div className="card-media" style={image ? { backgroundImage: `url(${image.blur})` } : undefined}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
          <img
            src={image.url}
            srcSet={image.srcSet.map((source) => `${source.url} ${source.width}w`).join(", ")}
            sizes={sizes}
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div className="card-tags">
          {product.isDemo ? <span className="demo-tag">{copy.demoTag}</span> : null}
          {product.soldOut ? <span className="demo-tag">{copy.micro.soldOut}</span> : null}
        </div>
        <span className="card-go" aria-hidden="true">
          →
        </span>
      </div>
      <div className="card-body">
        <div className="card-head">
          <h3 className="card-title">
            <a href={href} className="card-link">
              {product.name}
            </a>
          </h3>
          {compact ? null : (
            <div className="swatches" aria-label={`${copy.product.color}: ${product.colors.map((color) => color.name).join(", ")}`} role="img">
              {product.colors.map((color) => (
                <span key={color.id} className="swatch" style={{ backgroundColor: color.hex }} />
              ))}
            </div>
          )}
        </div>
        {compact ? null : <p className="card-meta">{[product.category, ...product.worlds.map((world) => worlds[world].name)].join(" · ")}</p>}
        <Price priceUzs={product.priceUzs} compareAtUzs={product.compareAtUzs} />
      </div>
    </article>
  );
}
