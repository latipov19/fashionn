import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { NextPageLink, WorldPage } from "@/components/world/world-page";
import { copy } from "@/content/copy";
import { worldOr, worlds } from "@/content/worlds";
import { listWorldProducts } from "@/server/catalog";
import { buildDrop } from "@/server/home-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.nav.pages.drop };

export default async function DropPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const world = worldOr((await searchParams).world);
  const shelf = await listWorldProducts(world);
  const { index, name } = worlds[world];

  return (
    <WorldPage world={world} className="page-drop">
      <section className="drop" aria-labelledby="drop-title">
        <div className="shell grid gap-8">
          <Reveal as="div" className="section-head">
            <div>
              <p className="kicker">{copy.home.drop.kicker}</p>
              <h1 id="drop-title" className="t-display">
                {copy.home.drop.title}
              </h1>
            </div>
            <div className="section-head-aside">
              <p className="drop-meta t-micro text-muted">
                <span className="tabular-nums">{index}</span> · {name}
              </p>
              <NextPageLink page="drop" world={world} />
            </div>
          </Reveal>
          {shelf.length ? (
            <Reveal key={world} className="drop-grid">
              {buildDrop(shelf)}
            </Reveal>
          ) : (
            <p className="t-lead text-muted">{copy.worlds.empty}</p>
          )}
        </div>
      </section>
    </WorldPage>
  );
}
