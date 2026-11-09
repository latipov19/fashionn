import Link from "next/link";
import { brand, copy } from "@/content/copy";
import { worldList } from "@/content/worlds";
import { LiteToggle } from "./lite-toggle";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell section grid gap-12">
        <div className="grid-12 gap-y-10">
          <div className="col-span-12 md:col-span-6 grid content-start gap-4">
            <p className="footer-wordmark" aria-hidden="true">
              {brand.name}
            </p>
            <p className="t-lead">{copy.footer.tagline}</p>
          </div>
          <nav aria-labelledby="footer-shop" className="col-span-6 md:col-span-3 grid content-start gap-2">
            <h2 id="footer-shop" className="t-micro text-muted">
              {copy.footer.shop}
            </h2>
            <ul className="footer-links">
              <li>
                <Link href="/shop">{copy.nav.shopFast}</Link>
              </li>
              <li>
                <Link href="/worlds">{copy.footer.allWorlds}</Link>
              </li>
              <li>
                <Link href="/cart">{copy.nav.cart}</Link>
              </li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-worlds" className="col-span-6 md:col-span-3 grid content-start gap-2">
            <h2 id="footer-worlds" className="t-micro text-muted">
              {copy.nav.worlds}
            </h2>
            <ul className="footer-links">
              {worldList.map((world) => (
                <li key={world.slug}>
                  <Link href={`/?world=${world.slug}`}>
                    <span className="text-muted tabular-nums mr-2">{world.index}</span>
                    {world.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-6 border-t border-line pt-6">
          <LiteToggle label={copy.footer.lightMode} hint={copy.footer.lightModeHint} on={copy.footer.lightModeOn} off={copy.footer.lightModeOff} />
          <p className="t-small text-muted max-w-[46ch]">
            © {new Date().getFullYear()} {brand.name}. {copy.footer.legal}
          </p>
        </div>
      </div>
    </footer>
  );
}
