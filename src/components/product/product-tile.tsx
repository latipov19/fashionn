import Link from "next/link";
import { copy } from "@/content/copy";
import { discountPercent, formatUzs } from "@/lib/money";
import type { ShopImage } from "@/lib/shop";

/*
 * The product card's markup, free of server imports, so the server-rendered shelves and the
 * shop's client-side grid draw the same card from the same code.
 */

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

export type ProductTileProps = {
  href: string;
  name: string;
  image: ShopImage | null;
  /** A second view shown on hover, where the device has one. */
  hoverImage?: ShopImage | null;
  /** Category and lines. Left out on compact cards. */
  meta?: string | null;
  colors?: readonly { name: string; hex: string }[] | null;
  priceUzs: number;
  compareAtUzs: number | null;
  isDemo?: boolean;
  soldOut?: boolean;
  isNew?: boolean;
  sizes?: string;
  /** The first row above the fold loads at once instead of lazily. */
  eager?: boolean;
};

const DEFAULT_SIZES = "(max-width: 640px) 78vw, (max-width: 900px) 50vw, 25vw";

export function ProductTile({ href, name, image, hoverImage, meta, colors, priceUzs, compareAtUzs, isDemo, soldOut, isNew, sizes = DEFAULT_SIZES, eager = false }: ProductTileProps) {
  const loading = eager ? "eager" : "lazy";
  return (
    <article className="card" data-sold-out={soldOut ? "true" : undefined}>
      <div className="card-media" style={image ? { backgroundImage: `url(${image.blur})` } : undefined}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP from the media pipeline
          <img src={image.src} srcSet={image.srcSet} sizes={sizes} width={image.width} height={image.height} alt={image.alt} loading={loading} decoding="async" />
        ) : null}
        {hoverImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- decorative second view, the first image carries the alt text
          <img className="card-alt" src={hoverImage.src} srcSet={hoverImage.srcSet} sizes={sizes} width={hoverImage.width} height={hoverImage.height} alt="" loading="lazy" decoding="async" />
        ) : null}
        <div className="card-tags">
          {isNew ? <span className="demo-tag card-new">{copy.shop.newBadge}</span> : null}
          {isDemo ? <span className="demo-tag">{copy.demoTag}</span> : null}
          {soldOut ? <span className="demo-tag">{copy.micro.soldOut}</span> : null}
        </div>
        <span className="card-go" aria-hidden="true">
          →
        </span>
      </div>
      <div className="card-body">
        <div className="card-head">
          <h3 className="card-title">
            <Link href={href} className="card-link" prefetch={false}>
              {name}
            </Link>
          </h3>
          {colors?.length ? (
            <div className="swatches" aria-label={`${copy.product.color}: ${colors.map((color) => color.name).join(", ")}`} role="img">
              {colors.map((color) => (
                <span key={color.name} className="swatch" style={{ backgroundColor: color.hex }} />
              ))}
            </div>
          ) : null}
        </div>
        {meta ? <p className="card-meta">{meta}</p> : null}
        <Price priceUzs={priceUzs} compareAtUzs={compareAtUzs} />
      </div>
    </article>
  );
}
