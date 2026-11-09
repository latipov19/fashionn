import Link from "next/link";
import { Wordmark } from "@/components/ui/marks";
import { copy } from "@/content/copy";
import { getCart } from "@/server/cart";
import { MobileMenu } from "./mobile-menu";

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

export const navItems = [
  { href: "/worlds", label: copy.nav.worlds },
  { href: "/shop", label: copy.nav.shopFast },
] as const;

export async function SiteHeader() {
  const count = await cartCount();

  return (
    <>
      <p className="demo-band">{copy.demoNotice}</p>
      <header className="site-header">
        <div className="shell header-row">
          <Link href="/" aria-label={copy.nav.home}>
            <Wordmark />
          </Link>
          <nav aria-label={copy.nav.main} className="nav-links">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="nav-link">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link href="/shop" className="icon-link" aria-label={copy.nav.search}>
              <SearchIcon />
            </Link>
            <Link href="/cart" className="icon-link" aria-label={copy.nav.cartCount(count)}>
              <BagIcon />
              {count > 0 ? (
                <span className="cart-count" aria-hidden="true">
                  {count}
                </span>
              ) : null}
            </Link>
            <MobileMenu items={navItems} openLabel={copy.nav.openMenu} closeLabel={copy.nav.closeMenu} navLabel={copy.nav.main} />
          </div>
        </div>
      </header>
    </>
  );
}
