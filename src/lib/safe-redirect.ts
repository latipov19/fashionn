import type { WorldSlug } from "@/content/types";
import { DEFAULT_WORLD, withWorld } from "@/content/worlds";

const BASE = "http://vybeverse.invalid";

/**
 * A `?next=` value that is safe to redirect to after sign-in, or null. Only a same-site path is
 * accepted: no scheme, no host, no protocol-relative `//`, no backslashes (browsers read `/\` as
 * `//`), no control characters, and never the sign-in page itself or the admin area.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  // `/.//evil.com` normalises to `//evil.com`, which a browser would read as another host.
  if (url.origin !== BASE || url.pathname.startsWith("//")) return null;
  if (url.pathname === "/login" || url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in link from a page: keeps the world, and brings the shopper back to that page after. */
export function loginPath(from: string, world: WorldSlug): string {
  const params = new URLSearchParams();
  if (world !== DEFAULT_WORLD) params.set("world", world);
  const next = safeNextPath(from);
  if (next && next !== "/") params.set("next", next);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

/**
 * Where a shopper lands after signing in: the checked `next` path, or the home page. The chosen
 * world comes along unless the path already names one.
 */
export function destinationAfterLogin(next: string | null, world: WorldSlug): string {
  if (!next) return withWorld("/", world);
  const url = new URL(next, BASE);
  if (world !== DEFAULT_WORLD && !url.searchParams.has("world")) url.searchParams.set("world", world);
  return `${url.pathname}${url.search}${url.hash}`;
}
