import { and, asc, count, desc, eq, exists, gte, ilike, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { commerce } from "@/content/commerce";
import type { WorldSlug } from "@/content/types";
import { can } from "@/lib/admin-roles";
import type { AdminSession } from "../auth";
import { requireAdmin } from "../auth";
import { getDb } from "../db/client";
import type { OrderStatus } from "../db/schema";
import {
  adminUsers,
  customers,
  inventoryAdjustments,
  orderItems,
  orders,
  productColors,
  productMedia,
  products,
  productWorlds,
  promotions,
  variants,
} from "../db/schema";
import type { MediaRecord } from "@/content/types";
import { loadMediaForOwners, modelFor, primaryMedia } from "../media";
import { formatOrderNumber } from "../orders";

/*
 * Reads for the admin panel. Every function checks the session and the role's permission
 * itself, so a page that forgets cannot leak. Lists are paged and counted in SQL; nothing
 * loads a whole table into the browser. Password hashes and session tokens are never selected.
 */

export const PAGE_SIZE = 20;

export type Page<T> = { rows: T[]; total: number; page: number; pages: number };

const pages = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));
const offset = (page: number, size = PAGE_SIZE) => (Math.max(1, page) - 1) * size;

/** A user's text for ILIKE, with its own wildcards made literal. */
const like = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** Orders that never became sales. Revenue and analytics leave them out. */
const NOT_SALES: OrderStatus[] = ["canceled", "returned"];

/** Days in Tashkent, which keeps one offset all year. */
const TASHKENT = sql.raw("interval '5 hours'");

/* Dashboard */

export async function dashboardData(session: AdminSession) {
  const db = await getDb();
  const seeOrders = can(session.role, "orders");
  const seeCustomers = can(session.role, "customers");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [productStats] = await db
    .select({
      total: count(),
      published: sql<number>`count(*) filter (where ${products.published} and ${products.archivedAt} is null)::int`,
      drafts: sql<number>`count(*) filter (where not ${products.published} and ${products.archivedAt} is null)::int`,
      archived: sql<number>`count(*) filter (where ${products.archivedAt} is not null)::int`,
      demo: sql<number>`count(*) filter (where ${products.isDemo})::int`,
    })
    .from(products);

  const [stockStats] = await db
    .select({
      low: sql<number>`count(*) filter (where ${variants.stock} > 0 and ${variants.stock} <= ${commerce.lowStockAt})::int`,
      out: sql<number>`count(*) filter (where ${variants.stock} = 0)::int`,
    })
    .from(variants)
    .innerJoin(productColors, eq(productColors.id, variants.colorId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(productColors.active, true), isNull(products.archivedAt)));

  const lowStock = await db
    .select({ variantId: variants.id, productId: products.id, productName: products.name, colorName: productColors.name, size: variants.size, stock: variants.stock })
    .from(variants)
    .innerJoin(productColors, eq(productColors.id, variants.colorId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(productColors.active, true), isNull(products.archivedAt), sql`${variants.stock} <= ${commerce.lowStockAt}`))
    .orderBy(asc(variants.stock), asc(products.name))
    .limit(6);

  const recentProducts = await db
    .select({ id: products.id, name: products.name, published: products.published, archivedAt: products.archivedAt, isDemo: products.isDemo, createdAt: products.createdAt })
    .from(products)
    .orderBy(desc(products.createdAt))
    .limit(5);

  const orderStats = seeOrders
    ? (
        await db
          .select({
            total: count(),
            pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
            revenue: sql<number>`coalesce(sum(${orders.totalUzs}) filter (where ${orders.status} not in ('canceled', 'returned')), 0)::bigint`,
          })
          .from(orders)
      )[0]
    : null;
  const recentOrders = seeOrders
    ? await db
        .select({ id: orders.id, seq: orders.seq, customerName: orders.customerName, totalUzs: orders.totalUzs, status: orders.status, createdAt: orders.createdAt })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(5)
    : [];

  const customerStats = seeCustomers
    ? (
        await db
          .select({ total: count(), recent: sql<number>`count(*) filter (where ${customers.createdAt} >= ${since})::int` })
          .from(customers)
      )[0]
    : null;

  return {
    products: productStats!,
    stock: stockStats!,
    lowStock,
    recentProducts,
    orders: orderStats ? { ...orderStats, revenue: Number(orderStats.revenue) } : null,
    recentOrders: recentOrders.map((row) => ({ ...row, number: formatOrderNumber(row.seq) })),
    customers: customerStats ?? null,
  };
}

/* Products */

export const PRODUCT_STATUSES = ["active", "published", "draft", "archived", "all"] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_SORTS = ["updated", "name", "price_asc", "price_desc", "stock"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export type ProductListFilter = {
  q?: string;
  status: ProductStatusFilter;
  world?: WorldSlug;
  category?: string;
  kind?: "demo" | "real";
  sort: ProductSort;
  page: number;
};

export type ProductListRow = {
  id: string;
  handle: string;
  name: string;
  category: string;
  priceUzs: number;
  compareAtUzs: number | null;
  published: boolean;
  archived: boolean;
  isDemo: boolean;
  stock: number;
  updatedAt: Date;
  worlds: WorldSlug[];
  thumb: MediaRecord | null;
  hasModel: boolean;
};

/*
 * Correlated subqueries in a select list are written with explicit aliases and qualified outer
 * columns: Drizzle leaves column references unqualified in a single-table select, and an
 * unqualified "id" inside the subquery would bind to the inner table.
 */
const productStock = sql<number>`(select coalesce(sum(v.stock), 0)::int from variants v inner join product_colors c on c.id = v.color_id where v.product_id = "products"."id" and c.active)`;

export async function productListPage(filter: ProductListFilter): Promise<Page<ProductListRow>> {
  await requireAdmin("catalog");
  const db = await getDb();
  const q = filter.q?.trim();
  const statusWhere = {
    active: isNull(products.archivedAt),
    published: and(eq(products.published, true), isNull(products.archivedAt)),
    draft: and(eq(products.published, false), isNull(products.archivedAt)),
    archived: isNotNull(products.archivedAt),
    all: undefined,
  }[filter.status];
  const where = and(
    statusWhere,
    q ? or(ilike(products.name, like(q)), ilike(products.handle, like(q)), exists(db.select({ one: sql`1` }).from(variants).where(and(eq(variants.productId, products.id), ilike(variants.sku, like(q)))))) : undefined,
    filter.world ? exists(db.select({ one: sql`1` }).from(productWorlds).where(and(eq(productWorlds.productId, products.id), eq(productWorlds.world, filter.world)))) : undefined,
    filter.category ? eq(products.category, filter.category) : undefined,
    filter.kind ? eq(products.isDemo, filter.kind === "demo") : undefined,
  );
  const order = {
    updated: [desc(products.updatedAt), asc(products.name)],
    name: [asc(products.name)],
    price_asc: [asc(products.priceUzs), asc(products.name)],
    price_desc: [desc(products.priceUzs), asc(products.name)],
    stock: [asc(productStock), asc(products.name)],
  }[filter.sort];

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: products.id,
        handle: products.handle,
        name: products.name,
        category: products.category,
        priceUzs: products.priceUzs,
        compareAtUzs: products.compareAtUzs,
        published: products.published,
        archivedAt: products.archivedAt,
        isDemo: products.isDemo,
        updatedAt: products.updatedAt,
        stock: productStock,
      })
      .from(products)
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset(offset(filter.page)),
    db.select({ value: count() }).from(products).where(where),
  ]);

  const ids = rows.map((row) => row.id);
  const [colorRows, worldRows] = ids.length
    ? await Promise.all([
        db.select().from(productColors).where(and(inArray(productColors.productId, ids), eq(productColors.active, true))).orderBy(asc(productColors.position)),
        db.select().from(productWorlds).where(inArray(productWorlds.productId, ids)),
      ])
    : [[], []];
  const handleById = new Map(rows.map((row) => [row.id, row.handle]));
  const firstColor = new Map<string, (typeof colorRows)[number]>();
  for (const color of colorRows) if (!firstColor.has(color.productId)) firstColor.set(color.productId, color);
  const media = await loadMediaForOwners(
    [...firstColor.values()].map((color) => ({ productHandle: handleById.get(color.productId) ?? "", colorSlug: color.slug, colorId: color.id })),
    db,
  );

  return {
    rows: rows.map((row) => {
      const color = firstColor.get(row.id);
      return {
        ...row,
        archived: row.archivedAt !== null,
        worlds: worldRows.filter((world) => world.productId === row.id).map((world) => world.world),
        thumb: color ? primaryMedia(media.get(color.id) ?? []) : null,
        hasModel: colorRows.some((c) => c.productId === row.id && modelFor(row.handle, c.slug) !== null),
      };
    }),
    total: total?.value ?? 0,
    page: filter.page,
    pages: pages(total?.value ?? 0),
  };
}

/** What the editor needs beyond the catalogue view: archive state, last change, and whether it was ever ordered. */
export async function productAdminFacts(id: string) {
  await requireAdmin("catalog");
  const db = await getDb();
  const [row] = await db.select({ archivedAt: products.archivedAt, updatedAt: products.updatedAt }).from(products).where(eq(products.id, id)).limit(1);
  if (!row) return null;
  const [ordered] = await db
    .select({ value: count() })
    .from(orderItems)
    .innerJoin(variants, eq(variants.id, orderItems.variantId))
    .where(eq(variants.productId, id));
  return { ...row, orderLines: ordered?.value ?? 0 };
}

/** Distinct categories, for the editor's suggestions and the filters. */
export async function categoryNames(): Promise<string[]> {
  await requireAdmin("catalog");
  const db = await getDb();
  const rows = await db.selectDistinct({ category: products.category }).from(products).orderBy(asc(products.category));
  return rows.map((row) => row.category);
}

/* Categories */

export async function categoryOverview() {
  await requireAdmin("catalog");
  const db = await getDb();
  return db
    .select({
      name: products.category,
      total: count(),
      active: sql<number>`count(*) filter (where ${products.archivedAt} is null)::int`,
      published: sql<number>`count(*) filter (where ${products.published} and ${products.archivedAt} is null)::int`,
    })
    .from(products)
    .groupBy(products.category)
    .orderBy(asc(products.category));
}

/* Inventory */

export type StockState = "all" | "low" | "out" | "in";

export async function inventoryPage(filter: { q?: string; state: StockState; page: number }) {
  await requireAdmin("inventory");
  const db = await getDb();
  const q = filter.q?.trim();
  const where = and(
    isNull(products.archivedAt),
    q ? or(ilike(products.name, like(q)), ilike(variants.sku, like(q)), ilike(productColors.name, like(q))) : undefined,
    filter.state === "low" ? sql`${variants.stock} > 0 and ${variants.stock} <= ${commerce.lowStockAt}` : undefined,
    filter.state === "out" ? eq(variants.stock, 0) : undefined,
    filter.state === "in" ? sql`${variants.stock} > ${commerce.lowStockAt}` : undefined,
  );
  const base = () =>
    db
      .select({
        variantId: variants.id,
        sku: variants.sku,
        size: variants.size,
        stock: variants.stock,
        productId: products.id,
        productName: products.name,
        colorName: productColors.name,
        colorHex: productColors.hex,
        colorActive: productColors.active,
      })
      .from(variants)
      .innerJoin(productColors, eq(productColors.id, variants.colorId))
      .innerJoin(products, eq(products.id, variants.productId));
  const [rows, [total]] = await Promise.all([
    base()
      .where(where)
      .orderBy(asc(variants.stock), asc(products.name), asc(productColors.position), asc(variants.sku))
      .limit(PAGE_SIZE)
      .offset(offset(filter.page)),
    db
      .select({ value: count() })
      .from(variants)
      .innerJoin(productColors, eq(productColors.id, variants.colorId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(where),
  ]);
  return { rows, total: total?.value ?? 0, page: filter.page, pages: pages(total?.value ?? 0) };
}

/** Recent stock changes, all or for one product's variants. */
export async function stockHistory(filter: { productId?: string; limit?: number } = {}) {
  await requireAdmin(filter.productId ? "catalog" : "inventory");
  const db = await getDb();
  return db
    .select({
      id: inventoryAdjustments.id,
      productName: inventoryAdjustments.productName,
      colorName: inventoryAdjustments.colorName,
      size: inventoryAdjustments.size,
      sku: inventoryAdjustments.sku,
      previousStock: inventoryAdjustments.previousStock,
      newStock: inventoryAdjustments.newStock,
      reason: inventoryAdjustments.reason,
      note: inventoryAdjustments.note,
      actorEmail: inventoryAdjustments.actorEmail,
      createdAt: inventoryAdjustments.createdAt,
    })
    .from(inventoryAdjustments)
    .where(filter.productId ? inArray(inventoryAdjustments.variantId, db.select({ id: variants.id }).from(variants).where(eq(variants.productId, filter.productId))) : undefined)
    .orderBy(desc(inventoryAdjustments.createdAt))
    .limit(filter.limit ?? 15);
}

/* Media */

export type MediaFilter = "all" | "model" | "no_model" | "uploads";

export async function mediaLibrary(filter: { q?: string; show: MediaFilter; page: number }) {
  await requireAdmin("catalog");
  const db = await getDb();
  const q = filter.q?.trim();
  const colorRows = await db
    .select({
      productId: products.id,
      productName: products.name,
      handle: products.handle,
      isDemo: products.isDemo,
      colorId: productColors.id,
      slug: productColors.slug,
      colorName: productColors.name,
      hex: productColors.hex,
    })
    .from(productColors)
    .innerJoin(products, eq(products.id, productColors.productId))
    .where(and(isNull(products.archivedAt), eq(productColors.active, true), q ? or(ilike(products.name, like(q)), ilike(products.handle, like(q))) : undefined))
    .orderBy(asc(products.name), asc(productColors.position));

  const media = await loadMediaForOwners(colorRows.map((row) => ({ productHandle: row.handle, colorSlug: row.slug, colorId: row.colorId })), db);
  const all = colorRows.map((row) => {
    const items = media.get(row.colorId) ?? [];
    return {
      ...row,
      lead: primaryMedia(items),
      images: items.length,
      uploads: items.filter((item) => item.source === "upload").length,
      hidden: items.filter((item) => item.hidden).length,
      model: modelFor(row.handle, row.slug),
    };
  });
  const filtered = all.filter((row) =>
    filter.show === "model" ? row.model !== null : filter.show === "no_model" ? row.model === null : filter.show === "uploads" ? row.uploads > 0 : true,
  );
  const size = 24;
  return {
    rows: filtered.slice(offset(filter.page, size), offset(filter.page, size) + size),
    total: filtered.length,
    page: filter.page,
    pages: pages(filtered.length, size),
    counts: { colors: all.length, models: all.filter((row) => row.model).length, uploads: all.reduce((sum, row) => sum + row.uploads, 0) },
  };
}

/* Orders */

export async function orderListPage(filter: { q?: string; status?: OrderStatus; page: number }) {
  await requireAdmin("orders");
  const db = await getDb();
  const q = filter.q?.trim();
  const number = q?.match(/^(?:VV-?)?0*(\d{1,9})$/i);
  const where = and(
    filter.status ? eq(orders.status, filter.status) : undefined,
    q ? or(number ? eq(orders.seq, Number(number[1])) : undefined, ilike(orders.customerName, like(q)), ilike(orders.phone, like(q)), ilike(orders.email, like(q))) : undefined,
  );
  const items = sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = "orders"."id")`;
  const [rows, [total], byStatus] = await Promise.all([
    db
      .select({
        id: orders.id,
        seq: orders.seq,
        customerName: orders.customerName,
        phone: orders.phone,
        status: orders.status,
        totalUzs: orders.totalUzs,
        paymentStatus: orders.paymentStatus,
        createdAt: orders.createdAt,
        items,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.seq))
      .limit(PAGE_SIZE)
      .offset(offset(filter.page)),
    db.select({ value: count() }).from(orders).where(where),
    db.select({ status: orders.status, value: count() }).from(orders).groupBy(orders.status),
  ]);
  return {
    rows: rows.map((row) => ({ ...row, number: formatOrderNumber(row.seq) })),
    total: total?.value ?? 0,
    page: filter.page,
    pages: pages(total?.value ?? 0),
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row.value])) as Partial<Record<OrderStatus, number>>,
  };
}

/** The shopper account behind an order's email, if one registered with it. */
export async function customerForEmail(email: string | null) {
  await requireAdmin("orders");
  if (!email) return null;
  const db = await getDb();
  const [row] = await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email.trim().toLowerCase())).limit(1);
  return row ?? null;
}

/* Customers */

const activeSessions = sql<number>`(select count(*)::int from customer_sessions cs where cs.customer_id = "customers"."id" and cs.expires_at > now())`;
const ordersByEmail = sql<number>`(select count(*)::int from orders o where lower(o.email) = "customers"."email")`;

export async function customerListPage(filter: { q?: string; page: number }) {
  await requireAdmin("customers");
  const db = await getDb();
  const q = filter.q?.trim();
  const where = q ? or(ilike(customers.email, like(q)), ilike(customers.name, like(q))) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select({ id: customers.id, email: customers.email, name: customers.name, createdAt: customers.createdAt, sessions: activeSessions, orders: ordersByEmail })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset(filter.page)),
    db.select({ value: count() }).from(customers).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page: filter.page, pages: pages(total?.value ?? 0) };
}

/** One shopper, without their password hash or session tokens, and the orders under their email. */
export async function customerDetail(id: string) {
  await requireAdmin("customers");
  const db = await getDb();
  const [customer] = await db
    .select({ id: customers.id, email: customers.email, name: customers.name, createdAt: customers.createdAt, sessions: activeSessions })
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!customer) return null;
  const history = await db
    .select({ id: orders.id, seq: orders.seq, status: orders.status, totalUzs: orders.totalUzs, createdAt: orders.createdAt })
    .from(orders)
    .where(sql`lower(${orders.email}) = ${customer.email}`)
    .orderBy(desc(orders.createdAt))
    .limit(50);
  return { customer, orders: history.map((row) => ({ ...row, number: formatOrderNumber(row.seq) })) };
}

/* Promotions */

export type PromotionState = "active" | "scheduled" | "expired" | "inactive" | "exhausted";

export function promotionState(row: { active: boolean; startsAt: Date | null; endsAt: Date | null; usageLimit: number | null; usedCount: number }, now = new Date()): PromotionState {
  if (!row.active) return "inactive";
  if (row.usageLimit !== null && row.usedCount >= row.usageLimit) return "exhausted";
  if (row.endsAt && row.endsAt <= now) return "expired";
  if (row.startsAt && row.startsAt > now) return "scheduled";
  return "active";
}

export async function promotionList() {
  await requireAdmin("promotions");
  const db = await getDb();
  const rows = await db.select().from(promotions).orderBy(desc(promotions.createdAt)).limit(200);
  return rows.map((row) => ({ ...row, state: promotionState(row) }));
}

/* Analytics */

export const ANALYTICS_RANGES = [7, 30, 90] as const;

export async function analyticsData(days: (typeof ANALYTICS_RANGES)[number]) {
  await requireAdmin("analytics");
  const db = await getDb();
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const sales = and(gte(orders.createdAt, since), notInArray(orders.status, NOT_SALES));
  const day = sql<string>`to_char(date_trunc('day', ${orders.createdAt} + ${TASHKENT}), 'YYYY-MM-DD')`;

  const [totals, daily, statuses, top, byCategory, signups] = await Promise.all([
    db
      .select({ orders: count(), revenue: sql<number>`coalesce(sum(${orders.totalUzs}), 0)::bigint` })
      .from(orders)
      .where(sales),
    db
      .select({ day, orders: count(), revenue: sql<number>`coalesce(sum(${orders.totalUzs}), 0)::bigint` })
      .from(orders)
      .where(sales)
      .groupBy(day)
      .orderBy(day),
    db.select({ status: orders.status, value: count() }).from(orders).where(gte(orders.createdAt, since)).groupBy(orders.status),
    db
      .select({ name: orderItems.productName, handle: orderItems.productHandle, units: sql<number>`sum(${orderItems.quantity})::int`, revenue: sql<number>`sum(${orderItems.lineTotalUzs})::bigint` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(sales)
      .groupBy(orderItems.productName, orderItems.productHandle)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(8),
    db
      .select({ category: products.category, units: sql<number>`sum(${orderItems.quantity})::int`, revenue: sql<number>`sum(${orderItems.lineTotalUzs})::bigint` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .innerJoin(variants, eq(variants.id, orderItems.variantId))
      .innerJoin(products, eq(products.id, variants.productId))
      .where(sales)
      .groupBy(products.category)
      .orderBy(desc(sql`sum(${orderItems.lineTotalUzs})`)),
    db
      .select({ week: sql<string>`to_char(date_trunc('week', ${customers.createdAt} + ${TASHKENT}), 'YYYY-MM-DD')`, value: count() })
      .from(customers)
      .where(gte(customers.createdAt, new Date(Date.now() - 84 * 24 * 60 * 60 * 1000)))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
  ]);

  const [stock] = await db
    .select({
      in: sql<number>`count(*) filter (where ${variants.stock} > ${commerce.lowStockAt})::int`,
      low: sql<number>`count(*) filter (where ${variants.stock} > 0 and ${variants.stock} <= ${commerce.lowStockAt})::int`,
      out: sql<number>`count(*) filter (where ${variants.stock} = 0)::int`,
    })
    .from(variants)
    .innerJoin(productColors, eq(productColors.id, variants.colorId))
    .innerJoin(products, eq(products.id, variants.productId))
    .where(and(eq(productColors.active, true), isNull(products.archivedAt)));

  const revenue = Number(totals[0]?.revenue ?? 0);
  const orderCount = totals[0]?.orders ?? 0;
  const units = top.reduce((sum, row) => sum + row.units, 0);
  return {
    days,
    now,
    since,
    revenue,
    orders: orderCount,
    average: orderCount ? Math.round(revenue / orderCount) : 0,
    units,
    daily: daily.map((row) => ({ day: row.day, orders: row.orders, revenue: Number(row.revenue) })),
    statuses: Object.fromEntries(statuses.map((row) => [row.status, row.value])) as Partial<Record<OrderStatus, number>>,
    top: top.map((row) => ({ ...row, revenue: Number(row.revenue) })),
    categories: byCategory.map((row) => ({ ...row, revenue: Number(row.revenue) })),
    signups,
    stock: stock!,
  };
}

/* Team */

export async function teamList() {
  await requireAdmin("team");
  const db = await getDb();
  return db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      createdAt: adminUsers.createdAt,
      sessions: sql<number>`(select count(*)::int from admin_sessions s where s.admin_user_id = "admin_users"."id" and s.expires_at > now())`,
    })
    .from(adminUsers)
    .orderBy(asc(adminUsers.createdAt));
}

/** For the uploads count on the media screen. */
export async function uploadCount(): Promise<number> {
  await requireAdmin("catalog");
  const db = await getDb();
  const [row] = await db.select({ value: count() }).from(productMedia);
  return row?.value ?? 0;
}
