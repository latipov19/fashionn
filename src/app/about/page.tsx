import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { RevealWords } from "@/components/motion/reveal-words";
import { NextPageLink, WorldPage } from "@/components/world/world-page";
import { brand, copy } from "@/content/copy";
import { worldOr } from "@/content/worlds";
import { listAllWorldProducts } from "@/server/catalog";
import { catalogFacts } from "@/server/home-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: copy.nav.pages.about };

const pad = (value: number) => String(value).padStart(2, "0");

const trustIcons = [
  // Pay on delivery: a banknote.
  <svg key="pay" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 9.5v5M18 9.5v5" />
  </svg>,
  // Across Uzbekistan: a route between two points.
  <svg key="route" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="6" cy="18" r="2.2" />
    <path d="M18 11.5c-2.2-2.4-3.4-4.1-3.4-5.6a3.4 3.4 0 0 1 6.8 0c0 1.5-1.2 3.2-3.4 5.6Z" />
    <circle cx="18" cy="5.9" r=".8" />
    <path d="M8.2 18H14a3 3 0 0 0 0-6h-3.5a3 3 0 0 1 0-6h1" />
  </svg>,
  // Open price and stock: a tag.
  <svg key="tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.7 6.7a1.4 1.4 0 0 1-2 0l-8.3-8.3Z" />
    <circle cx="8" cy="8" r="1.4" />
  </svg>,
];

/** The manifesto and how buying works, on one screen. */
export default async function AboutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const world = worldOr((await searchParams).world);
  const facts = catalogFacts(await listAllWorldProducts());
  const { story, trustHead, trust } = copy.home;

  return (
    <WorldPage world={world} className="page-about story grain">
      <p className="story-word" aria-hidden="true">
        {brand.name}
      </p>
      <div className="shell about-grid">
        <div className="about-intro">
          <p className="kicker">{story.kicker}</p>
          <RevealWords as="h1" id="about-title" className="t-display about-title" text={story.title} />
        </div>
        <div className="about-aside">
          <p className="t-lead text-muted">{story.body}</p>
          <dl className="story-facts" aria-label={story.factsLabel}>
            <div>
              <dt>{story.facts.worlds}</dt>
              <dd>{pad(facts.worlds)}</dd>
            </div>
            <div>
              <dt>{story.facts.products}</dt>
              <dd>{pad(facts.products)}</dd>
            </div>
            <div>
              <dt>{story.facts.models}</dt>
              <dd>{pad(facts.models)}</dd>
            </div>
          </dl>
        </div>
        <section className="about-trust" aria-labelledby="trust-title">
          <div className="about-trust-head">
            <div className="grid gap-2">
              <p className="kicker">{trustHead.kicker}</p>
              <h2 id="trust-title" className="t-title">
                {trustHead.title}
              </h2>
            </div>
            <NextPageLink page="about" world={world} />
          </div>
          <Reveal className="trust-list">
            {trust.map((item, index) => (
              <li key={item.title} className="trust-card">
                <span className="trust-icon">{trustIcons[index]}</span>
                <span className="idx t-micro text-muted tabular-nums" aria-hidden="true">
                  {pad(index + 1)}
                </span>
                <h3 className="trust-title">{item.title}</h3>
                <p className="text-muted">{item.body}</p>
              </li>
            ))}
          </Reveal>
        </section>
      </div>
    </WorldPage>
  );
}
