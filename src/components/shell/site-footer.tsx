import Link from "next/link";
import type { CSSProperties } from "react";
import { SunrayMark } from "@/components/ui/marks";
import { brand, copy } from "@/content/copy";
import { pages } from "@/content/pages";
import { worldList } from "@/content/worlds";
import { LiteToggle } from "./lite-toggle";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-top">
          <div className="footer-intro">
            <SunrayMark />
            <p className="t-title">{brand.positioning}</p>
          </div>
          <nav aria-labelledby="footer-pages" className="grid content-start gap-2">
            <h2 id="footer-pages" className="t-micro text-muted">
              {copy.footer.pages}
            </h2>
            <ul className="footer-links">
              {pages.map((page) => (
                <li key={page.key}>
                  <Link href={page.href}>{page.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/cart">{copy.nav.cart}</Link>
              </li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-worlds" className="grid content-start gap-2">
            <h2 id="footer-worlds" className="t-micro text-muted">
              {copy.nav.worlds}
            </h2>
            <ul className="footer-links">
              {worldList.map((world) => (
                <li key={world.slug}>
                  <Link href={`/?world=${world.slug}`}>
                    <span className="menu-swatch" style={{ "--swatch": world.theme.bg } as CSSProperties} aria-hidden="true" />
                    <span className="tabular-nums">{world.index}</span>
                    {world.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="footer-bottom">
          <LiteToggle label={copy.footer.lightMode} hint={copy.footer.lightModeHint} on={copy.footer.lightModeOn} off={copy.footer.lightModeOff} />
          <p className="t-small text-muted max-w-[46ch]">
            © {new Date().getFullYear()} {brand.name}. {copy.footer.legal}
          </p>
        </div>
        <p className="footer-wordmark" aria-hidden="true">
          {brand.name}
        </p>
      </div>
    </footer>
  );
}
