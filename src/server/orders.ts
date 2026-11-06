import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { commerce, shippingMethodById } from "@/content/commerce";
import { copy } from "@/content/copy";
import { calculateTotals } from "@/lib/money";
import type { PlaceOrderInput } from "@/lib/validation";
import { fieldErrors, orderTokenSchema, placeOrderSchema } from "@/lib/validation";
import { requireAdmin } from "./auth";
import { loadVariants } from "./cart";
import type { Executor, Tx } from "./db/client";
import { getDb } from "./db/client";
import type { OrderStatus, ShippingAddress } from "./db/schema";
import { orderItems, orders, variants } from "./db/schema";
import { payOnDelivery } from "./payment/pay-on-delivery";
import type { PaymentProvider } from "./payment/provider";

export type OrderLine = {
  id: string;
  variantId: string;
  pieceSlug: string;
  pieceName: string;
  peg: string;
  colourwayName: string;
  size: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type Order = {
  id: string;
  /** For display, for example L-000124. */
  number: string;
  token: string;
  status: OrderStatus;
  email: string;
  phone: string | null;
  address: ShippingAddress;
  shippingMethod: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  paymentProvider: string;
  paymentStatus: string;
  createdAt: Date;
  lines: OrderLine[];
};

export type OrderSummary = Omit<Order, "lines" | "token"> & { itemCount: number };

export const formatOrderNumber = (seq: number) => `L-${String(seq).padStart(6, "0")}`;

export type StockShortfall = { variantId: string; requested: number; available: number };

export type PlaceOrderResult =
  | { ok: true; order: Order; replayed: boolean }
  | { ok: false; code: "validation"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; code: "empty_cart"; message: string }
  | { ok: false; code: "stock"; message: string; shortfalls: StockShortfall[] }
  | { ok: false; code: "payment"; message: string };

class StockUnavailable extends Error {}
class PaymentRefused extends Error {}

type OrderRow = typeof orders.$inferSelect;
type ItemRow = typeof orderItems.$inferSelect;

function toOrder(row: OrderRow, items: ItemRow[]): Order {
  return {
    id: row.id,
    number: formatOrderNumber(row.seq),
    token: row.token,
    status: row.status,
    email: row.email,
    phone: row.phone,
    address: row.address,
    shippingMethod: row.shippingMethod,
    currency: row.currency,
    subtotalCents: row.subtotalCents,
    shippingCents: row.shippingCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    paymentProvider: row.paymentProvider,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt,
    lines: items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      pieceSlug: item.pieceSlug,
      pieceName: item.pieceName,
      peg: item.peg,
      colourwayName: item.colourwayName,
      size: item.size,
      sku: item.sku,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

async function hydrateOrder(row: OrderRow, db: Executor): Promise<Order> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, row.id)).orderBy(asc(orderItems.peg));
  return toOrder(row, items);
}

async function findByIdempotencyKey(key: string, db: Executor): Promise<Order | null> {
  const [row] = await db.select().from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
  return row ? hydrateOrder(row, db) : null;
}

/** Duplicate lines are summed, and sorted so concurrent orders lock variants in one order. */
function normaliseLines(lines: readonly { variantId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const line of lines) merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  return [...merged]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
}

async function shortfallsFor(lines: ReturnType<typeof normaliseLines>, db: Executor): Promise<StockShortfall[]> {
  const facts = await loadVariants(
    lines.map((line) => line.variantId),
    db,
  );
  return lines.flatMap((line) => {
    const fact = facts.get(line.variantId);
    const available = fact?.purchasable ? fact.stock : 0;
    return available < line.quantity ? [{ variantId: line.variantId, requested: line.quantity, available }] : [];
  });
}

/**
 * Places an order in one transaction. Only variant ids and quantities are read from the
 * input. Prices come from the database, and each line takes stock with a guarded update,
 * so the last unit can only be sold once. If any line fails, nothing is kept. A repeated
 * idempotency key returns the first order, even if the cart was cleared in between.
 */
export async function placeOrder(input: PlaceOrderInput, payment: PaymentProvider = payOnDelivery): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation", message: copy.checkout.errorSummary, fieldErrors: fieldErrors(parsed.error) };
  }
  const details = parsed.data;
  const db = await getDb();

  const earlier = await findByIdempotencyKey(details.idempotencyKey, db);
  if (earlier) return { ok: true, order: earlier, replayed: true };

  const lines = normaliseLines(details.lines);
  if (lines.length === 0) return { ok: false, code: "empty_cart", message: copy.checkout.emptyRedirectNote };

  const method = shippingMethodById(details.shippingMethod);
  if (!method) {
    return {
      ok: false,
      code: "validation",
      message: copy.checkout.errorSummary,
      fieldErrors: { shippingMethod: copy.forms.invalidChoice },
    };
  }

  try {
    return await db.transaction(async (tx) => {
      const facts = await loadVariants(
        lines.map((line) => line.variantId),
        tx,
      );
      const priced = lines.map((line) => {
        const fact = facts.get(line.variantId);
        if (!fact || !fact.purchasable) throw new StockUnavailable();
        return { ...line, fact, unitPriceCents: fact.priceCents };
      });

      const totals = calculateTotals(priced, method.cents, commerce.taxBasisPoints);

      // On a racing duplicate this waits for the other transaction, then inserts nothing.
      const [row] = await tx
        .insert(orders)
        .values({
          token: randomBytes(32).toString("base64url"),
          idempotencyKey: details.idempotencyKey,
          email: details.email,
          phone: details.phone,
          address: details.address,
          shippingMethod: method.id,
          currency: commerce.currency,
          ...totals,
          paymentProvider: payment.id,
          paymentStatus: "pending",
        })
        .onConflictDoNothing({ target: orders.idempotencyKey })
        .returning();

      if (!row) {
        const first = await findByIdempotencyKey(details.idempotencyKey, tx);
        if (!first) throw new Error("Idempotency conflict without an order");
        return { ok: true as const, order: first, replayed: true };
      }

      for (const line of priced) {
        const updated = await tx
          .update(variants)
          .set({ stock: sql`${variants.stock} - ${line.quantity}` })
          .where(and(eq(variants.id, line.variantId), sql`${variants.stock} >= ${line.quantity}`))
          .returning({ id: variants.id });
        if (updated.length === 0) throw new StockUnavailable();
      }

      const items = await tx
        .insert(orderItems)
        .values(
          priced.map(({ fact, quantity, unitPriceCents, variantId }) => ({
            orderId: row.id,
            variantId,
            pieceSlug: fact.pieceSlug,
            pieceName: fact.pieceName,
            peg: fact.peg,
            colourwayName: fact.colourwayName,
            size: fact.size,
            sku: fact.sku,
            unitPriceCents,
            quantity,
            lineTotalCents: unitPriceCents * quantity,
          })),
        )
        .returning();

      const paid = await payment.authorize({
        idempotencyKey: details.idempotencyKey,
        amountCents: totals.totalCents,
        currency: commerce.currency,
        email: details.email,
      });
      if (!paid.ok) throw new PaymentRefused();

      const [final] = await tx
        .update(orders)
        .set({ paymentProvider: paid.provider, paymentStatus: paid.status, paymentReference: paid.reference })
        .where(eq(orders.id, row.id))
        .returning();

      return { ok: true as const, order: toOrder(final ?? row, items), replayed: false };
    });
  } catch (error) {
    if (error instanceof StockUnavailable) {
      const shortfalls = await shortfallsFor(lines, db);
      const lowest = shortfalls.reduce((min, line) => Math.min(min, line.available), Number.POSITIVE_INFINITY);
      return {
        ok: false,
        code: "stock",
        message: copy.checkout.stockChanged(Number.isFinite(lowest) ? lowest : 0),
        shortfalls,
      };
    }
    if (error instanceof PaymentRefused) return { ok: false, code: "payment", message: copy.micro.checkoutError };
    throw error;
  }
}

/** The confirmation page lookup. A malformed token returns null without a query. */
export async function getOrderByToken(token: string): Promise<Order | null> {
  const parsed = orderTokenSchema.safeParse(token);
  if (!parsed.success) return null;
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.token, parsed.data)).limit(1);
  return row ? hydrateOrder(row, db) : null;
}

/* Admin. Each function checks the session itself. */

/** Newest first. */
export async function adminListOrders(filter: { status?: OrderStatus; limit?: number } = {}): Promise<OrderSummary[]> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(filter.status ? eq(orders.status, filter.status) : undefined)
    .orderBy(desc(orders.createdAt), desc(orders.seq))
    .limit(Math.min(filter.limit ?? 200, 500));
  if (rows.length === 0) return [];

  const counts = await db
    .select({ orderId: orderItems.orderId, count: sql<number>`sum(${orderItems.quantity})::int` })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(orderItems.orderId);
  const countByOrder = new Map(counts.map((row) => [row.orderId, row.count]));

  return rows.map((row) => {
    const summary: OrderSummary & Partial<Pick<Order, "lines" | "token">> = {
      ...toOrder(row, []),
      itemCount: countByOrder.get(row.id) ?? 0,
    };
    // The token is the bearer link to a receipt, so it stays out of admin lists.
    delete summary.lines;
    delete summary.token;
    return summary;
  });
}

export async function adminGetOrder(id: string): Promise<Order | null> {
  await requireAdmin();
  const db = await getDb();
  const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return row ? hydrateOrder(row, db) : null;
}

/** placed to packed to shipped to delivered. Cancelling is allowed until it ships. */
const NEXT_STATUS: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const allowedNextStatuses = (status: OrderStatus): readonly OrderStatus[] => NEXT_STATUS[status];

export type StatusChangeResult =
  | { ok: true; status: OrderStatus }
  | { ok: false; code: "not_found" }
  | { ok: false; code: "invalid_transition"; from: OrderStatus; to: OrderStatus };

/**
 * The `where status = from` makes each change a compare and swap, so two people clicking
 * at once cannot both win. Returning the row is what decides whether stock comes back.
 */
async function transition(orderId: string, to: OrderStatus, onChange?: (tx: Tx) => Promise<void>): Promise<StatusChangeResult> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!current) return { ok: false as const, code: "not_found" as const };
    const from = current.status;
    if (!NEXT_STATUS[from].includes(to)) return { ok: false as const, code: "invalid_transition" as const, from, to };

    const changed = await tx
      .update(orders)
      .set({ status: to, updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.status, from)))
      .returning({ id: orders.id });
    if (changed.length === 0) return { ok: false as const, code: "invalid_transition" as const, from, to };

    await onChange?.(tx);
    return { ok: true as const, status: to };
  });
}

/** Moves an order on. Cancelling goes through cancelOrder, so stock always comes back. */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<StatusChangeResult> {
  await requireAdmin();
  if (status === "cancelled") return cancelOrder(orderId);
  return transition(orderId, status);
}

/** Cancels and restores stock. The guarded stamp means stock returns exactly once. */
export async function cancelOrder(orderId: string): Promise<StatusChangeResult> {
  await requireAdmin();
  return transition(orderId, "cancelled", async (tx) => {
    const stamped = await tx
      .update(orders)
      .set({ stockRestoredAt: new Date() })
      .where(and(eq(orders.id, orderId), sql`${orders.stockRestoredAt} is null`))
      .returning({ id: orders.id });
    if (stamped.length === 0) return;

    const items = await tx
      .select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.variantId));
    for (const item of items) {
      await tx
        .update(variants)
        .set({ stock: sql`${variants.stock} + ${item.quantity}` })
        .where(eq(variants.id, item.variantId));
    }
  });
}
