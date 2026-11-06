import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Cut, Detail, Hour, FrameClass, HangMode, MediaRole, MediaSrc, Room } from "../../content/types";

/** Status list for pay on delivery (MVP.md section 2). */
export const ORDER_STATUSES = ["placed", "packed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type ShippingAddress = {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const cloths = pgTable("cloths", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  weave: text("weave").notNull(),
  composition: text("composition").notNull(),
  gsm: integer("gsm").notNull(),
  warpPerCm: integer("warp_per_cm").notNull(),
  weftPerCm: integer("weft_per_cm").notNull(),
  bend: doublePrecision("bend").notNull(),
  roughness: doublePrecision("roughness").notNull(),
  sheen: doublePrecision("sheen").notNull(),
  fuzz: doublePrecision("fuzz").notNull(),
  wrap: doublePrecision("wrap").notNull(),
});

export const pieces = pgTable(
  "pieces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    peg: text("peg").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    room: text("room").$type<Room>().notNull(),
    hour: text("hour").$type<Hour>().notNull(),
    frameClass: text("frame_class").$type<FrameClass>().notNull(),
    hang: text("hang").$type<HangMode>().notNull(),
    priceCents: integer("price_cents").notNull(),
    /** Ordered list of size labels. Variants hold the stock. */
    sizes: jsonb("sizes").$type<string[]>().notNull(),
    clothId: text("cloth_id")
      .notNull()
      .references(() => cloths.id),
    description: text("description").notNull(),
    cut: jsonb("cut").$type<Cut>().notNull(),
    gatherPct: doublePrecision("gather_pct").notNull(),
    seed: integer("seed").notNull(),
    details: jsonb("details").$type<Detail[]>().notNull(),
    published: boolean("published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("pieces_slug_key").on(t.slug),
    uniqueIndex("pieces_peg_key").on(t.peg),
    index("pieces_published_sort_idx").on(t.published, t.sortOrder),
    check("pieces_price_nonnegative", sql`${t.priceCents} >= 0`),
  ],
);

export const colourways = pgTable(
  "colourways",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => pieces.id, { onDelete: "cascade" }),
    /** The content id, for example `chalk`. Generated media is keyed by it. */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    hex: text("hex").notNull(),
    lining: text("lining").notNull(),
    position: integer("position").notNull().default(0),
    /** Removed colourways stay for past orders but cannot be bought. */
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("colourways_piece_slug_key").on(t.pieceId, t.slug)],
);

export const variants = pgTable(
  "variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => pieces.id, { onDelete: "cascade" }),
    colourwayId: uuid("colourway_id")
      .notNull()
      .references(() => colourways.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    stock: integer("stock").notNull().default(0),
    sku: text("sku").notNull(),
  },
  (t) => [
    uniqueIndex("variants_colourway_size_key").on(t.colourwayId, t.size),
    uniqueIndex("variants_sku_key").on(t.sku),
    index("variants_piece_idx").on(t.pieceId),
    check("variants_stock_nonnegative", sql`${t.stock} >= 0`),
  ],
);

/** Uploaded media only. Generated media lives in src/content/media.generated.json. */
export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pieceId: uuid("piece_id")
      .notNull()
      .references(() => pieces.id, { onDelete: "cascade" }),
    colourwayId: uuid("colourway_id")
      .notNull()
      .references(() => colourways.id, { onDelete: "cascade" }),
    role: text("role").$type<MediaRole>().notNull().default("photo"),
    hour: text("hour").$type<Hour>(),
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
  (t) => [index("product_media_colourway_idx").on(t.colourwayId)],
);

/**
 * Hide and order state for generated media, keyed by manifest id. The manifest itself is
 * never copied into the database, so new renders need no reseed.
 */
export const mediaOverrides = pgTable(
  "media_overrides",
  {
    mediaKey: text("media_key").primaryKey(),
    colourwayId: uuid("colourway_id")
      .notNull()
      .references(() => colourways.id, { onDelete: "cascade" }),
    hidden: boolean("hidden").notNull().default(false),
    position: integer("position"),
  },
  (t) => [index("media_overrides_colourway_idx").on(t.colourwayId)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Shown as L-000124. */
    seq: integer("seq").notNull().generatedAlwaysAsIdentity(),
    /** Random, at least 32 bytes. The only way to reach the confirmation page. */
    token: text("token").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("placed"),
    email: text("email").notNull(),
    phone: text("phone"),
    address: jsonb("address").$type<ShippingAddress>().notNull(),
    shippingMethod: text("shipping_method").notNull(),
    currency: text("currency").notNull().default("USD"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    paymentProvider: text("payment_provider").notNull(),
    paymentStatus: text("payment_status").notNull(),
    paymentReference: text("payment_reference"),
    /** Set once, in the same transaction as the restore. Cancelling never restores twice. */
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
    check("orders_status_valid", sql`${t.status} in ('placed', 'packed', 'shipped', 'delivered', 'cancelled')`),
    check("orders_total_adds_up", sql`${t.totalCents} = ${t.subtotalCents} + ${t.shippingCents} + ${t.taxCents}`),
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
    pieceSlug: text("piece_slug").notNull(),
    pieceName: text("piece_name").notNull(),
    peg: text("peg").notNull(),
    colourwayName: text("colourway_name").notNull(),
    size: text("size").notNull(),
    sku: text("sku").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), check("order_items_quantity_positive", sql`${t.quantity} > 0`)],
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("admin_users_email_key").on(t.email)],
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

export const newsletterSignups = pgTable(
  "newsletter_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("newsletter_signups_email_key").on(t.email)],
);
