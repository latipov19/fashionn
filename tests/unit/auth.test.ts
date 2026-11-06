import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, UnauthorizedError, getSession, login, logout, requireAdmin, requireAdminPage } from "@/server/auth";
import * as adminActions from "@/server/actions/admin";
import { loginAction, logoutAction } from "@/server/actions/auth";
import { adminGetPiece, adminListCloths, adminListPieces } from "@/server/catalog";
import { closeDb, getDb } from "@/server/db/client";
import { adminSessions, pieces } from "@/server/db/schema";
import { adminGetOrder, adminListOrders, cancelOrder, setOrderStatus } from "@/server/orders";
import { hashPassword, verifyPassword } from "@/server/password";
import { createRateLimiter, loginAccountLimiter, loginLimiter, resetRateLimits } from "@/server/rate-limit";
import { jar, setIp, signIn, stockOf, variantOf } from "./helpers";

const ID = "00000000-0000-4000-8000-000000000000";
const email = process.env.ADMIN_EMAIL!;
const password = process.env.ADMIN_PASSWORD!;

beforeAll(async () => {
  await getDb();
});
afterAll(closeDb);
beforeEach(resetRateLimits);

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(stored).not.toContain("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
    expect(await verifyPassword("anything", "garbage")).toBe(false);
  });
});

describe("sessions", () => {
  it("logs in, stores only a hash and sets a safe cookie", async () => {
    expect(await login({ email, password }, "ip")).toEqual({ ok: true });
    const cookie = jar().get(SESSION_COOKIE);
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie?.value).toHaveLength(43);

    const db = await getDb();
    const rows = await db.select().from(adminSessions);
    expect(rows.some((row) => row.tokenHash === cookie?.value)).toBe(false);
    expect((await getSession())?.email).toBe(email);
  });

  it("refuses a wrong password, an unknown email and a forged cookie", async () => {
    expect(await login({ email, password: "wrong" }, "ip")).toEqual({ ok: false, code: "invalid" });
    expect(await login({ email: "nobody@example.com", password }, "ip")).toEqual({ ok: false, code: "invalid" });
    jar().set(SESSION_COOKIE, { value: "A".repeat(43) });
    expect(await getSession()).toBeNull();
    jar().set(SESSION_COOKIE, { value: "not a token" });
    expect(await getSession()).toBeNull();
  });

  it("treats an expired session as no session", async () => {
    await signIn();
    const db = await getDb();
    const session = await getSession();
    await db.update(adminSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(adminSessions.id, session!.sessionId));
    expect(await getSession()).toBeNull();
    await expect(requireAdmin()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("logout removes the row and the cookie, so the old token is dead", async () => {
    await signIn();
    const token = jar().get(SESSION_COOKIE)!.value;
    await logout();
    expect(jar().has(SESSION_COOKIE)).toBe(false);
    jar().set(SESSION_COOKIE, { value: token });
    expect(await getSession()).toBeNull();
  });

  it("the login action redirects on success and explains failure", async () => {
    await expect(loginAction({ message: null }, form({ email, password }))).rejects.toMatchObject({ url: "/admin" });
    jar().clear();
    expect(await loginAction({ message: null }, form({ email, password: "wrong" }))).toEqual({
      message: "That email and password do not match.",
    });
    await expect(logoutAction()).rejects.toMatchObject({ url: "/admin/login" });
  });
});

describe("login rate limit", () => {
  it("locks after five attempts, even with the right password", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await login({ email, password: "wrong" }, "1.1.1.1")).toEqual({ ok: false, code: "invalid" });
    }
    expect(await login({ email, password: "wrong" }, "1.1.1.1")).toEqual({ ok: false, code: "rate_limited" });
    expect(await login({ email, password }, "1.1.1.1")).toEqual({ ok: false, code: "rate_limited" });
    expect(jar().has(SESSION_COOKIE)).toBe(false);
  });

  it("does not lock out a different visitor, and a success clears the count", async () => {
    for (let i = 0; i < 6; i += 1) await login({ email, password: "wrong" }, "1.1.1.1");
    expect(await login({ email, password }, "2.2.2.2")).toEqual({ ok: true });
    expect(loginLimiter.check(`2.2.2.2|${email}`).remaining).toBe(4);
  });

  it("caps guesses per account across addresses", async () => {
    for (let i = 0; i < 20; i += 1) loginAccountLimiter.check(email);
    expect(await login({ email, password }, "9.9.9.9")).toEqual({ ok: false, code: "rate_limited" });
  });

  it("uses the address from the request in the action", async () => {
    setIp("3.3.3.3");
    for (let i = 0; i < 5; i += 1) await loginAction({ message: null }, form({ email, password: "wrong" }));
    expect((await loginAction({ message: null }, form({ email, password }))).message).toContain("Too many attempts");
    setIp("4.4.4.4");
    await expect(loginAction({ message: null }, form({ email, password }))).rejects.toMatchObject({ url: "/admin" });
  });

  it("opens again after the window passes", () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 1, windowMs: 100, now: () => time });
    expect(limiter.check("k").allowed).toBe(true);
    expect(limiter.check("k").allowed).toBe(false);
    time = 100;
    expect(limiter.check("k").allowed).toBe(true);
  });
});

describe("authorization without a session", () => {
  it("every admin action refuses and changes nothing", async () => {
    const variant = await variantOf("lintel-coat", "chalk", "S");
    const db = await getDb();
    const [piece] = await db.select().from(pieces).where(eq(pieces.slug, "lintel-coat"));

    const upload = form({ pieceId: piece!.id, colourwayId: ID, alt: "x" });
    const calls: [string, () => Promise<{ ok: boolean; code?: string }>][] = [
      ["createPiece", () => adminActions.createPiece({} as never)],
      ["updatePiece", () => adminActions.updatePiece({ id: piece!.id, name: "Hacked" })],
      ["setPiecePublished", () => adminActions.setPiecePublished({ id: piece!.id, published: false })],
      ["reorderPieces", () => adminActions.reorderPieces({ ids: [piece!.id] })],
      ["setStock", () => adminActions.setStock({ variantId: variant.id, stock: 999 })],
      ["setStockMany", () => adminActions.setStockMany({ items: [{ variantId: variant.id, stock: 999 }] })],
      ["uploadMedia", () => adminActions.uploadMedia(upload)],
      ["hideMedia", () => adminActions.hideMedia({ colourwayId: ID, mediaId: ID, hidden: true })],
      ["reorderMedia", () => adminActions.reorderMedia({ pieceId: piece!.id, colourwayId: ID, orderedIds: [ID] })],
      ["revertToGenerated", () => adminActions.revertToGenerated({ pieceId: piece!.id, colourwayId: ID })],
      ["updateOrderStatus", () => adminActions.updateOrderStatus({ orderId: ID, status: "packed" })],
    ];

    for (const [name, call] of calls) {
      expect(await call(), name).toMatchObject({ ok: false, code: "unauthorized" });
    }

    expect(await stockOf(variant.id)).toBe(variant.stock);
    const [after] = await db.select().from(pieces).where(eq(pieces.slug, "lintel-coat"));
    expect(after).toMatchObject({ name: "Lintel Coat", published: true });
  });

  it("the action list above covers every exported action", () => {
    expect(Object.keys(adminActions).sort()).toEqual(
      [
        "createPiece",
        "hideMedia",
        "reorderMedia",
        "reorderPieces",
        "revertToGenerated",
        "setPiecePublished",
        "setStock",
        "setStockMany",
        "updateOrderStatus",
        "updatePiece",
        "uploadMedia",
      ].sort(),
    );
  });

  it("admin reads and order changes throw", async () => {
    for (const read of [
      () => adminListPieces(),
      () => adminGetPiece(ID),
      () => adminListCloths(),
      () => adminListOrders(),
      () => adminGetOrder(ID),
      () => setOrderStatus(ID, "packed"),
      () => cancelOrder(ID),
    ]) {
      await expect(read()).rejects.toBeInstanceOf(UnauthorizedError);
    }
  });

  it("admin pages redirect to sign in", async () => {
    await expect(requireAdminPage()).rejects.toMatchObject({ url: "/admin/login" });
  });
});
