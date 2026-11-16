import { and, count, desc, eq } from "drizzle-orm";
import type { AdminSession } from "../auth";
import { requireAdmin } from "../auth";
import type { Executor } from "../db/client";
import { getDb } from "../db/client";
import type { ActivityMeta } from "../db/schema";
import { adminActivity } from "../db/schema";

export const ACTIVITY_TYPES = ["product", "variant", "media", "order", "category", "customer", "promotion", "admin"] as const;
export type ActivityTargetType = (typeof ACTIVITY_TYPES)[number];

export type ActivityInput = {
  action: string;
  targetType: ActivityTargetType;
  targetId?: string | null;
  targetLabel?: string | null;
  meta?: ActivityMeta;
};

const MAX_TEXT = 200;
const clip = (value: string) => (value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT - 1)}…` : value);

/** Flat values only, strings clipped. Callers pass ids, counts and names, never secrets or contact details. */
function cleanMeta(meta: ActivityMeta | undefined): ActivityMeta {
  const out: ActivityMeta = {};
  for (const [key, value] of Object.entries(meta ?? {}).slice(0, 20)) {
    out[clip(key)] = typeof value === "string" ? clip(value) : value;
  }
  return out;
}

/** Appends one entry. Run it inside the action's transaction, so a rolled-back change leaves no trace. */
export async function recordActivity(db: Executor, actor: Pick<AdminSession, "adminUserId" | "email">, entry: ActivityInput): Promise<void> {
  await db.insert(adminActivity).values({
    actorId: actor.adminUserId,
    actorEmail: actor.email,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    targetLabel: entry.targetLabel ? clip(entry.targetLabel) : null,
    meta: cleanMeta(entry.meta),
  });
}

export type ActivityRow = typeof adminActivity.$inferSelect;

/** Newest first, one page at a time. */
export async function listActivity(filter: { type?: ActivityTargetType; targetId?: string; page: number; pageSize: number }) {
  await requireAdmin("activity");
  const db = await getDb();
  const where = and(filter.type ? eq(adminActivity.targetType, filter.type) : undefined, filter.targetId ? eq(adminActivity.targetId, filter.targetId) : undefined);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(adminActivity)
      .where(where)
      .orderBy(desc(adminActivity.createdAt))
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize),
    db.select({ value: count() }).from(adminActivity).where(where),
  ]);
  return { rows, total: total?.value ?? 0 };
}
