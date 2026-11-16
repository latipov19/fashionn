import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { MediaRole, MediaSrc, SizeChart, Slot, WorldSlug } from "../../content/types";
import type { AdminRole } from "../../lib/admin-roles";

export const ORDER_STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered", "canceled", "returned"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type DeliveryAddress = {
  /** A region id from src/content/commerce.ts. */
  region: string;
  city: string;
  line: string;
};

/** Money is whole soʻm. Order totals use bigint, because 200 units can pass 2.1 billion. */
const money = (name: string) => bigint(name, { mode: "number" }).notNull();

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    slot: text("slot").$type<Slot>().notNull(),
    priceUzs: integer("price_uzs").notNull(),
    /** The earlier price. Null when there is no sale. */
    compareAtUzs: integer("compare_at_uzs"),
    /** Ordered list of size labels. Variants hold the stock. */
    sizes: jsonb("sizes").$type<string[]>().notNull(),
    description: text("description").notNull(),
    fabric: text("fabric").notNull(),
    fit: text("fit").notNull(),
    care: text("care").notNull(),
    sizeChart: jsonb("size_chart").$type<SizeChart>().notNull(),
    /** True for seeded samples. Demo products carry a tag and never emit structured data. */
    isDemo: boolean("is_demo").notNull().default(false),
    published: boolean("published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    /** Set when the owner archives the product: off the shop, out of the working lists, kept for past orders. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_handle_key").on(t.handle),
    index("products_published_sort_idx").on(t.published, t.sortOrder),
    check("products_price_nonnegative", sql`${t.priceUzs} >= 0`),
    check("products_compare_at_above_price", sql`${t.compareAtUzs} is null or ${t.compareAtUzs} > ${t.priceUzs}`),
  ],
);

/** A world is art direction in code. Which products belong to it is merchandising, so it is data. */
export const productWorlds = pgTable(
  "product_worlds",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    world: text("world").$type<WorldSlug>().notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.world] }), index("product_worlds_world_idx").on(t.world, t.position)],
);

export const productColors = pgTable(
  "product_colors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Generated media is keyed by this slug. */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    hex: text("hex").notNull(),
    position: integer("position").notNull().default(0),
    /** Removed colours stay for past orders but cannot be bought. */
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("product_colors_product_slug_key").on(t.productId, t.slug)],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: uuid("color_id")
      .notNull()
      .references(() => productColors.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    stock: integer("stock").notNull().default(0),
    sku: text("sku").notNull(),
  },
  (t) => [
    uniqueIndex("variants_color_size_key").on(t.colorId, t.size),
    uniqueIndex("variants_sku_key").on(t.sku),
    index("variants_product_idx").on(t.productId),
    check("variants_stock_nonnegative", sql`${t.stock} >= 0`),
  ],
);

/** Uploaded media only. Generated media lives in src/content/media.generated.json. */
export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorId: uuid("color_id")
      .notNull()
      .references(() => productColors.id, { onDelete: "cascade" }),
    role: text("role").$type<MediaRole>().notNull().default("photo"),
    url: text("url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    srcSet: jsonb("src_set").$type<MediaSrc[]>().notNull(),
    blur: text("blur").notNull(),
    dominant: text("dominant"),
    alt: text("alt").notNull(),
    position: integer("position").notNull().default(0),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("product_media_color_idx").on(t.colorId)],
);

/**
 * Hide and order state for generated media, keyed by manifest id. The manifest itself is
 * never copied into the database, so new renders need no reseed.
 */
export const mediaOverrides = pgTable(
  "media_overrides",
  {
    mediaKey: text("media_key").primaryKey(),
    colorId: uuid("color_id")
      .notNull()
      .references(() => productColors.id, { onDelete: "cascade" }),
    hidden: boolean("hidden").notNull().default(false),
    position: integer("position"),
  },
  (t) => [index("media_overrides_color_idx").on(t.colorId)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Shown as VV-000124. */
    seq: integer("seq").notNull().generatedAlwaysAsIdentity(),
    /** Random, at least 32 bytes. The only way to reach the confirmation page. */
    token: text("token").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: jsonb("address").$type<DeliveryAddress>().notNull(),
    notes: text("notes"),
    deliveryZone: text("delivery_zone").notNull(),
    currency: text("currency").notNull().default("UZS"),
    subtotalUzs: money("subtotal_uzs"),
    deliveryUzs: money("delivery_uzs"),
    totalUzs: money("total_uzs"),
    paymentProvider: text("payment_provider").notNull(),
    paymentStatus: text("payment_status").notNull(),
    paymentReference: text("payment_reference"),
    /** Set once, in the same transaction as the restore. Stock never comes back twice. */
    stockRestoredAt: timestamp("stock_restored_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_token_key").on(t.token),
    uniqueIndex("orders_idempotency_key_key").on(t.idempotencyKey),
    uniqueIndex("orders_seq_key").on(t.seq),
    index("orders_created_idx").on(t.createdAt),
    index("orders_status_idx").on(t.status),
    check(
      "orders_status_valid",
      sql`${t.status} in ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'canceled', 'returned')`,
    ),
    check("orders_total_adds_up", sql`${t.totalUzs} = ${t.subtotalUzs} + ${t.deliveryUzs}`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "restrict" }),
    productHandle: text("product_handle").notNull(),
    productName: text("product_name").notNull(),
    colorName: text("color_name").notNull(),
    size: text("size").notNull(),
    sku: text("sku").notNull(),
    unitPriceUzs: integer("unit_price_uzs").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalUzs: money("line_total_uzs"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_quantity_positive", sql`${t.quantity} > 0`)],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** Set only by server code: the environment's first admin is the owner, the owner adds the rest. */
    role: text("role").$type<AdminRole>().notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("admin_users_email_key").on(t.email), check("admin_users_role_valid", sql`${t.role} in ('owner', 'manager', 'editor')`)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("admin_sessions_token_hash_key").on(t.tokenHash), index("admin_sessions_expires_idx").on(t.expiresAt)],
);

/**
 * Shoppers. Kept apart from admin_users on purpose: a customer session can never pass an admin
 * check, because the two live in different tables behind different cookies.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored lower case. */
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** The name given at registration. Null for accounts made before registration existed. */
    name: text("name"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("customers_email_key").on(t.email)],
);

export const customerSessions = pgTable(
  "customer_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("customer_sessions_token_hash_key").on(t.tokenHash), index("customer_sessions_expires_idx").on(t.expiresAt)],
);

/** Flat values only, never a password, token or a shopper's contact details. */
export type ActivityMeta = Record<string, string | number | boolean | null>;

/**
 * What staff did in the panel. Written by server actions only and never edited: the panel has no
 * way to change or delete an entry. The actor's email is copied, so the trail survives their removal.
 */
export const adminActivity = pgTable(
  "admin_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => adminUsers.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    meta: jsonb("meta").$type<ActivityMeta>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("admin_activity_created_idx").on(t.createdAt), index("admin_activity_target_idx").on(t.targetType, t.targetId)],
);

/**
 * Every stock change made by staff, with the reason. Product, colour, size and SKU are copied,
 * so the history still reads after a product is deleted.
 */
export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    variantId: uuid("variant_id").references(() => variants.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    colorName: text("color_name").notNull(),
    size: text("size").notNull(),
    sku: text("sku").notNull(),
    previousStock: integer("previous_stock").notNull(),
    newStock: integer("new_stock").notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
    actorId: uuid("actor_id").references(() => adminUsers.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("inventory_adjustments_created_idx").on(t.createdAt),
    index("inventory_adjustments_variant_idx").on(t.variantId),
    check("inventory_adjustments_stock_nonnegative", sql`${t.newStock} >= 0 and ${t.previousStock} >= 0`),
  ],
);

export const PROMOTION_KINDS = ["percent", "fixed"] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

/**
 * Promo codes. Managed here; there is no checkout page yet, so nothing applies them to a
 * purchase. When checkout arrives, the server works the discount out from this row, never from
 * an amount the browser sends.
 */
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored upper case. */
    code: text("code").notNull(),
    kind: text("kind").$type<PromotionKind>().notNull(),
    /** Percent (1 to 90) or whole soʻm off. */
    value: integer("value").notNull(),
    minOrderUzs: integer("min_order_uzs").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("promotions_code_key").on(t.code),
    check("promotions_kind_valid", sql`${t.kind} in ('percent', 'fixed')`),
    check("promotions_value_valid", sql`(${t.kind} = 'percent' and ${t.value} between 1 and 90) or (${t.kind} = 'fixed' and ${t.value} > 0)`),
    check("promotions_dates_ordered", sql`${t.startsAt} is null or ${t.endsAt} is null or ${t.endsAt} > ${t.startsAt}`),
    check("promotions_limits_valid", sql`${t.minOrderUzs} >= 0 and ${t.usedCount} >= 0 and (${t.usageLimit} is null or ${t.usageLimit} > 0)`),
  ],
);

export const newsletterSignups = pgTable(
  "newsletter_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("newsletter_signups_email_key").on(t.email)],
);
