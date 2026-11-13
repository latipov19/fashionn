"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginPath } from "@/lib/safe-redirect";
import { useCurrentWorld } from "./nav-links";

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.75 20c.9-3.6 3.75-5.5 7.25-5.5s6.35 1.9 7.25 5.5" />
    </svg>
  );
}

/** The header's way in to sign in. It keeps the world and returns the shopper to this page. */
export function AccountLink({ label }: { label: string }) {
  const pathname = usePathname();
  const world = useCurrentWorld();

  return (
    <Link
      href={loginPath(pathname, world)}
      className="icon-link account-link"
      aria-label={label}
      title={label}
      aria-current={pathname === "/login" ? "page" : undefined}
    >
      <UserIcon />
    </Link>
  );
}

/** The same link before the address bar is known. */
export function AccountLinkFallback({ label }: { label: string }) {
  return (
    <Link href="/login" className="icon-link account-link" aria-label={label} title={label}>
      <UserIcon />
    </Link>
  );
}
