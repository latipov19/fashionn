import { ProductCard, leadImage } from "@/components/product/product-card";
import type { Aperture } from "@/components/world/portal";
import { HomeWorlds } from "@/components/world/home-worlds";
import { copy } from "@/content/copy";
import type { Slot, WorldSlug } from "@/content/types";
import { WORLD_SLUGS } from "@/content/types";
import { isWorldSlug, worldList, worlds } from "@/content/worlds";
import { formatUzs } from "@/lib/money";
import type { CatalogProduct } from "@/server/catalog";
import { listAllWorldProducts } from "@/server/catalog";

export const dynamic = "force-dynamic";

/** The look is dressed in this order, one product per slot. */
const LOOK_ORDER: Slot[] = ["outerwear", "top", "bottom", "shoes", "accessory"];

const byWorld = <T,>(make: (slug: WorldSlug) => T) => Object.fromEntries(WORLD_SLUGS.map((slug) => [slug, make(slug)])) as Record<WorldSlug, T>;

/** The portal holds the world's lead outer layer, so the opening always shows a full garment. */
function heroProduct(shelf: CatalogProduct[]): CatalogProduct | undefined {
  return shelf.find((product) => product.slot === "outerwear" && !product.soldOut) ?? shelf.find((product) => !product.soldOut) ?? shelf[0];
}

function toAperture(product: CatalogProduct | undefined, slug: WorldSlug): Aperture | null {
  if (!product) return null;
  const image = leadImage(product);
  return {
    href: `/products/${product.handle}`,
    label: `${copy.home.apertureLabel(worlds[slug].name)}: ${product.name}`,
    name: product.name,
    price: formatUzs(product.priceUzs),
    demo: product.isDemo,
    image: image
      ? {
          src: image.url,
          srcSet: image.srcSet.map((source) => `${source.url} ${source.width}w`).join(", "),
          width: image.width,
          height: image.height,
          alt: image.alt,
          blur: image.blur,
        }
      : null,
  };
}

function buildLook(shelf: CatalogProduct[]) {
  const items = LOOK_ORDER.flatMap((slot) => {
    const product = shelf.find((candidate) => candidate.slot === slot);
    return product ? [product] : [];
  });
  if (items.length < 2) return null;
  return {
    items: items.map((product) => (
      <li key={product.id}>
        <ProductCard product={product} compact sizes="(max-width: 900px) 50vw, 18vw" />
      </li>
    )),
    total: formatUzs(items.reduce((sum, product) => sum + product.priceUzs, 0)),
  };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { world } = await searchParams;
  const initial: WorldSlug = isWorldSlug(world) ? world : "dark-mode";
  const shelves = await listAllWorldProducts();
  const home = copy.home;

  return (
    <>
      <HomeWorlds
        initial={initial}
        copy={{
          explore: home.explore,
          shopFast: home.shopFast,
          switcherLabel: home.switcherLabel,
          openProduct: home.openProduct,
          demoTag: copy.demoTag,
          drop: { kicker: home.drop.kicker, title: home.drop.title, all: worldList.map((item) => home.drop.all(item.name)) },
          look: home.look,
        }}
        apertures={byWorld((slug) => toAperture(heroProduct(shelves[slug]), slug))}
        drops={byWorld((slug) =>
          shelves[slug].slice(0, 4).map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          )),
        )}
        looks={byWorld((slug) => buildLook(shelves[slug]))}
      />

      <section className="section bg-bg-sunken" aria-labelledby="story-title">
        <div className="shell grid-12 gap-y-8">
          <div className="col-span-12 md:col-span-7 grid gap-5">
            <p className="kicker">{home.story.kicker}</p>
            <h2 id="story-title" className="t-display">
              {home.story.title}
            </h2>
          </div>
          <p className="col-span-12 md:col-span-4 md:col-start-9 self-end t-lead text-muted">{home.story.body}</p>
        </div>
      </section>

      <section className="section" aria-label={home.trust.map((item) => item.title).join(", ")}>
        <ul className="shell grid gap-8 md:grid-cols-3">
          {home.trust.map((item, index) => (
            <li key={item.title} className="trust-item grid gap-3">
              <span className="t-micro text-muted tabular-nums">0{index + 1}</span>
              <h3 className="t-title">{item.title}</h3>
              <p className="text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
