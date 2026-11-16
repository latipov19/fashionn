import { copy } from "@/content/copy";
import type { AdminPermission } from "@/lib/admin-roles";
import type { IconName } from "./icons";

const pages = copy.admin.pages;

export type AdminNavItem = { href: string; label: string; icon: IconName; permission: AdminPermission | null };
export type AdminNavGroup = { label: string; items: AdminNavItem[] };

/** The panel's sections, grouped as the sidebar shows them. `null` means every role. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: copy.admin.shell.groups.overview,
    items: [
      { href: "/admin", label: pages.dashboard, icon: "dashboard", permission: null },
      { href: "/admin/analytics", label: pages.analytics, icon: "analytics", permission: "analytics" },
    ],
  },
  {
    label: copy.admin.shell.groups.catalog,
    items: [
      { href: "/admin/products", label: pages.products, icon: "products", permission: "catalog" },
      { href: "/admin/categories", label: pages.categories, icon: "categories", permission: "catalog" },
      { href: "/admin/inventory", label: pages.inventory, icon: "inventory", permission: "inventory" },
      { href: "/admin/media", label: pages.media, icon: "media", permission: "catalog" },
    ],
  },
  {
    label: copy.admin.shell.groups.sales,
    items: [
      { href: "/admin/orders", label: pages.orders, icon: "orders", permission: "orders" },
      { href: "/admin/customers", label: pages.customers, icon: "customers", permission: "customers" },
      { href: "/admin/promotions", label: pages.promotions, icon: "promotions", permission: "promotions" },
    ],
  },
  {
    label: copy.admin.shell.groups.system,
    items: [
      { href: "/admin/team", label: pages.team, icon: "team", permission: "team" },
      { href: "/admin/activity", label: pages.activity, icon: "activity", permission: "activity" },
      { href: "/admin/settings", label: pages.settings, icon: "settings", permission: null },
    ],
  },
];

/** The section a path belongs to, for breadcrumbs and the active link. */
export function sectionFor(pathname: string): AdminNavItem | null {
  const items = ADMIN_NAV.flatMap((group) => group.items);
  return items.filter((item) => item.href !== "/admin").find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? (pathname === "/admin" ? items[0]! : null);
}
