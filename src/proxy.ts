import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * A fast redirect for visitors with no session cookie. This is a convenience, not the
 * security boundary: every admin page and action checks the session itself on the server.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("lierne_admin")) return NextResponse.next();
  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin", "/admin/((?!login(?:/|$)).*)"],
};
