import type { Metadata } from "next";
import { LookBoard } from "@/components/world/look-board";
import { NextPageLink, WorldPage } from "@/components/world/world-page";
import { copy } from "@/content/copy";
import { worldOr, worlds } from "@/content/worlds";
import { listWorldProducts } from "@/server/catalog";
import { buildLook } from "@/server/home-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.nav.pages.look };

export default async function LookPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const world = worldOr((await searchParams).world);
  const look = buildLook(await listWorldProducts(world));
  const { kicker, title, body, total, summary } = copy.home.look;

  return (
    <WorldPage world={world} className="page-look">
      {look ? (
        <LookBoard
          world={world}
          worldName={worlds[world].name}
          look={look}
          heading="h1"
          copy={{ kicker, title, body, total, summary }}
          aside={<NextPageLink page="look" world={world} />}
        />
      ) : (
        <div className="shell grid gap-5">
          <h1 className="t-display">{title}</h1>
          <p className="t-lead text-muted">{copy.worlds.empty}</p>
          <NextPageLink page="look" world={world} />
        </div>
      )}
    </WorldPage>
  );
}
