import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { copy } from "@/content/copy";
import { initialCustomerRegisterState } from "@/lib/customer-register-state";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password-rules";
import { accountPagePath, safeNextPath } from "@/lib/safe-redirect";
import { fieldErrors, registerSchema } from "@/lib/validation";
import { customerRegisterAction } from "@/server/actions/customer-auth";
import { getSession, login, requireAdmin, SESSION_COOKIE, UnauthorizedError } from "@/server/auth";
import { CUSTOMER_COOKIE, getCustomerSession, loginCustomer, registerCustomer } from "@/server/customer-auth";
import { closeDb, getDb } from "@/server/db/client";
import { adminUsers, customers } from "@/server/db/schema";
import { verifyPassword } from "@/server/password";
import { resetRateLimits } from "@/server/rate-limit";
import { jar, setIp } from "./helpers";

const text = copy.account.register;
const PASSWORD = "a long shopper passphrase";

/** A fresh address per test, so tests never collide in the shared in-memory database. */
const newEmail = () => `shopper-${randomBytes(6).toString("hex")}@example.com`;
const fields = (overrides: Partial<Record<"name" | "email" | "password" | "confirm", string>> = {}) => ({
  name: "Aziza",
  email: newEmail(),
  password: PASSWORD,
  confirm: PASSWORD,
  ...overrides,
});
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const rowsFor = async (email: string) => (await getDb()).select().from(customers).where(eq(customers.email, email));

afterAll(closeDb);
beforeEach(resetRateLimits);

describe("registration rules", () => {
  it("accepts a valid account, normalises it, and drops the confirmation", () => {
    const parsed = registerSchema.parse({ name: "  Aziza   Karimova ", email: " Aziza@Example.COM ", password: PASSWORD, confirm: PASSWORD });
    expect(parsed).toEqual({ name: "Aziza Karimova", email: "aziza@example.com", password: PASSWORD });
    expect(parsed).not.toHaveProperty("confirm");
  });

  it("accepts long passphrases and generated passwords without composition rules", () => {
    for (const password of ["correct horse battery staple", "Xk9#mQ2$vL8@nP4!", "o'zbekcha parol ibora", "a".repeat(PASSWORD_MIN - 1) + "b"]) {
      expect(registerSchema.safeParse(fields({ password, confirm: password })).success).toBe(true);
    }
  });

  it.each([
    ["an empty name", { name: "   " }, "name", copy.forms.required],
    ["a name past the limit", { name: "a".repeat(81) }, "name", copy.forms.tooLong],
    ["a name with control characters", { name: "Aziza\u0000" }, "name", text.nameInvalid],
    ["a malformed email", { email: "aziza.example.com" }, "email", copy.forms.email],
    ["a short password", { password: "short", confirm: "short" }, "password", text.passwordShort(PASSWORD_MIN)],
    ["a password past the limit", { password: "a1".repeat(PASSWORD_MAX), confirm: "a1".repeat(PASSWORD_MAX) }, "password", copy.forms.tooLong],
    ["one character repeated", { password: "aaaaaaaaaaaa", confirm: "aaaaaaaaaaaa" }, "password", text.passwordWeak],
    ["an empty confirmation", { confirm: "" }, "confirm", copy.forms.required],
    ["a confirmation that differs", { confirm: `${PASSWORD}!` }, "confirm", text.mismatch],
  ] as const)("rejects %s", (_label, overrides, field, message) => {
    const result = registerSchema.safeParse(fields(overrides));
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)[field]).toBe(message);
  });

  it("rejects the email as its own password, in any case", () => {
    const result = registerSchema.safeParse({ name: "Aziza", email: "aziza@example.com", password: "Aziza@Example.com", confirm: "Aziza@Example.com" });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).password).toBe(text.passwordWeak);
  });
});

describe("registerCustomer", () => {
  it("creates a shopper with a hashed password and signs them in", async () => {
    const input = fields({ email: "  New.Shopper@Example.COM " });
    expect(await registerCustomer(input, "1.1.1.1")).toEqual({ ok: true });

    const [row] = await rowsFor("new.shopper@example.com");
    expect(row?.name).toBe("Aziza");
    expect(row?.passwordHash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[\w-]+\$[\w-]+$/);
    expect(row?.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, row!.passwordHash)).toBe(true);

    expect(jar().get(CUSTOMER_COOKIE)?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect((await getCustomerSession())?.email).toBe("new.shopper@example.com");
  });

  it("lets the new shopper sign in later with the same password", async () => {
    const input = fields();
    await registerCustomer(input, "1.1.1.1");
    jar().clear();
    expect(await loginCustomer({ email: input.email, password: PASSWORD }, "1.1.1.1")).toEqual({ ok: true });
  });

  it("refuses an email that already has an account, whatever its case, and keeps the first", async () => {
    const input = fields();
    await registerCustomer(input, "1.1.1.1");
    const [before] = await rowsFor(input.email);
    jar().clear();

    expect(await registerCustomer({ ...input, email: input.email.toUpperCase(), password: "another passphrase", confirm: "another passphrase" }, "1.1.1.1")).toEqual({
      ok: false,
      code: "taken",
    });
    expect(jar().has(CUSTOMER_COOKIE)).toBe(false);
    const rows = await rowsFor(input.email);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.passwordHash).toBe(before?.passwordHash);
  });

  it("makes exactly one account when requests with one email race", async () => {
    const input = fields();
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => registerCustomer(input, `7.7.7.${i}`)));
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.code === "taken")).toHaveLength(3);
    expect(await rowsFor(input.email)).toHaveLength(1);
  });

  it("never makes an admin, even for the admin's own email", async () => {
    const db = await getDb();
    const admins = await db.select().from(adminUsers);
    const adminEmail = process.env.ADMIN_EMAIL!;

    expect(await registerCustomer(fields({ email: adminEmail }), "1.1.1.1")).toEqual({ ok: true });
    expect(await getSession()).toBeNull();
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
    jar().set(SESSION_COOKIE, { value: jar().get(CUSTOMER_COOKIE)!.value });
    expect(await getSession()).toBeNull();

    expect(await db.select().from(adminUsers)).toEqual(admins);
    // The admin's own sign-in is untouched, and the shopper password does not open it.
    jar().clear();
    expect(await login({ email: adminEmail, password: PASSWORD }, "1.1.1.1")).toEqual({ ok: false, code: "invalid" });
    expect(await login({ email: adminEmail, password: process.env.ADMIN_PASSWORD! }, "1.1.1.1")).toEqual({ ok: true });
  });

  it("limits new accounts per address before spending time on hashing", async () => {
    for (let i = 0; i < 10; i += 1) expect((await registerCustomer(fields(), "8.8.8.8")).ok).toBe(true);
    const blocked = fields();
    expect(await registerCustomer(blocked, "8.8.8.8")).toEqual({ ok: false, code: "rate_limited" });
    expect(await rowsFor(blocked.email)).toHaveLength(0);
    // Another address is not held back.
    expect(await registerCustomer(fields(), "8.8.8.9")).toEqual({ ok: true });
  });

  it("refuses invalid input without writing anything", async () => {
    const input = fields({ confirm: "something else" });
    expect(await registerCustomer(input, "1.1.1.1")).toEqual({ ok: false, code: "invalid" });
    expect(await rowsFor(input.email)).toHaveLength(0);
  });
});

describe("registration action", () => {
  it("explains every problem in Uzbek at once, and never sends a password back", async () => {
    const empty = await customerRegisterAction(initialCustomerRegisterState, form({ name: "", email: "", password: "", confirm: "" }));
    expect(empty).toEqual({
      message: null,
      fieldErrors: { name: copy.forms.required, email: copy.forms.required, password: copy.forms.required, confirm: copy.forms.required },
      name: "",
      email: "",
    });

    const mixed = await customerRegisterAction(initialCustomerRegisterState, form({ name: "Aziza", email: "nope", password: "secret-value-1", confirm: "secret-value-2" }));
    expect(mixed.fieldErrors).toEqual({ email: copy.forms.email, confirm: text.mismatch });
    expect(mixed).toMatchObject({ name: "Aziza", email: "nope" });
    expect(JSON.stringify([empty, mixed])).not.toMatch(/secret-value/);
  });

  it("ignores fields the form does not have, such as a role or a hash", async () => {
    const email = newEmail();
    await expect(
      customerRegisterAction(
        initialCustomerRegisterState,
        form({ ...fields({ email }), role: "admin", isAdmin: "true", id: "00000000-0000-0000-0000-000000000000", passwordHash: "scrypt$1$1$1$x$y" }),
      ),
    ).rejects.toMatchObject({ url: "/" });

    const [row] = await rowsFor(email);
    expect(row?.id).not.toBe("00000000-0000-0000-0000-000000000000");
    expect(await verifyPassword(PASSWORD, row!.passwordHash)).toBe(true);
    expect(Object.keys(row!).sort()).toEqual(["createdAt", "email", "id", "name", "passwordHash"]);
    expect(await getSession()).toBeNull();
  });

  it("signs the new shopper in and goes to the checked next path, in the chosen world", async () => {
    const email = newEmail();
    await expect(customerRegisterAction(initialCustomerRegisterState, form({ ...fields({ email }), next: "/look", world: "soft-signal" }))).rejects.toMatchObject({
      url: "/look?world=soft-signal",
    });
    expect((await getCustomerSession())?.email).toBe(email);
  });

  it("goes home instead when next tries to leave the site or loop back", async () => {
    for (const [next, world, url] of [
      ["//evil.com", "raw-energy", "/?world=raw-energy"],
      ["https://evil.com/steal", "dark-mode", "/"],
      ["/register", "chrome-future", "/?world=chrome-future"],
      ["/drop", "not-a-world", "/drop"],
    ] as const) {
      jar().clear();
      await expect(customerRegisterAction(initialCustomerRegisterState, form({ ...fields(), next, world }))).rejects.toMatchObject({ url });
    }
  });

  it("says the email is taken, keeps the name and email, and opens no session", async () => {
    const input = fields();
    await registerCustomer(input, "1.1.1.1");
    jar().clear();
    const state = await customerRegisterAction(initialCustomerRegisterState, form({ ...input, name: " Aziza " }));
    expect(state).toEqual({ message: text.taken, fieldErrors: {}, name: "Aziza", email: input.email });
    expect(jar().has(CUSTOMER_COOKIE)).toBe(false);
  });

  it("says when there have been too many attempts", async () => {
    setIp("6.6.6.6");
    let state = initialCustomerRegisterState;
    for (let i = 0; i < 11; i += 1) {
      jar().clear();
      state = await customerRegisterAction(state, form(fields())).catch(() => state);
    }
    expect(state.message).toBe(text.tooMany);
  });
});

describe("links between sign-in and registration", () => {
  it("keep the world and a safe return path", () => {
    expect(accountPagePath("/register", "dark-mode", null)).toBe("/register");
    expect(accountPagePath("/register", "soft-signal", "/drop")).toBe("/register?world=soft-signal&next=%2Fdrop");
    expect(accountPagePath("/login", "raw-energy", "/look?world=raw-energy")).toBe("/login?world=raw-energy&next=%2Flook%3Fworld%3Draw-energy");
    expect(accountPagePath("/login", "dark-mode", "//evil.com")).toBe("/login");
    expect(accountPagePath("/login", "dark-mode", "/")).toBe("/login");
  });

  it("never send a shopper back to the registration page after signing in", () => {
    expect(safeNextPath("/register")).toBeNull();
    expect(safeNextPath("/register?world=raw-energy")).toBeNull();
  });
});
