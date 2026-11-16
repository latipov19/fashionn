/**
 * Admin roles and what each may do. Pure data, shared by the server (which enforces it on every
 * read and action) and the panel (which only uses it to hide what would be refused anyway).
 *
 * - owner: everything, including the team and the store's own account settings.
 * - manager: runs the shop day to day: catalogue, stock, orders, customers, promotions, reports.
 * - editor: catalogue and media only. No orders, customers, money or people.
 */
export const ADMIN_ROLES = ["owner", "manager", "editor"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = ["catalog", "inventory", "orders", "customers", "promotions", "analytics", "activity", "team"] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const GRANTS: Record<AdminRole, readonly AdminPermission[]> = {
  owner: ADMIN_PERMISSIONS,
  manager: ["catalog", "inventory", "orders", "customers", "promotions", "analytics", "activity"],
  editor: ["catalog"],
};

export function can(role: AdminRole, permission: AdminPermission): boolean {
  return GRANTS[role]?.includes(permission) ?? false;
}

export const isAdminRole = (value: unknown): value is AdminRole => typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
