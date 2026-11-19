import type { Metadata } from "next";
import { TryOnStudio } from "@/components/try-on/try-on-studio";
import { WorldPage } from "@/components/world/world-page";
import { copy } from "@/content/copy";
import { withWorld, worldOr } from "@/content/worlds";
import { listTryOnProducts } from "@/server/try-on/catalog";
import { tryOnAvailability } from "@/server/try-on/provider";
import "./try-on.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.tryOn.metaTitle };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Virtual try-on. Opens in the world named in the URL, and on `?product=<handle>&color=<slug>`
 * when a link brings the visitor here with a product in mind. Products come from the live
 * catalogue; nothing here is a copy of it.
 */
export default async function TryOnPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const world = worldOr(first(params.world));
  const products = await listTryOnProducts();
  const text = copy.tryOn;

  return (
    <WorldPage world={world} className="page-tryon">
      <div className="shell tryon-page">
        <header className="tryon-head">
          <p className="kicker">{text.kicker}</p>
          <h1 className="t-display tryon-title">
            <span className="t-slant">{text.title}</span>
          </h1>
          <p className="t-lead text-muted measure">{text.lead}</p>
        </header>
        <TryOnStudio products={products} initial={{ handle: first(params.product), color: first(params.color) }} ai={tryOnAvailability()} exitHref={withWorld("/showroom", world)} />
      </div>
    </WorldPage>
  );
}
