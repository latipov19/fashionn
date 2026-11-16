import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { copy } from "@/content/copy";
import type { AdminPermission } from "@/lib/admin-roles";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { fieldErrors } from "@/lib/validation";
import type { AdminSession } from "../auth";
import { ForbiddenError, UnauthorizedError, requireAdmin } from "../auth";

const errors = copy.admin.errors;

export const fail = (code: ActionFailure["code"], message: string, extra?: Record<string, string>): ActionFailure => ({
  ok: false,
  code,
  message,
  ...(extra ? { fieldErrors: extra } : {}),
});

export function invalid(error: z.ZodError): ActionFailure {
  return fail("validation", errors.validation, fieldErrors(error));
}

/** Walks the error's causes for a Postgres unique violation on `constraint`. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  for (let current = error; current && typeof current === "object"; current = (current as { cause?: unknown }).cause) {
    const { code, constraint: name, message } = current as { code?: string; constraint?: string; message?: string };
    if (code === "23505" && (name === constraint || message?.includes(constraint))) return true;
  }
  return false;
}

/** Unique constraints whose violation is an expected refusal, with the field and message for it. */
const CONFLICTS: { constraint: string; field: string; message: string }[] = [
  { constraint: "products_handle_key", field: "handle", message: errors.handleTaken },
  { constraint: "promotions_code_key", field: "code", message: errors.codeTaken },
  { constraint: "admin_users_email_key", field: "email", message: errors.emailTaken },
];

/**
 * Every admin action runs through this. The session and the role's permission are checked on
 * the server before anything else; the role is read from the database, never from the request.
 * Expected refusals become results; anything else is logged without the input and reported as
 * a generic failure. A success refreshes every cached page, so the shop shows the change at once.
 */
export async function guarded<T>(permission: AdminPermission | null, work: (session: AdminSession) => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const session = await requireAdmin(permission ?? undefined);
    const result = await work(session);
    if (result.ok) revalidatePath("/", "layout");
    return result;
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail("unauthorized", errors.unauthorized);
    if (error instanceof ForbiddenError) return fail("forbidden", errors.forbidden);
    for (const conflict of CONFLICTS) {
      if (isUniqueViolation(error, conflict.constraint)) return fail("conflict", conflict.message, { [conflict.field]: conflict.message });
    }
    console.error("Admin action failed", error);
    return fail("error", errors.generic);
  }
}
