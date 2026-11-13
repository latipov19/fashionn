import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validation";
import { getDb } from "./db/client";
import { adminSessions, adminUsers } from "./db/schema";
import { burnPasswordCheck, verifyPassword } from "./password";
import { loginAccountLimiter, loginLimiter } from "./rate-limit";
import { hashSessionToken, newSessionToken, sessionCookieOptions, sessionTokenFormat } from "./session-token";

export const SESSION_COOKIE = "vv_admin";
export const LOGIN_PATH = "/admin/login";
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export type AdminSession = { sessionId: string; adminUserId: string; email: string; expiresAt: Date };

/** Thrown by requireAdmin. Actions turn it into a refused result. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Reads the session from the cookie. Expired and unknown tokens return null. */
export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const parsed = sessionTokenFormat.safeParse(store.get(SESSION_COOKIE)?.value);
  if (!parsed.success) return null;

  const db = await getDb();
  const [row] = await db
    .select({
      sessionId: adminSessions.id,
      adminUserId: adminSessions.adminUserId,
      email: adminUsers.email,
      expiresAt: adminSessions.expiresAt,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
    .where(eq(adminSessions.tokenHash, hashSessionToken(parsed.data)))
    .limit(1);

  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

/** Use this in actions and route handlers. Refuses with UnauthorizedError. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/** Use this in admin pages. Sends the visitor to sign in. */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);
  return session;
}

export type LoginResult = { ok: true } | { ok: false; code: "invalid" | "rate_limited" };

/** Checks the rate limits and password, then starts a session cookie. */
export async function login(input: { email: string; password: string }, ip: string): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const { email, password } = parsed.data;

  const key = `${ip}|${email}`;
  const perVisitor = loginLimiter.check(key);
  const perAccount = loginAccountLimiter.check(email);
  if (!perVisitor.allowed || !perAccount.allowed) return { ok: false, code: "rate_limited" };

  const db = await getDb();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (!user) {
    await burnPasswordCheck(password);
    return { ok: false, code: "invalid" };
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, code: "invalid" };

  loginLimiter.clear(key);
  loginAccountLimiter.clear(email);

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await db.insert(adminSessions).values({ adminUserId: user.id, tokenHash: hashSessionToken(token), expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return { ok: true };
}

/** Deletes the session row and the cookie. */
export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    const db = await getDb();
    await db.delete(adminSessions).where(eq(adminSessions.id, session.sessionId));
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
