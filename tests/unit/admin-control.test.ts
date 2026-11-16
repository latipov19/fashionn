import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/content/copy";
import type { AdminRole } from "@/lib/admin-roles";
import { can } from "@/lib/admin-roles";
import * as adminActions from "@/server/actions/admin";
import * as opsActions from "@/server/actions/admin-ops";
import * as teamActions from "@/server/actions/admin-team";
import { listActivity } from "@/server/admin/activity";
import {
  analyticsData,
  categoryOverview,
  customerDetail,
  customerListPage,
  dashboardData,
  inventoryPage,
  mediaLibrary,
  orderListPage,
  productListPage,
  promotionState,
  stockHistory,
} from "@/server/admin/queries";
import { ForbiddenError, getSession, login, UnauthorizedError } from "@/server/auth";
import { listProducts } from "@/server/catalog";
import { registerCustomer } from "@/server/customer-auth";
import { closeDb, getDb } from "@/server/db/client";
import { resetAdminFromEnv } from "@/server/db/seed";
import { adminActivity, adminSessions, adminUsers, customerSessions, customers, inventoryAdjustments, products, promotions, variants } from "@/server/db/schema";
import { placeOrder } from "@/server/orders";
import { hashPassword } from "@/server/password";
import { resetRateLimits } from "@/server/rate-limit";
import { checkoutInput, forceStock, jar, signIn, stockOf, variantOf } from "./helpers";

const ID = "00000000-0000-4000-8000-000000000000";
const STAFF_PASSWORD = "a long staff passphrase";
const unique = () => randomBytes(4).toString("hex");

afterAll(closeDb);
beforeEach(() => {
  resetRateLimits();
  jar().clear();
});

/** A staff member with `role`, signed in. */
async function signInAs(role: AdminRole): Promise<{ id: string; email: string }> {
  const db = await getDb();
  const email = `${role}-${unique()}@example.com`;
  const [row] = await db.insert(adminUsers).values({ email, role, passwordHash: await hashPassword(STAFF_PASSWORD) }).returning({ id: adminUsers.id });
  jar().clear();
  resetRateLimits();
  expect(await login({ email, password: STAFF_PASSWORD }, "1.1.1.1")).toEqual({ ok: true });
  return { id: row!.id, email };
}

/** A fresh draft product with one colour and two sizes, owned by the test. */
async function draftProduct(overrides: Partial<Parameters<typeof adminActions.createProduct>[0]> = {}) {
  await signIn();
  const handle = `test-${unique()}`;
  const result = await adminActions.createProduct({
    handle,
    name: `Test ${handle}`,
    category: "Sinov",
    slot: "top",
    priceUzs: 100_000,
    sizes: ["S", "M"],
    colors: [{ slug: "qora", name: "Qora", hex: "#111111" }],
    description: "Sinov mahsuloti",
    fabric: "Paxta",
    fit: "Oddiy",
    care: "30°",
    ...overrides,
  });
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

async function activityFor(targetId: string) {
  const db = await getDb();
  return db.select().from(adminActivity).where(eq(adminActivity.targetId, targetId));
}

describe("roles", () => {
  it("grant least privilege", () => {
    expect(can("owner", "team")).toBe(true);
    expect(can("manager", "team")).toBe(false);
    expect(can("manager", "orders")).toBe(true);
    expect(can("editor", "catalog")).toBe(true);
    for (const permission of ["inventory", "orders", "customers", "promotions", "analytics", "activity", "team"] as const) expect(can("editor", permission)).toBe(false);
  });

  it("an editor manages the catalogue and is refused everything else, on the server", async () => {
    const product = await draftProduct();
    const variant = (await (await getDb()).select().from(variants).where(eq(variants.productId, product.id)))[0]!;
    await signInAs("editor");
    expect((await getSession())?.role).toBe("editor");

    expect(await adminActions.setProductPublished({ id: product.id, published: true })).toMatchObject({ ok: true });
    for (const [name, call] of [
      ["adjustStock", () => adminActions.adjustStock({ variantId: variant.id, stock: 5, reason: "count" })],
      ["updateOrderStatus", () => adminActions.updateOrderStatus({ orderId: ID, status: "packed" })],
      ["endCustomerSessions", () => opsActions.endCustomerSessions({ customerId: ID })],
      ["savePromotion", () => opsActions.savePromotion({ code: "EDITOR10", kind: "percent", value: 10 })],
      ["createAdminUser", () => teamActions.createAdminUser({ email: "x@example.com", role: "owner", password: STAFF_PASSWORD })],
    ] as const) {
      expect(await call(), name).toMatchObject({ ok: false, code: "forbidden" });
    }
    expect(await stockOf(variant.id)).toBe(0);
    await expect(orderListPage({ page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(customerListPage({ page: 1 })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(analyticsData(30)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listActivity({ page: 1, pageSize: 10 })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await productListPage({ status: "all", sort: "name", page: 1 })).total).toBeGreaterThan(0);
  });

  it("a manager runs the shop but cannot touch the team", async () => {
    const product = await draftProduct();
    const variant = (await (await getDb()).select().from(variants).where(eq(variants.productId, product.id)))[0]!;
    await signInAs("manager");
    expect(await adminActions.adjustStock({ variantId: variant.id, stock: 4, reason: "received" })).toMatchObject({ ok: true });
    expect(await teamActions.createAdminUser({ email: `m-${unique()}@example.com`, role: "owner", password: STAFF_PASSWORD })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await teamActions.setAdminRole({ id: ID, role: "owner" })).toMatchObject({ ok: false, code: "forbidden" });
  });

  it("the dashboard hides sales figures from a role without them", async () => {
    await signInAs("editor");
    const data = await dashboardData((await getSession())!);
    expect(data.orders).toBeNull();
    expect(data.customers).toBeNull();
    expect(data.recentOrders).toEqual([]);
  });
});

describe("without a session", () => {
  it("every operations and team action refuses", async () => {
    const calls: [string, () => Promise<{ ok: boolean; code?: string }>][] = [
      ["renameCategory", () => opsActions.renameCategory({ from: "Hudi", to: "Xudi" })],
      ["endCustomerSessions", () => opsActions.endCustomerSessions({ customerId: ID })],
      ["savePromotion", () => opsActions.savePromotion({ code: "NOPE10", kind: "percent", value: 10 })],
      ["deletePromotion", () => opsActions.deletePromotion({ id: ID })],
      ["createAdminUser", () => teamActions.createAdminUser({ email: "a@example.com", role: "owner", password: STAFF_PASSWORD })],
      ["setAdminRole", () => teamActions.setAdminRole({ id: ID, role: "owner" })],
      ["removeAdminUser", () => teamActions.removeAdminUser({ id: ID })],
      ["changeOwnPassword", () => teamActions.changeOwnPassword({ current: "x", next: STAFF_PASSWORD, confirm: STAFF_PASSWORD })],
      ["signOutOtherSessions", () => teamActions.signOutOtherSessions()],
    ];
    for (const [name, call] of calls) expect(await call(), name).toMatchObject({ ok: false, code: "unauthorized" });
    expect([...Object.keys(opsActions), ...Object.keys(teamActions)].sort()).toEqual(calls.map(([name]) => name).sort());
    await expect(productListPage({ status: "all", sort: "name", page: 1 })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("a shopper's registration never reaches the panel", async () => {
    expect(await registerCustomer({ name: "Ali", email: `shop-${unique()}@example.com`, password: "a shopper passphrase", confirm: "a shopper passphrase" }, "1.1.1.1")).toEqual({ ok: true });
    expect(await getSession()).toBeNull();
    expect(await opsActions.savePromotion({ code: "SHOPPER10", kind: "percent", value: 10 })).toMatchObject({ ok: false, code: "unauthorized" });
  });
});

describe("products", () => {
  it("bulk-publishes, unpublishes and archives, and the shop follows", async () => {
    const a = await draftProduct();
    const b = await draftProduct();
    expect(await adminActions.bulkProducts({ ids: [a.id, b.id], op: "publish" })).toEqual({ ok: true, data: { count: 2 } });
    expect((await listProducts()).some((product) => product.id === a.id)).toBe(true);

    expect(await adminActions.bulkProducts({ ids: [a.id], op: "archive" })).toEqual({ ok: true, data: { count: 1 } });
    expect((await listProducts()).some((product) => product.id === a.id)).toBe(false);
    // Archiving twice touches nothing.
    expect(await adminActions.bulkProducts({ ids: [a.id], op: "archive" })).toEqual({ ok: true, data: { count: 0 } });
    expect((await productListPage({ status: "archived", sort: "name", page: 1, q: a.handle })).rows.map((row) => row.id)).toEqual([a.id]);
    expect((await productListPage({ status: "active", sort: "name", page: 1, q: a.handle })).total).toBe(0);

    expect((await activityFor(a.id)).map((entry) => entry.action).sort()).toEqual(["product.archived", "product.created", "product.published"]);
    expect(await adminActions.bulkProducts({ ids: [], op: "publish" })).toMatchObject({ ok: false, code: "validation" });
  });

  it("restores an archived product as a draft, and publishing brings it back to the shop", async () => {
    const product = await draftProduct({ published: true });
    await adminActions.archiveProduct({ id: product.id });
    expect(await adminActions.restoreProduct({ id: product.id })).toMatchObject({ ok: true });
    const [row] = await (await getDb()).select().from(products).where(eq(products.id, product.id));
    expect(row).toMatchObject({ archivedAt: null, published: false });
    await adminActions.archiveProduct({ id: product.id });
    await adminActions.setProductPublished({ id: product.id, published: true });
    const [again] = await (await getDb()).select().from(products).where(eq(products.id, product.id));
    expect(again).toMatchObject({ archivedAt: null, published: true });
  });

  it("deletes only after the handle is typed, and never a product that was ordered", async () => {
    const product = await draftProduct();
    expect(await adminActions.deleteProduct({ id: product.id, confirm: "wrong" })).toMatchObject({ ok: false, code: "validation", fieldErrors: { confirm: copy.admin.errors.confirmMismatch } });
    expect(await adminActions.deleteProduct({ id: product.id, confirm: product.handle })).toEqual({ ok: true, data: undefined });
    expect(await (await getDb()).select().from(products).where(eq(products.id, product.id))).toHaveLength(0);
    expect((await activityFor(product.id)).map((entry) => entry.action)).toContain("product.deleted");

    const ordered = await variantOf("noir-oversize-hudi", "qora", "M");
    await signIn();
    const [noir] = await (await getDb()).select().from(products).where(eq(products.handle, "noir-oversize-hudi"));
    const placed = await placeOrder(checkoutInput([{ variantId: ordered.id, quantity: 1 }]));
    expect(placed.ok).toBe(true);
    expect(await adminActions.deleteProduct({ id: noir!.id, confirm: "noir-oversize-hudi" })).toMatchObject({ ok: false, code: "conflict", message: copy.admin.errors.hasOrders });
    expect(await (await getDb()).select().from(products).where(eq(products.id, noir!.id))).toHaveLength(1);
  });

  it("finds products by SKU and filters by world and kind", async () => {
    await signIn();
    const bySku = await productListPage({ status: "all", sort: "name", page: 1, q: "NOIR-OVERSIZE-HUDI-QORA" });
    expect(bySku.rows.map((row) => row.handle)).toContain("noir-oversize-hudi");
    const soft = await productListPage({ status: "all", sort: "name", page: 1, world: "soft-signal" });
    expect(soft.rows.every((row) => row.worlds.includes("soft-signal"))).toBe(true);
    const demo = await productListPage({ status: "all", sort: "price_asc", page: 1, kind: "demo" });
    expect(demo.rows.every((row) => row.isDemo)).toBe(true);
    expect(demo.rows.map((row) => row.priceUzs)).toEqual([...demo.rows.map((row) => row.priceUzs)].sort((x, y) => x - y));
    // A user's wildcard is literal.
    expect((await productListPage({ status: "all", sort: "name", page: 1, q: "%" })).total).toBe(0);
  });

  it("keeps the 3D model reference when product details change", async () => {
    await signIn();
    const [noir] = await (await getDb()).select().from(products).where(eq(products.handle, "noir-oversize-hudi"));
    expect(await adminActions.updateProduct({ id: noir!.id, description: "Yangilangan tavsif" })).toMatchObject({ ok: true });
    const library = await mediaLibrary({ show: "model", page: 1, q: "noir" });
    expect(library.rows.find((row) => row.handle === "noir-oversize-hudi" && row.slug === "qora")?.model?.url).toBe("/media/ai/3d/noir-oversize-hudi-qora.glb");
  });
});

describe("stock", () => {
  it("records every change with the reason, the old and new count and who made it", async () => {
    const product = await draftProduct();
    const [variant] = await (await getDb()).select().from(variants).where(eq(variants.productId, product.id));
    const owner = (await getSession())!;

    expect(await adminActions.adjustStock({ variantId: variant!.id, stock: 7, reason: "received", note: "Partiya 12" })).toEqual({ ok: true, data: { changed: true } });
    expect(await adminActions.adjustStock({ variantId: variant!.id, stock: 7, reason: "count" })).toEqual({ ok: true, data: { changed: false } });
    expect(await adminActions.adjustStock({ variantId: variant!.id, stock: -1, reason: "count" })).toMatchObject({ ok: false, code: "validation" });
    expect(await adminActions.setStock({ variantId: variant!.id, stock: 3 })).toMatchObject({ ok: true });

    const history = await (await getDb()).select().from(inventoryAdjustments).where(eq(inventoryAdjustments.variantId, variant!.id));
    expect(history.map((entry) => [entry.previousStock, entry.newStock, entry.reason]).sort()).toEqual(
      [
        [0, 7, "received"],
        [7, 3, "manual"],
      ].sort(),
    );
    expect(history.every((entry) => entry.actorEmail === owner.email && entry.sku.endsWith("-S") === (entry.size === "S"))).toBe(true);
    expect((await stockHistory({ productId: product.id })).length).toBe(2);
    expect(await stockOf(variant!.id)).toBe(3);
  });

  it("filters low and sold-out variants", async () => {
    await signIn();
    const low = await inventoryPage({ state: "low", page: 1 });
    expect(low.rows.every((row) => row.stock > 0 && row.stock <= 2)).toBe(true);
    const out = await inventoryPage({ state: "out", page: 1 });
    expect(out.rows.every((row) => row.stock === 0)).toBe(true);
  });
});

describe("categories", () => {
  it("renames a category across its products, and refuses the same name", async () => {
    const category = `Kat ${unique()}`;
    const a = await draftProduct({ category });
    await draftProduct({ category });
    expect(await opsActions.renameCategory({ from: category, to: `${category}  yangi` })).toEqual({ ok: true, data: { count: 2 } });
    const [row] = await (await getDb()).select().from(products).where(eq(products.id, a.id));
    expect(row?.category).toBe(`${category} yangi`);
    expect((await categoryOverview()).find((entry) => entry.name === `${category} yangi`)?.total).toBe(2);
    expect(await opsActions.renameCategory({ from: "Yoq", to: "Yoq" })).toMatchObject({ ok: false, code: "validation" });
    expect(await opsActions.renameCategory({ from: "Mavjud emas", to: "Boshqa" })).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("customers", () => {
  it("lists shoppers without secrets, ends their sessions, and logs no contact details", async () => {
    const email = `customer-${unique()}@example.com`;
    await registerCustomer({ name: "Malika", email, password: "a shopper passphrase", confirm: "a shopper passphrase" }, "1.1.1.1");
    jar().clear();
    await signIn();
    const page = await customerListPage({ page: 1, q: email });
    expect(page.rows).toHaveLength(1);
    expect(Object.keys(page.rows[0]!).sort()).toEqual(["createdAt", "email", "id", "name", "orders", "sessions"]);
    expect(page.rows[0]!.sessions).toBe(1);

    const detail = await customerDetail(page.rows[0]!.id);
    expect(JSON.stringify(detail)).not.toMatch(/scrypt|password|token/i);
    expect(await opsActions.endCustomerSessions({ customerId: page.rows[0]!.id })).toEqual({ ok: true, data: { count: 1 } });
    expect(await (await getDb()).select().from(customerSessions).where(eq(customerSessions.customerId, page.rows[0]!.id))).toHaveLength(0);
    const [entry] = await activityFor(page.rows[0]!.id);
    expect(JSON.stringify(entry)).not.toContain(email);
  });
});

describe("orders", () => {
  it("are searchable by number and counted in analytics, cancelled ones excluded", async () => {
    await signIn();
    const variant = await variantOf("cut-line-futbolka", "sut", "M");
    await forceStock(variant.id, 10);
    const placed = await placeOrder(checkoutInput([{ variantId: variant.id, quantity: 2 }]));
    if (!placed.ok) throw new Error(`order failed: ${JSON.stringify(placed)}`);
    const found = await orderListPage({ page: 1, q: placed.order.number });
    expect(found.rows.map((row) => row.id)).toEqual([placed.order.id]);
    expect(found.rows[0]!.items).toBe(2);

    const before = await analyticsData(30);
    expect(before.revenue).toBeGreaterThanOrEqual(placed.order.totalUzs);
    expect(before.top.some((row) => row.handle === "cut-line-futbolka")).toBe(true);
    expect(await adminActions.updateOrderStatus({ orderId: placed.order.id, status: "canceled" })).toMatchObject({ ok: true });
    const after = await analyticsData(30);
    expect(after.revenue).toBe(before.revenue - placed.order.totalUzs);
    expect((await activityFor(placed.order.id)).map((entry) => entry.action)).toEqual(["order.status"]);
  });
});

describe("promotions", () => {
  it("stores codes upper case, refuses duplicates and impossible values, and works out their state", async () => {
    await signIn();
    const code = `vybe${unique()}`;
    const created = await opsActions.savePromotion({ code, kind: "percent", value: 15, minOrderUzs: 200_000 });
    if (!created.ok) throw new Error(created.message);
    const [row] = await (await getDb()).select().from(promotions).where(eq(promotions.id, created.data.id));
    expect(row?.code).toBe(code.toUpperCase());

    expect(await opsActions.savePromotion({ code, kind: "fixed", value: 1000 })).toMatchObject({ ok: false, code: "conflict" });
    expect(await opsActions.savePromotion({ code: "BIG99", kind: "percent", value: 95 })).toMatchObject({ ok: false, code: "validation" });
    expect(await opsActions.savePromotion({ code: "BAD!", kind: "fixed", value: 1000 })).toMatchObject({ ok: false, code: "validation" });
    expect(await opsActions.savePromotion({ code: "DATES1", kind: "fixed", value: 1000, startsAt: "2026-12-10T10:00", endsAt: "2026-12-01T10:00" })).toMatchObject({ ok: false, code: "validation" });

    expect(await opsActions.savePromotion({ id: created.data.id, code, kind: "percent", value: 20, active: false })).toMatchObject({ ok: true });
    expect(await opsActions.deletePromotion({ id: created.data.id })).toMatchObject({ ok: true });
    expect(await opsActions.deletePromotion({ id: created.data.id })).toMatchObject({ ok: false, code: "not_found" });

    const now = new Date("2026-11-16T12:00:00Z");
    const base = { active: true, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0 };
    expect(promotionState(base, now)).toBe("active");
    expect(promotionState({ ...base, active: false }, now)).toBe("inactive");
    expect(promotionState({ ...base, startsAt: new Date("2026-12-01") }, now)).toBe("scheduled");
    expect(promotionState({ ...base, endsAt: new Date("2026-11-01") }, now)).toBe("expired");
    expect(promotionState({ ...base, usageLimit: 5, usedCount: 5 }, now)).toBe("exhausted");
  });
});

describe("console recovery of the owner", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sets the env admin's password to the current ADMIN_PASSWORD, as owner, and closes its sessions", async () => {
    const email = process.env.ADMIN_EMAIL!;
    await signIn();
    const db = await getDb();
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    await db.update(adminUsers).set({ role: "manager" }).where(eq(adminUsers.id, admin!.id));

    const original = process.env.ADMIN_PASSWORD!;
    try {
      vi.stubEnv("ADMIN_PASSWORD", "a freshly chosen owner passphrase");
      const outcome = await resetAdminFromEnv(db);
      expect(outcome).toMatchObject({ result: "updated", email });
      expect(outcome.sessionsClosed).toBeGreaterThanOrEqual(1);
      expect(await db.select().from(adminSessions).where(eq(adminSessions.adminUserId, admin!.id))).toHaveLength(0);

      jar().clear();
      resetRateLimits();
      expect(await login({ email, password: original }, "5.5.5.5")).toMatchObject({ ok: false });
      expect(await login({ email, password: "a freshly chosen owner passphrase" }, "5.5.5.5")).toEqual({ ok: true });
      expect((await getSession())?.role).toBe("owner");
      const [entry] = await db.select().from(adminActivity).where(and(eq(adminActivity.targetId, admin!.id), eq(adminActivity.actorEmail, "server console")));
      expect(entry?.action).toBe("admin.password");
      expect(JSON.stringify(entry)).not.toContain("freshly chosen");
    } finally {
      // Back to the suite's own password for the tests that follow, whatever happened above.
      vi.stubEnv("ADMIN_PASSWORD", original);
      await resetAdminFromEnv(db);
    }
  });

  it("creates a missing owner, and refuses short or missing values without changing anything", async () => {
    const db = await getDb();
    const email = `new-owner-${unique()}@example.com`;
    vi.stubEnv("ADMIN_EMAIL", email);
    vi.stubEnv("ADMIN_PASSWORD", "short");
    expect(await resetAdminFromEnv(db)).toEqual({ result: "too_short", email });
    expect(await db.select().from(adminUsers).where(eq(adminUsers.email, email))).toHaveLength(0);

    vi.stubEnv("ADMIN_PASSWORD", "another long owner passphrase");
    expect(await resetAdminFromEnv(db)).toEqual({ result: "created", email, sessionsClosed: 0 });
    const [row] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    expect(row?.role).toBe("owner");

    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(await resetAdminFromEnv(db)).toEqual({ result: "missing_env" });
  });
});

describe("team and account", () => {
  it("the owner adds staff, changes a role (closing their sessions) and removes them, never themselves", async () => {
    await signIn();
    const owner = (await getSession())!;
    const email = `staff-${unique()}@example.com`;
    const created = await teamActions.createAdminUser({ email: email.toUpperCase(), role: "editor", password: STAFF_PASSWORD });
    if (!created.ok) throw new Error(created.message);
    expect(await teamActions.createAdminUser({ email, role: "manager", password: STAFF_PASSWORD })).toMatchObject({ ok: false, code: "conflict" });
    expect(await teamActions.createAdminUser({ email: `short-${unique()}@example.com`, role: "editor", password: "short" })).toMatchObject({ ok: false, code: "validation" });

    // The new member signs in, then the owner changes their role.
    const ownerCookie = jar().get("vv_admin")!;
    expect(await login({ email, password: STAFF_PASSWORD }, "2.2.2.2")).toEqual({ ok: true });
    jar().set("vv_admin", ownerCookie);
    expect(await teamActions.setAdminRole({ id: created.data.id, role: "manager" })).toMatchObject({ ok: true });
    expect(await (await getDb()).select().from(adminSessions).where(eq(adminSessions.adminUserId, created.data.id))).toHaveLength(0);

    expect(await teamActions.setAdminRole({ id: owner.adminUserId, role: "editor" })).toMatchObject({ ok: false, message: copy.admin.errors.notSelf });
    expect(await teamActions.removeAdminUser({ id: owner.adminUserId })).toMatchObject({ ok: false, message: copy.admin.errors.notSelf });
    expect(await teamActions.removeAdminUser({ id: created.data.id })).toMatchObject({ ok: true });
    const trail = await (await getDb()).select().from(adminActivity).where(and(eq(adminActivity.targetType, "admin"), eq(adminActivity.targetId, created.data.id)));
    expect(trail.map((entry) => entry.action).sort()).toEqual(["admin.created", "admin.removed", "admin.role"]);
    expect(JSON.stringify(trail)).not.toContain(STAFF_PASSWORD);
  });

  it("changes one's own password: checks the current one, keeps this session, closes the others", async () => {
    const me = await signInAs("editor");
    const mine = jar().get("vv_admin")!;
    expect(await login({ email: me.email, password: STAFF_PASSWORD }, "3.3.3.3")).toEqual({ ok: true });
    jar().set("vv_admin", mine);
    expect(await (await getDb()).select().from(adminSessions).where(eq(adminSessions.adminUserId, me.id))).toHaveLength(2);

    expect(await teamActions.changeOwnPassword({ current: "wrong one", next: "a brand new passphrase", confirm: "a brand new passphrase" })).toMatchObject({ ok: false, fieldErrors: { current: copy.admin.errors.wrongPassword } });
    expect(await teamActions.changeOwnPassword({ current: STAFF_PASSWORD, next: "a brand new passphrase", confirm: "different passphrase" })).toMatchObject({ ok: false, code: "validation" });
    expect(await teamActions.changeOwnPassword({ current: STAFF_PASSWORD, next: "a brand new passphrase", confirm: "a brand new passphrase" })).toMatchObject({ ok: true });

    expect(await (await getDb()).select().from(adminSessions).where(eq(adminSessions.adminUserId, me.id))).toHaveLength(1);
    expect((await getSession())?.adminUserId).toBe(me.id);
    jar().clear();
    expect(await login({ email: me.email, password: STAFF_PASSWORD }, "4.4.4.4")).toMatchObject({ ok: false });
    expect(await login({ email: me.email, password: "a brand new passphrase" }, "4.4.4.4")).toEqual({ ok: true });
  });

  it("shows the activity trail newest first, filtered by type", async () => {
    await draftProduct();
    const { rows, total } = await listActivity({ type: "product", page: 1, pageSize: 5 });
    expect(total).toBeGreaterThan(0);
    expect(rows.every((row) => row.targetType === "product")).toBe(true);
    expect(rows.map((row) => row.createdAt.getTime())).toEqual([...rows.map((row) => row.createdAt.getTime())].sort((a, b) => b - a));
    expect(customers).toBeDefined();
  });
});
