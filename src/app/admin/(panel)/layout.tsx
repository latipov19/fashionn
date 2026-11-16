import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Every panel page sits behind this. The session is checked on the server; `proxy.ts` only
 * speeds up the redirect for visitors with no cookie at all. Each page and action checks again,
 * with its own permission, because a layout does not run for server actions.
 */
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminPage();
  return (
    <AdminShell email={session.email} role={session.role}>
      {children}
    </AdminShell>
  );
}
