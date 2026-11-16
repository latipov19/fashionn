"use server";

import { eq } from "drizzle-orm";
import { copy } from "@/content/copy";
import type { ActionResult } from "@/lib/action-result";
import type { PromotionInput } from "@/lib/validation";
import { customerIdSchema, promotionIdSchema, promotionSchema, renameCategorySchema } from "@/lib/validation";
import { recordActivity } from "../admin/activity";
import { fail, guarded, invalid } from "../admin/guard";
import { getDb } from "../db/client";
import { customerSessions, customers, products, promotions } from "../db/schema";

const errors = copy.admin.errors;

/* Categories. A category is a field on each product, so renaming moves every product with it. */

export async function renameCategory(input: { from: string; to: string }): Promise<ActionResult<{ count: number }>> {
  return guarded("catalog", async (session) => {
    const parsed = renameCategorySchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { from, to } = parsed.data;
    const db = await getDb();
    return db.transaction(async (tx) => {
      const rows = await tx.update(products).set({ category: to, updatedAt: new Date() }).where(eq(products.category, from)).returning({ id: products.id });
      if (rows.length === 0) return fail("not_found", errors.notFound);
      await recordActivity(tx, session, { action: "category.renamed", targetType: "category", targetLabel: to, meta: { from, to, products: rows.length } });
      return { ok: true, data: { count: rows.length } };
    });
  });
}

/* Customers. Staff can end a shopper's sessions; they can never read, set or use a password. */

export async function endCustomerSessions(input: { customerId: string }): Promise<ActionResult<{ count: number }>> {
  return guarded("customers", async (session) => {
    const parsed = customerIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const [customer] = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, parsed.data.customerId)).limit(1);
      if (!customer) return fail("not_found", errors.notFound);
      const ended = await tx.delete(customerSessions).where(eq(customerSessions.customerId, customer.id)).returning({ id: customerSessions.id });
      // The shopper's id only: their name and email stay out of the trail.
      await recordActivity(tx, session, { action: "customer.sessions_ended", targetType: "customer", targetId: customer.id, meta: { sessions: ended.length } });
      return { ok: true, data: { count: ended.length } };
    });
  });
}

/* Promotions. Stored and managed only: nothing applies them until checkout exists. */

export async function savePromotion(input: PromotionInput): Promise<ActionResult<{ id: string }>> {
  return guarded("promotions", async (session) => {
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...fields } = parsed.data;
    const db = await getDb();
    return db.transaction(async (tx) => {
      if (id) {
        const [row] = await tx
          .update(promotions)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(promotions.id, id))
          .returning({ id: promotions.id });
        if (!row) return fail("not_found", errors.notFound);
        await recordActivity(tx, session, { action: "promotion.updated", targetType: "promotion", targetId: row.id, targetLabel: fields.code, meta: { kind: fields.kind, value: fields.value, active: fields.active } });
        return { ok: true, data: { id: row.id } };
      }
      const [row] = await tx.insert(promotions).values(fields).returning({ id: promotions.id });
      if (!row) return fail("error", errors.generic);
      await recordActivity(tx, session, { action: "promotion.created", targetType: "promotion", targetId: row.id, targetLabel: fields.code, meta: { kind: fields.kind, value: fields.value } });
      return { ok: true, data: { id: row.id } };
    });
  });
}

export async function deletePromotion(input: { id: string }): Promise<ActionResult> {
  return guarded("promotions", async (session) => {
    const parsed = promotionIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx.delete(promotions).where(eq(promotions.id, parsed.data.id)).returning({ id: promotions.id, code: promotions.code });
      if (!row) return fail("not_found", errors.notFound);
      await recordActivity(tx, session, { action: "promotion.deleted", targetType: "promotion", targetId: row.id, targetLabel: row.code });
      return { ok: true, data: undefined };
    });
  });
}
