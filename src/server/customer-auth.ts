import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validation";
import { getDb } from "./db/client";
import { customerSessions, customers } from "./db/schema";
import { burnPasswordCheck, verifyPassword } from "./password";
import { customerLoginAccountLimiter, customerLoginLimiter } from "./rate-limit";
import { hashSessionToken, newSessionToken, sessionCookieOptions, sessionTokenFormat } from "./session-token";

/*
 * Shopper accounts. Deliberately separate from src/server/auth.ts: another table, another cookie
 * and other rate limits. Nothing here can read or grant an admin session, and nothing in the
 * admin module accepts this cookie.
 */

export const CUSTOMER_COOKIE = "vv_customer";
export const CUSTOMER_LOGIN_PATH = "/login";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export type CustomerSession = { sessionId: string; customerId: string; email: string; expiresAt: Date };

/** Reads the shopper session from the cookie. Expired, unknown and malformed tokens return null. */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const store = await cookies();
  const parsed = sessionTokenFormat.safeParse(store.get(CUSTOMER_COOKIE)?.value);
  if (!parsed.success) return null;

  const db = await getDb();
  const [row] = await db
    .select({
      sessionId: customerSessions.id,
      customerId: customerSessions.customerId,
      email: customers.email,
      expiresAt: customerSessions.expiresAt,
    })
    .from(customerSessions)
    .innerJoin(customers, eq(customers.id, customerSessions.customerId))
    .where(eq(customerSessions.tokenHash, hashSessionToken(parsed.data)))
    .limit(1);

  if (!row || row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

/** For shopper-only pages: sends a visitor without a session to sign in, then back to `returnTo`. */
export async function requireCustomerPage(returnTo: string): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) redirect(`${CUSTOMER_LOGIN_PATH}?next=${encodeURIComponent(returnTo)}`);
  return session;
}

export type CustomerLoginResult = { ok: true } | { ok: false; code: "invalid" | "rate_limited" };

/**
 * Checks the rate limits and the password, then starts a session cookie. An unknown email and a
 * wrong password take the same time and give the same answer, so neither reveals an account.
 */
export async function loginCustomer(input: { email: string; password: string }, ip: string): Promise<CustomerLoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "invalid" };
  const { email, password } = parsed.data;

  const key = `${ip}|${email}`;
  const perVisitor = customerLoginLimiter.check(key);
  const perAccount = customerLoginAccountLimiter.check(email);
  if (!perVisitor.allowed || !perAccount.allowed) return { ok: false, code: "rate_limited" };

  const db = await getDb();
  const [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  if (!customer) {
    await burnPasswordCheck(password);
    return { ok: false, code: "invalid" };
  }
  if (!(await verifyPassword(password, customer.passwordHash))) return { ok: false, code: "invalid" };

  customerLoginLimiter.clear(key);
  customerLoginAccountLimiter.clear(email);

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await db.delete(customerSessions).where(lt(customerSessions.expiresAt, new Date()));
  await db.insert(customerSessions).values({ customerId: customer.id, tokenHash: hashSessionToken(token), expiresAt });

  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, sessionCookieOptions(expiresAt));
  return { ok: true };
}

/** Deletes the session row and the cookie. */
export async function logoutCustomer(): Promise<void> {
  const session = await getCustomerSession();
  if (session) {
    const db = await getDb();
    await db.delete(customerSessions).where(eq(customerSessions.id, session.sessionId));
  }
  const store = await cookies();
  store.delete(CUSTOMER_COOKIE);
}
