import { brand, copy } from "@/content/copy";
import { worlds } from "@/content/worlds";
import { formatUzs } from "@/lib/money";
import { listProducts } from "@/server/catalog";

export const dynamic = "force-dynamic";

/** Stands in until the real home is built. Reading the catalog boots the database. */
export default async function HomePage() {
  const products = await listProducts();

  return (
    <section className="section shell" data-ground="bone">
      <p className="t-small measure">{copy.demoNotice}</p>
      <h1 className="t-display-xl mt-8">{brand.name}</h1>
      <p className="t-lead measure mt-4">{brand.positioning}</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            {/* No product imagery exists yet, so the first colour stands in for it. */}
            <div
              aria-hidden="true"
              className="border border-line"
              style={{ aspectRatio: "4 / 5", backgroundColor: product.colors[0]?.hex }}
            />
            {product.isDemo ? <p className="t-label mt-2">{copy.demoTag}</p> : null}
            <h2 className="t-body mt-1">{product.name}</h2>
            <p className="t-small text-fg-2">
              {[product.category, ...product.worlds.map((world) => worlds[world].name)].join(" · ")}
            </p>
            <p className="t-price mt-1">
              {formatUzs(product.priceUzs)}
              {product.compareAtUzs ? <s className="t-small text-fg-2 ml-2">{formatUzs(product.compareAtUzs)}</s> : null}
            </p>
            <p className="t-small text-fg-2">{product.colors.map((color) => color.name).join(", ")}</p>
            {product.soldOut ? <p className="t-small">{copy.micro.soldOut}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
