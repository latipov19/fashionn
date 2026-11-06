import { newsletterSchema } from "@/lib/validation";
import { getDb } from "./db/client";
import { newsletterSignups } from "./db/schema";

export type SubscribeResult = { ok: true } | { ok: false; code: "invalid"; message: string };

/**
 * Stores a signup. A repeat address also succeeds, so the form never reveals who is
 * already on the list.
 */
export async function subscribe(input: { email: unknown }): Promise<SubscribeResult> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid", message: parsed.error.issues[0]?.message ?? "" };
  }
  const db = await getDb();
  await db.insert(newsletterSignups).values({ email: parsed.data.email }).onConflictDoNothing();
  return { ok: true };
}
