import type { Metadata } from "next";
import { Showroom } from "@/components/world/showroom";
import { NextPageLink, WorldPage } from "@/components/world/world-page";
import { brand, copy } from "@/content/copy";
import { worldOr } from "@/content/worlds";
import { listWorldProducts } from "@/server/catalog";
import { buildShowroom } from "@/server/home-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.nav.pages.showroom };

export default async function ShowroomPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const world = worldOr((await searchParams).world);
  const items = buildShowroom(await listWorldProducts(world));

  return (
    <WorldPage world={world} className="page-showroom">
      {/* The showroom names itself with an h2; the page's own title is for assistive technology. */}
      <h1 className="sr-only">{copy.nav.pages.showroom}</h1>
      {items.length ? (
        <Showroom world={world} items={items} copy={{ ...copy.home.showroom, demoTag: copy.demoTag, wordmark: brand.name }} />
      ) : (
        <p className="shell t-lead text-muted">{copy.worlds.empty}</p>
      )}
      <div className="shell page-next">
        <NextPageLink page="showroom" world={world} />
      </div>
    </WorldPage>
  );
}
