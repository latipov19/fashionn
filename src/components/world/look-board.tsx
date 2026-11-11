"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Reveal } from "@/components/motion/reveal";

export type LookPiece = {
  key: string;
  name: string;
  category: string;
  /** Formatted current price. */
  price: string;
  card: ReactNode;
};

export type Look = {
  pieces: LookPiece[];
  /** Formatted sum of the pieces' current prices, computed on the server. */
  total: string;
  /** One line under the total, for example the piece count. */
  note: string;
};

export type LookCopy = { kicker: string; title: string; body: string; total: string; summary: string };

const pad = (value: number) => String(value).padStart(2, "0");

type Props = {
  world: string;
  worldName: string;
  look: Look;
  copy: LookCopy;
  /** h1 when the look is the page itself, h2 inside a longer page. */
  heading?: "h1" | "h2";
  /** Extra content under the intro, such as the next page link. */
  aside?: ReactNode;
};

/**
 * Build Your Look: the pieces on one side and a receipt that stays in view on the other. Pointing
 * at, or focusing, a piece or its line lights both and dims the rest. Purely presentational: every
 * link is the product card's own link, and the total comes from the catalogue.
 */
export function LookBoard({ world, worldName, look, copy, heading: Heading = "h2", aside }: Props) {
  const [focus, setFocus] = useState<number | null>(null);
  const clear = () => setFocus(null);

  return (
    <section className="section look" aria-labelledby="look-title">
      <div className="shell look-layout">
        <Reveal as="div" className="look-head">
          <div>
            <p className="kicker">{copy.kicker}</p>
            <Heading id="look-title" className="t-display">
              {copy.title}
            </Heading>
          </div>
          <div className="look-intro">
            <p className="t-lead text-muted">{copy.body}</p>
            {aside}
          </div>
        </Reveal>

        <Reveal key={`look-${world}`} className="look-grid" data-focus={focus === null ? undefined : String(focus)}>
          {look.pieces.map((piece, index) => (
            <li
              key={piece.key}
              data-active={focus === index}
              onPointerEnter={() => setFocus(index)}
              onPointerLeave={clear}
              onFocus={() => setFocus(index)}
              onBlur={clear}
            >
              {piece.card}
            </li>
          ))}
        </Reveal>

        <aside className="look-summary glass-2" aria-labelledby="look-summary-title">
          <div className="look-summary-head">
            <h3 id="look-summary-title" className="t-micro">
              {copy.summary}
            </h3>
            <span className="t-micro text-muted">{worldName}</span>
          </div>
          <ol className="look-lines">
            {look.pieces.map((piece, index) => (
              <li key={piece.key} data-active={focus === index} onPointerEnter={() => setFocus(index)} onPointerLeave={clear}>
                <span className="look-line-idx" aria-hidden="true">
                  {pad(index + 1)}
                </span>
                <span className="look-line-cat">{piece.category}</span>
                <span className="look-line-name">{piece.name}</span>
                <span className="look-line-price">{piece.price}</span>
              </li>
            ))}
          </ol>
          <div className="look-total">
            <span className="t-micro text-muted">{copy.total}</span>
            <span className="t-title t-price">{look.total}</span>
          </div>
          <p className="t-small text-muted">{look.note}</p>
        </aside>
      </div>
    </section>
  );
}
