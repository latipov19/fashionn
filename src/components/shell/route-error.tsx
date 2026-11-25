"use client";

import Link from "next/link";
import { copy } from "@/content/copy";

/** A store page that could not load says so in the store's voice and offers a retry. No server detail reaches the page. */
export function RouteError({ reset }: { reset: () => void }) {
  const text = copy.errorPage;
  return (
    <section className="shell route-error" aria-labelledby="route-error-title">
      <p className="kicker">500</p>
      <h1 id="route-error-title" className="t-display">
        {text.title}
      </h1>
      <p className="t-lead text-muted measure">{text.body}</p>
      <div className="hero-ctas">
        <button type="button" className="btn btn-primary" onClick={reset}>
          {text.retry}
        </button>
        <Link href="/" className="btn btn-secondary">
          {text.home}
        </Link>
      </div>
    </section>
  );
}
