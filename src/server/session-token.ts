import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/*
 * Session tokens shared by the admin and customer sessions. The cookie holds 32 random bytes;
 * the database holds only their SHA-256, so a leaked table cannot be replayed as a cookie.
 */

export const newSessionToken = () => randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** 32 bytes in base64url. Anything else is not worth a database lookup. */
export const sessionTokenFormat = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** HttpOnly, same-site and, in production, HTTPS only. Never readable by page scripts. */
export const sessionCookieOptions = (expires: Date) =>
  ({
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  }) as const;
