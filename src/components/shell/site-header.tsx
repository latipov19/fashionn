import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/ui/marks";
import { copy } from "@/content/copy";
import { pages } from "@/content/pages";
import { worldList } from "@/content/worlds";
import { getCart } from "@/server/cart";
import { MobileMenu } from "./mobile-menu";
import { NavLinks, NavLinksFallback } from "./nav-links";

async function cartCount(): Promise<number> {
  try {
    return (await getCart()).count;
  } catch (error) {
    // The header must render even when the database is unavailable.
    console.error("cart count failed", error);
    return 0;
  }
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4.5 8h15l-1.2 12.5H5.7L4.5 8Z" />
      <path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

const navItems = pages.map(({ href, label }) => ({ href, label }));
const worldItems = worldList.map((world) => ({ slug: world.slug, label: world.name, index: world.index, swatch: world.theme.bg }));
const menuLabels = { open: copy.nav.openMenu, close: copy.nav.closeMenu, nav: copy.nav.main, worlds: copy.nav.worlds };

export async function SiteHeader() {
  const count = await cartCount();

  return (
    <>
      <p className="demo-band">
        <span className="demo-tag" aria-hidden="true">
          {copy.demoTag}
        </span>
        <span>{copy.demoNotice}</span>
      </p>
      <header className="site-header">
        <div className="shell">
          <div className="nav-capsule">
            <Link href="/" aria-label={copy.nav.home} className="brand-link">
              <Wordmark />
            </Link>
            {/* The links read the world from the URL; until then they render without it. */}
            <Suspense fallback={<NavLinksFallback items={navItems} label={copy.nav.main} />}>
              <NavLinks items={navItems} label={copy.nav.main} />
            </Suspense>
            <div className="header-actions">
              <Link href="/shop" className="icon-link search-link">
                <SearchIcon />
                <span className="search-label">{copy.nav.search}</span>
              </Link>
              <Link href="/cart" className="icon-link cart-link" aria-label={copy.nav.cartCount(count)}>
                <BagIcon />
                {count > 0 ? (
                  <span className="cart-count" aria-hidden="true">
                    {count}
                  </span>
                ) : null}
              </Link>
              <Suspense fallback={null}>
                <MobileMenu items={navItems} worlds={worldItems} labels={menuLabels} />
              </Suspense>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
