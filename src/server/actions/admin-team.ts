"use server";

import { and, eq, ne } from "drizzle-orm";
import { copy } from "@/content/copy";
import type { AdminRole } from "@/lib/admin-roles";
import type { ActionResult } from "@/lib/action-result";
import { adminUserIdSchema, changePasswordSchema, createAdminUserSchema, setAdminRoleSchema } from "@/lib/validation";
import { recordActivity } from "../admin/activity";
import { fail, guarded, invalid } from "../admin/guard";
import type { Tx } from "../db/client";
import { getDb } from "../db/client";
import { adminSessions, adminUsers } from "../db/schema";
import { hashPassword, verifyPassword } from "../password";
import { passwordChangeLimiter } from "../rate-limit";

const errors = copy.admin.errors;

/** The owners, locked for the rest of the transaction, so two demotions cannot both leave none. */
async function lockedOwners(tx: Tx) {
  return tx.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.role, "owner")).for("update");
}

/* Team. Only an owner may add, change or remove staff; nobody can sign up. */

export async function createAdminUser(input: { email: string; role: AdminRole; password: string }): Promise<ActionResult<{ id: string }>> {
  return guarded("team", async (session) => {
    const parsed = createAdminUserSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { email, role, password } = parsed.data;
    const passwordHash = await hashPassword(password);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const [row] = await tx.insert(adminUsers).values({ email, role, passwordHash }).returning({ id: adminUsers.id });
      if (!row) return fail("error", errors.generic);
      await recordActivity(tx, session, { action: "admin.created", targetType: "admin", targetId: row.id, targetLabel: email, meta: { role } });
      return { ok: true, data: { id: row.id } };
    });
  });
}

/** Changes another member's role and closes their sessions, so the change is felt at once. */
export async function setAdminRole(input: { id: string; role: AdminRole }): Promise<ActionResult> {
  return guarded("team", async (session) => {
    const parsed = setAdminRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, role } = parsed.data;
    if (id === session.adminUserId) return fail("forbidden", errors.notSelf);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const owners = await lockedOwners(tx);
      const [target] = await tx.select({ id: adminUsers.id, email: adminUsers.email, role: adminUsers.role }).from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
      if (!target) return fail("not_found", errors.notFound);
      if (target.role === "owner" && role !== "owner" && owners.length <= 1) return fail("conflict", errors.lastOwner);
      await tx.update(adminUsers).set({ role }).where(eq(adminUsers.id, id));
      await tx.delete(adminSessions).where(eq(adminSessions.adminUserId, id));
      await recordActivity(tx, session, { action: "admin.role", targetType: "admin", targetId: id, targetLabel: target.email, meta: { from: target.role, to: role } });
      return { ok: true, data: undefined };
    });
  });
}

/** Removes another member. Their sessions go with them; the activity trail keeps their email. */
export async function removeAdminUser(input: { id: string }): Promise<ActionResult> {
  return guarded("team", async (session) => {
    const parsed = adminUserIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id } = parsed.data;
    if (id === session.adminUserId) return fail("forbidden", errors.notSelf);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const owners = await lockedOwners(tx);
      const [target] = await tx.select({ id: adminUsers.id, email: adminUsers.email, role: adminUsers.role }).from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
      if (!target) return fail("not_found", errors.notFound);
      if (target.role === "owner" && owners.length <= 1) return fail("conflict", errors.lastOwner);
      await tx.delete(adminUsers).where(eq(adminUsers.id, id));
      await recordActivity(tx, session, { action: "admin.removed", targetType: "admin", targetId: id, targetLabel: target.email, meta: { role: target.role } });
      return { ok: true, data: undefined };
    });
  });
}

/* My account. Any role may change their own password and close their other sessions. */

export async function changeOwnPassword(input: { current: string; next: string; confirm: string }): Promise<ActionResult> {
  return guarded(null, async (session) => {
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (!passwordChangeLimiter.check(session.adminUserId).allowed) return fail("validation", errors.tooMany);

    const db = await getDb();
    const [user] = await db.select({ passwordHash: adminUsers.passwordHash }).from(adminUsers).where(eq(adminUsers.id, session.adminUserId)).limit(1);
    if (!user) return fail("unauthorized", errors.unauthorized);
    if (!(await verifyPassword(parsed.data.current, user.passwordHash))) return fail("validation", errors.wrongPassword, { current: errors.wrongPassword });

    const passwordHash = await hashPassword(parsed.data.next);
    await db.transaction(async (tx) => {
      await tx.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, session.adminUserId));
      await tx.delete(adminSessions).where(and(eq(adminSessions.adminUserId, session.adminUserId), ne(adminSessions.id, session.sessionId)));
      await recordActivity(tx, session, { action: "admin.password", targetType: "admin", targetId: session.adminUserId, targetLabel: session.email });
    });
    passwordChangeLimiter.clear(session.adminUserId);
    return { ok: true, data: undefined };
  });
}

export async function signOutOtherSessions(): Promise<ActionResult<{ count: number }>> {
  return guarded(null, async (session) => {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const ended = await tx
        .delete(adminSessions)
        .where(and(eq(adminSessions.adminUserId, session.adminUserId), ne(adminSessions.id, session.sessionId)))
        .returning({ id: adminSessions.id });
      await recordActivity(tx, session, { action: "admin.sessions_ended", targetType: "admin", targetId: session.adminUserId, targetLabel: session.email, meta: { sessions: ended.length } });
      return { ok: true, data: { count: ended.length } };
    });
  });
}
