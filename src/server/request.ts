import { headers } from "next/headers";

/**
 * Best-effort client address for rate limiting. Trust this only behind a proxy that sets
 * x-forwarded-for itself. The account-wide login limit does not depend on it.
 */
export async function getClientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || "local";
}
