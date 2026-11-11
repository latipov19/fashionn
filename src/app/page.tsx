import { HomeWorlds } from "@/components/world/home-worlds";
import { copy } from "@/content/copy";
import type { WorldSlug } from "@/content/types";
import { WORLD_SLUGS } from "@/content/types";
import { worldOr } from "@/content/worlds";
import { listAllWorldProducts } from "@/server/catalog";
import { buildAperture } from "@/server/home-data";

export const dynamic = "force-dynamic";

const byWorld = <T,>(make: (slug: WorldSlug) => T) => Object.fromEntries(WORLD_SLUGS.map((slug) => [slug, make(slug)])) as Record<WorldSlug, T>;

/** The home page is the hero alone: the portal, the world switcher and the way into the pages. */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initial = worldOr((await searchParams).world);
  const shelves = await listAllWorldProducts();
  const home = copy.home;

  return (
    // Keyed by the world in the URL, so a link to another world (footer, menu) opens it even
    // when the home page is already showing. The in-page switcher never changes this key.
    <HomeWorlds
      key={initial}
      initial={initial}
      copy={{
        primary: { href: "/drop", label: home.heroPrimary },
        secondary: { href: "/showroom", label: home.heroSecondary },
        switcherLabel: home.switcherLabel,
        openProduct: home.openProduct,
        scrollCue: home.scrollCue,
        demoTag: copy.demoTag,
      }}
      apertures={byWorld((slug) => buildAperture(shelves[slug], slug))}
    />
  );
}
