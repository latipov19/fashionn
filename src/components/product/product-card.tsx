import { worlds } from "@/content/worlds";
import type { CatalogProduct } from "@/server/catalog";
import { primaryMedia } from "@/server/media";
import { toShopImage } from "@/server/shop";
import { ProductTile } from "./product-tile";

export { Price } from "./product-tile";

/** The lead image of the first colour that has one. */
export function leadImage(product: CatalogProduct) {
  for (const color of product.colors) {
    const media = primaryMedia(color.media);
    if (media) return media;
  }
  return null;
}

/** A catalogue product as a card, for server-rendered shelves. The shop grid draws the same tile from its own records. */
export function ProductCard({ product, sizes, compact = false }: { product: CatalogProduct; sizes?: string; compact?: boolean }) {
  const image = leadImage(product);
  return (
    <ProductTile
      href={`/products/${product.handle}`}
      name={product.name}
      image={image ? toShopImage(image) : null}
      meta={compact ? null : [product.category, ...product.worlds.map((world) => worlds[world].name)].join(" · ")}
      colors={compact ? null : product.colors}
      priceUzs={product.priceUzs}
      compareAtUzs={product.compareAtUzs}
      isDemo={product.isDemo}
      soldOut={product.soldOut}
      sizes={sizes}
    />
  );
}
