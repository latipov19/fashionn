import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { WorldPage } from "@/components/world/world-page";
import { copy } from "@/content/copy";
import { DEFAULT_WORLD } from "@/content/worlds";

export const metadata: Metadata = { title: copy.notFound.title };

/**
 * Every unknown address, and every link to a page that is not built yet (product, cart, shop),
 * lands here in the store's own voice, with a way back into the world pages.
 */
export default function NotFound() {
  return (
    <WorldPage world={DEFAULT_WORLD} className="page-not-found">
      <section className="shell grid gap-6 justify-items-start" aria-labelledby="not-found-title">
        <p className="kicker">404</p>
        <h1 id="not-found-title" className="t-display">
          {copy.notFound.title}
        </h1>
        <p className="t-lead text-muted measure">{copy.notFound.body}</p>
        <div className="hero-ctas">
          <ButtonLink href="/" variant="primary">
            {copy.notFound.link} <span className="arrow" aria-hidden="true">→</span>
          </ButtonLink>
          <ButtonLink href="/drop" variant="secondary">
            {copy.home.heroPrimary}
          </ButtonLink>
        </div>
      </section>
    </WorldPage>
  );
}
