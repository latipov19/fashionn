import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product/product-card";
import type { PurchaseProduct } from "@/components/product/product-purchase";
import { ProductPurchase } from "@/components/product/product-purchase";
import { copy } from "@/content/copy";
import { DEFAULT_WORLD, isWorldSlug, worlds } from "@/content/worlds";
import { shopHref } from "@/lib/shop";
import { categorySlug, getProductByHandle, listRelatedProducts } from "@/server/catalog";
import type { MediaRecord } from "@/content/types";
import { leadsWithGeneratedImage, primaryMedia, visibleMedia } from "@/server/media";
import { toShopImage } from "@/server/shop";
import "../../store.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductByHandle((await params).handle);
  return product ? { title: product.name, description: product.description } : { title: copy.notFound.title };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** The lead image first (detail crops never lead), then the rest in their order. */
function galleryFor(media: readonly MediaRecord[]): MediaRecord[] {
  const lead = primaryMedia(media);
  const rest = visibleMedia(media).filter((item) => item.id !== lead?.id);
  return lead ? [lead, ...rest] : rest;
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const product = await getProductByHandle(handle);
  if (!product) notFound();

  // The page takes the world it was opened from when the product lives there, otherwise its own.
  const asked = first(query.world);
  const world = isWorldSlug(asked) && product.worlds.includes(asked) ? asked : (product.worlds[0] ?? DEFAULT_WORLD);
  const askedColor = first(query.color);
  const initialColor =
    product.colors.find((color) => color.slug === askedColor)?.slug ??
    product.colors.find((color) => color.variants.some((variant) => variant.stock > 0))?.slug ??
    product.colors[0]?.slug ??
    "";

  const purchase: PurchaseProduct = {
    name: product.name,
    priceUzs: product.priceUzs,
    compareAtUzs: product.compareAtUzs,
    isDemo: product.isDemo,
    sizes: product.sizes,
    sizeChart: product.sizeChart,
    lines: product.worlds.map((slug) => ({ name: worlds[slug].name, href: shopHref({ lines: [slug] }) })),
    colors: product.colors.map((color) => ({
      id: color.id,
      slug: color.slug,
      name: color.name,
      hex: color.hex,
      images: galleryFor(color.media).map(toShopImage),
      generated: leadsWithGeneratedImage(color.media),
      variants: color.variants.map(({ id, size, stock }) => ({ id, size, stock })),
    })),
  };

  const related = await listRelatedProducts(product, 4);
  const details = [
    { label: copy.product.fabric, body: product.fabric },
    { label: copy.product.fit, body: product.fit },
    { label: copy.product.care, body: product.care },
    { label: copy.product.delivery, body: copy.product.deliveryBody },
  ];

  return (
    <div data-world-root={world} className="product-page">
      <div className="shell">
        <nav aria-label={copy.product.breadcrumb} className="breadcrumb">
          <ol>
            <li>
              <Link href="/shop">{copy.shop.title}</Link>
            </li>
            <li>
              <Link href={shopHref({ categories: [categorySlug(product.category)] })}>{product.category}</Link>
            </li>
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>

        <ProductPurchase key={product.id} product={purchase} initialColor={initialColor}>
          <div className="product-details">
            <p className="t-body product-description">{product.description}</p>
            <div className="product-accordion">
              {details.map((detail) => (
                <details key={detail.label} className="product-detail">
                  <summary>
                    {detail.label}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p className="t-small text-muted">{detail.body}</p>
                </details>
              ))}
            </div>
          </div>
        </ProductPurchase>

        {related.length ? (
          <section className="product-related" aria-labelledby="related-title">
            <div className="section-head">
              <h2 id="related-title" className="t-title">
                {copy.product.related}
              </h2>
              <Link href={shopHref({ lines: product.worlds.slice(0, 1) })} className="next-link">
                <span className="next-link-label">
                  {copy.worlds.shopAll} <span className="arrow" aria-hidden="true">→</span>
                </span>
              </Link>
            </div>
            <ul className="shop-grid related-grid">
              {related.map((item) => (
                <li key={item.id}>
                  <ProductCard product={item} sizes="(max-width: 640px) 46vw, 24vw" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
