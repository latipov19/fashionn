import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy";
import { initialCustomerLoginState } from "@/lib/customer-login-state";
import { destinationAfterLogin, loginPath, safeNextPath } from "@/lib/safe-redirect";
import { customerLoginAction } from "@/server/actions/customer-auth";
import { SESSION_COOKIE, UnauthorizedError, getSession, login, requireAdmin } from "@/server/auth";
import { CUSTOMER_COOKIE, getCustomerSession, loginCustomer, logoutCustomer, requireCustomerPage } from "@/server/customer-auth";
import { closeDb, getDb } from "@/server/db/client";
import { customerSessions, customers } from "@/server/db/schema";
import { ensureDemoCustomer } from "@/server/db/seed";
import { hashPassword } from "@/server/password";
import { customerLoginAccountLimiter, resetRateLimits } from "@/server/rate-limit";
import { jar, setIp } from "./helpers";

const EMAIL = "shopper@example.com";
const PASSWORD = "unit-test-shopper-password";
const text = copy.account.login;

beforeAll(async () => {
  const db = await getDb();
  await db.insert(customers).values({ email: EMAIL, passwordHash: await hashPassword(PASSWORD) });
});
afterAll(closeDb);
beforeEach(resetRateLimits);
afterEach(() => vi.unstubAllEnvs());

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const signIn = () => loginCustomer({ email: EMAIL, password: PASSWORD }, "1.1.1.1");

describe("safe redirects", () => {
  it("accepts same-site paths and keeps their query and hash", () => {
    expect(safeNextPath("/drop")).toBe("/drop");
    expect(safeNextPath("/look?world=raw-energy#pieces")).toBe("/look?world=raw-energy#pieces");
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    "//evil.com",
    "///evil.com",
    "/.//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "http:evil.com",
    "javascript:alert(1)",
    "evil.com/drop",
    " /drop",
    "/drop\r\nSet-Cookie: x=1",
    "/login",
    "/login?next=/drop",
    "/admin",
    "/admin/orders",
    `/${"a".repeat(600)}`,
    "",
  ])("refuses %j", (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it("refuses anything that is not a string", () => {
    for (const value of [undefined, null, 42, ["/drop"], { href: "/drop" }]) expect(safeNextPath(value)).toBeNull();
  });

  it("builds the header's sign-in link: world kept, back to the page it came from", () => {
    expect(loginPath("/", "dark-mode")).toBe("/login");
    expect(loginPath("/", "raw-energy")).toBe("/login?world=raw-energy");
    expect(loginPath("/drop", "soft-signal")).toBe("/login?world=soft-signal&next=%2Fdrop");
    expect(loginPath("/login", "dark-mode")).toBe("/login");
  });

  it("lands home or on the checked path, in the chosen world", () => {
    expect(destinationAfterLogin(null, "dark-mode")).toBe("/");
    expect(destinationAfterLogin(null, "soft-signal")).toBe("/?world=soft-signal");
    expect(destinationAfterLogin("/drop", "raw-energy")).toBe("/drop?world=raw-energy");
    expect(destinationAfterLogin("/drop#top", "dark-mode")).toBe("/drop#top");
    expect(destinationAfterLogin("/look?world=soft-signal", "raw-energy")).toBe("/look?world=soft-signal");
  });
});

describe("customer sessions", () => {
  it("signs in with any letter case and sets an HttpOnly, same-site cookie", async () => {
    expect(await loginCustomer({ email: "  Shopper@Example.COM ", password: PASSWORD }, "1.1.1.1")).toEqual({ ok: true });
    const cookie = jar().get(CUSTOMER_COOKIE);
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect((await getCustomerSession())?.email).toBe(EMAIL);

    // Only the hash of the token is stored.
    const db = await getDb();
    const rows = await db.select({ tokenHash: customerSessions.tokenHash }).from(customerSessions);
    expect(rows.some((row) => row.tokenHash === cookie?.value)).toBe(false);
    expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.tokenHash))).toBe(true);
  });

  it("answers a wrong password and an unknown email the same way, and sets nothing", async () => {
    expect(await loginCustomer({ email: EMAIL, password: "wrong" }, "1.1.1.1")).toEqual({ ok: false, code: "invalid" });
    expect(await loginCustomer({ email: "nobody@example.com", password: PASSWORD }, "1.1.1.1")).toEqual({ ok: false, code: "invalid" });
    expect(await loginCustomer({ email: "not-an-email", password: PASSWORD }, "1.1.1.1")).toEqual({ ok: false, code: "invalid" });
    expect(jar().has(CUSTOMER_COOKIE)).toBe(false);
  });

  it("never opens the admin area, and an admin cookie never opens a shopper session", async () => {
    await signIn();
    expect(await getSession()).toBeNull();
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    jar().set(SESSION_COOKIE, { value: jar().get(CUSTOMER_COOKIE)!.value });
    expect(await getSession()).toBeNull();

    jar().clear();
    expect(await login({ email: process.env.ADMIN_EMAIL!, password: process.env.ADMIN_PASSWORD! }, "1.1.1.1")).toEqual({ ok: true });
    expect(await getCustomerSession()).toBeNull();
    jar().set(CUSTOMER_COOKIE, { value: jar().get(SESSION_COOKIE)!.value });
    expect(await getCustomerSession()).toBeNull();
  });

  it("ignores expired, unknown and malformed tokens", async () => {
    await signIn();
    const db = await getDb();
    await db.update(customerSessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await getCustomerSession()).toBeNull();
    jar().set(CUSTOMER_COOKIE, { value: "A".repeat(43) });
    expect(await getCustomerSession()).toBeNull();
    jar().set(CUSTOMER_COOKIE, { value: "' or 1=1 --" });
    expect(await getCustomerSession()).toBeNull();
  });

  it("signs out by deleting the session and the cookie", async () => {
    await signIn();
    const token = jar().get(CUSTOMER_COOKIE)!.value;
    await logoutCustomer();
    expect(jar().has(CUSTOMER_COOKIE)).toBe(false);
    jar().set(CUSTOMER_COOKIE, { value: token });
    expect(await getCustomerSession()).toBeNull();
  });

  it("sends a visitor without a session to sign in, and back afterwards", async () => {
    await expect(requireCustomerPage("/look?world=raw-energy")).rejects.toMatchObject({ url: "/login?next=%2Flook%3Fworld%3Draw-energy" });
    await signIn();
    expect((await requireCustomerPage("/look"))?.email).toBe(EMAIL);
  });
});

describe("rate limits", () => {
  it("locks after five attempts, even with the right password", async () => {
    for (let i = 0; i < 5; i += 1) await loginCustomer({ email: EMAIL, password: "wrong" }, "2.2.2.2");
    expect(await loginCustomer({ email: EMAIL, password: PASSWORD }, "2.2.2.2")).toEqual({ ok: false, code: "rate_limited" });
    expect(jar().has(CUSTOMER_COOKIE)).toBe(false);
    // Another visitor is not locked out.
    expect(await loginCustomer({ email: EMAIL, password: PASSWORD }, "3.3.3.3")).toEqual({ ok: true });
  });

  it("caps guesses per account across addresses", async () => {
    for (let i = 0; i < 20; i += 1) customerLoginAccountLimiter.check(EMAIL);
    expect(await loginCustomer({ email: EMAIL, password: PASSWORD }, "9.9.9.9")).toEqual({ ok: false, code: "rate_limited" });
  });

  it("counts shopper attempts apart, so they never lock the admin out", async () => {
    const admin = process.env.ADMIN_EMAIL!;
    for (let i = 0; i < 25; i += 1) await loginCustomer({ email: admin, password: "wrong" }, "4.4.4.4");
    expect(await login({ email: admin, password: process.env.ADMIN_PASSWORD! }, "4.4.4.4")).toEqual({ ok: true });
  });
});

describe("sign-in action", () => {
  it("explains empty and malformed fields in Uzbek, and never sends the password back", async () => {
    const empty = await customerLoginAction(initialCustomerLoginState, form({ email: "", password: "" }));
    expect(empty).toEqual({ message: null, fieldErrors: { email: copy.forms.required, password: copy.forms.required }, email: "" });

    const malformed = await customerLoginAction(initialCustomerLoginState, form({ email: "nope", password: "secret-value" }));
    expect(malformed.fieldErrors).toEqual({ email: copy.forms.email });
    expect(malformed.email).toBe("nope");
    expect(JSON.stringify(malformed)).not.toContain("secret-value");
  });

  it("keeps the email and says only that the email or password is wrong", async () => {
    const state = await customerLoginAction(initialCustomerLoginState, form({ email: EMAIL, password: "wrong-guess" }));
    expect(state).toEqual({ message: text.failed, fieldErrors: {}, email: EMAIL });
    const unknown = await customerLoginAction(initialCustomerLoginState, form({ email: "nobody@example.com", password: "wrong-guess" }));
    expect(unknown.message).toBe(text.failed);
    expect(JSON.stringify([state, unknown])).not.toContain("wrong-guess");
  });

  it("says when there have been too many attempts", async () => {
    setIp("5.5.5.5");
    let state = initialCustomerLoginState;
    for (let i = 0; i < 6; i += 1) state = await customerLoginAction(state, form({ email: EMAIL, password: "wrong" }));
    expect(state.message).toBe(text.tooMany);
  });

  it("redirects to a checked next path in the chosen world, with a session", async () => {
    await expect(customerLoginAction(initialCustomerLoginState, form({ email: EMAIL, password: PASSWORD, next: "/look", world: "soft-signal" }))).rejects.toMatchObject({
      url: "/look?world=soft-signal",
    });
    expect((await getCustomerSession())?.email).toBe(EMAIL);
  });

  it("goes home instead when next tries to leave the site, or the world is unknown", async () => {
    for (const [next, world, url] of [
      ["//evil.com", "raw-energy", "/?world=raw-energy"],
      ["https://evil.com/steal", "dark-mode", "/"],
      ["/\\evil.com", "chrome-future", "/?world=chrome-future"],
      ["/drop", "not-a-world", "/drop"],
    ]) {
      jar().clear();
      await expect(customerLoginAction(initialCustomerLoginState, form({ email: EMAIL, password: PASSWORD, next: next!, world: world! }))).rejects.toMatchObject({ url });
    }
  });
});

describe("development account", () => {
  it("is created from the environment once, and never in production", async () => {
    const db = await getDb();
    vi.stubEnv("DEMO_CUSTOMER_EMAIL", " Demo@Example.com ");
    vi.stubEnv("DEMO_CUSTOMER_PASSWORD", "demo-password-for-tests");

    vi.stubEnv("NODE_ENV", "production");
    expect(await ensureDemoCustomer(db)).toBe(false);
    vi.stubEnv("NODE_ENV", "test");

    expect(await ensureDemoCustomer(db)).toBe(true);
    expect(await ensureDemoCustomer(db)).toBe(false);
    expect(await db.select().from(customers).where(eq(customers.email, "demo@example.com"))).toHaveLength(1);
    expect(await loginCustomer({ email: "demo@example.com", password: "demo-password-for-tests" }, "1.1.1.1")).toEqual({ ok: true });
  });

  it("does nothing without both values", async () => {
    vi.stubEnv("DEMO_CUSTOMER_EMAIL", "half@example.com");
    vi.stubEnv("DEMO_CUSTOMER_PASSWORD", "");
    expect(await ensureDemoCustomer(await getDb())).toBe(false);
  });
});
