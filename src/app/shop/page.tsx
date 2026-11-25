import type { Metadata } from "next";
import { ShopBrowser } from "@/components/shop/shop-browser";
import { copy } from "@/content/copy";
import { worldOr } from "@/content/worlds";
import { listShopItems } from "@/server/shop";
import "../store.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.shop.metaTitle, description: copy.shop.lead };

/**
 * Every published product with search, filters and sort. The browser filters the list it was
 * given, so changes are instant; the server already rendered the view the URL asks for.
 */
export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const world = worldOr((await searchParams).world);
  const items = await listShopItems();

  return (
    <div data-world-root={world} className="shop-page">
      <div className="shell">
        <header className="shop-head">
          <p className="kicker">{copy.shop.kicker}</p>
          <div className="shop-head-row">
            <h1 className="t-display">{copy.shop.title}</h1>
            <p className="t-lead text-muted shop-lead">{copy.shop.lead}</p>
          </div>
        </header>
        <ShopBrowser items={items} />
      </div>
    </div>
  );
}
