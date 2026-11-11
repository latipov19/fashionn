import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/content/copy";
import type { PageKey } from "@/content/pages";
import { nextPage } from "@/content/pages";
import type { WorldSlug } from "@/content/types";
import { withWorld } from "@/content/worlds";

/**
 * One world page: retints the document into `world` and fills the first screen below the header,
 * content centred, so a page reads whole without scrolling on desktop. Phones scroll as usual.
 */
export function WorldPage({ world, className, children }: { world: WorldSlug; className?: string; children: ReactNode }) {
  return (
    <div data-world-root={world} className={className ? `page-screen ${className}` : "page-screen"}>
      {children}
    </div>
  );
}

/** "Next page" in reading order, in the same world. */
export function NextPageLink({ page, world }: { page: PageKey; world: WorldSlug }) {
  const next = nextPage(page);
  return (
    <Link href={withWorld(next.href, world)} className="next-link">
      <span className="t-micro text-muted">{copy.nav.next}</span>
      <span className="next-link-label">
        {next.label} <span className="arrow" aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
