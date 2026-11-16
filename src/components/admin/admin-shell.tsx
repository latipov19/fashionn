"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRef, useSyncExternalStore } from "react";
import { SunrayMark } from "@/components/ui/marks";
import { copy } from "@/content/copy";
import type { AdminRole } from "@/lib/admin-roles";
import { can } from "@/lib/admin-roles";
import { logoutAction } from "@/server/actions/auth";
import { icons } from "./icons";
import { ADMIN_NAV, sectionFor } from "./nav";

const text = copy.admin;
const COLLAPSE_KEY = "vv-admin-collapsed";

const collapseListeners = new Set<() => void>();
function subscribeCollapse(listener: () => void) {
  collapseListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    collapseListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function readCollapse(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function NavList({ role, pathname, onNavigate }: { role: AdminRole; pathname: string; onNavigate?: () => void }) {
  const active = sectionFor(pathname);
  return (
    <>
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((item) => item.permission === null || can(role, item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="admin-nav-group">
            <p className="admin-nav-heading">{group.label}</p>
            <ul>
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="admin-nav-link" aria-current={active?.href === item.href ? "page" : undefined} title={item.label} onClick={onNavigate}>
                    {icons[item.icon]}
                    <span className="admin-nav-label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

/** Home, the section, then what this page is within it. */
function Breadcrumbs({ pathname }: { pathname: string }) {
  const section = sectionFor(pathname);
  const rest = section ? pathname.slice(section.href.length).split("/").filter(Boolean) : [];
  const leaf = rest[0] === "new" ? text.shell.new : rest[0] ? (pathname.startsWith("/admin/products") ? text.shell.edit : text.shell.detail) : null;
  const crumbs = [
    { href: "/admin", label: text.title },
    ...(section && section.href !== "/admin" ? [{ href: section.href, label: section.label }] : []),
    ...(leaf ? [{ href: pathname, label: leaf }] : []),
  ];
  return (
    <nav className="admin-crumbs" aria-label={text.shell.breadcrumbs}>
      <ol>
        {crumbs.map((crumb, i) => (
          <li key={crumb.href}>
            {i === crumbs.length - 1 ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link href={crumb.href}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Account({ email, role }: { email: string; role: AdminRole }) {
  return (
    <details className="admin-account">
      <summary>
        <span className="admin-avatar" aria-hidden="true">
          {email.slice(0, 1).toUpperCase()}
        </span>
        <span className="admin-account-email">{email}</span>
      </summary>
      <div className="admin-account-menu glass-3">
        <p className="t-micro text-muted">{text.shell.signedInAs}</p>
        <p className="admin-account-name">{email}</p>
        <p className="admin-role-tag">{text.roles[role]}</p>
        <Link href="/admin/settings" className="admin-menu-link">
          {icons.settings}
          {text.pages.settings}
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="admin-menu-link">
            {icons.logout}
            {text.login.logout}
          </button>
        </form>
      </div>
    </details>
  );
}

/**
 * The panel's frame: a sidebar that collapses to icons on desktop and becomes a modal drawer on
 * phones, a top bar with breadcrumbs, the store link and the account menu. Navigation only hides
 * what the role cannot use; every page and action checks the role again on the server.
 */
export function AdminShell({ email, role, children }: { email: string; role: AdminRole; children: ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  // A per-browser convenience only. The server snapshot is "open", so the first paint agrees.
  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapse, () => false);
  const drawer = useRef<HTMLDialogElement>(null);

  function toggle() {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      // Storage blocked: the choice cannot be kept.
    }
    collapseListeners.forEach((listener) => listener());
  }

  const closeDrawer = () => drawer.current?.close();

  return (
    <div className="admin-app" data-world="dark-mode" data-world-root="dark-mode" data-collapsed={collapsed}>
      <aside className="admin-sidebar" aria-label={text.shell.nav}>
        <div className="admin-brand">
          <Link href="/admin" className="admin-brand-link">
            <SunrayMark />
            <span className="admin-brand-name">VYBEVERSE</span>
          </Link>
          <span className="admin-brand-tag">{text.title}</span>
        </div>
        <nav className="admin-nav">
          <NavList role={role} pathname={pathname} />
        </nav>
        <button type="button" className="admin-collapse" onClick={toggle} aria-expanded={!collapsed} title={collapsed ? text.shell.expand : text.shell.collapse}>
          {icons.collapse}
          <span className="admin-nav-label">{collapsed ? text.shell.expand : text.shell.collapse}</span>
        </button>
      </aside>

      <dialog ref={drawer} className="admin-drawer" aria-label={text.shell.nav} onClick={(event) => event.target === drawer.current && closeDrawer()}>
        <div className="admin-drawer-panel">
          <div className="admin-drawer-head">
            <span className="admin-brand-name">VYBEVERSE · {text.title}</span>
            <button type="button" className="admin-icon-button" onClick={closeDrawer} aria-label={text.shell.closeMenu}>
              {icons.close}
            </button>
          </div>
          <nav className="admin-nav">
            <NavList role={role} pathname={pathname} onNavigate={closeDrawer} />
          </nav>
        </div>
      </dialog>

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-icon-button admin-menu-button" onClick={() => drawer.current?.showModal()} aria-label={text.shell.openMenu}>
            {icons.menu}
          </button>
          <Breadcrumbs pathname={pathname} />
          <div className="admin-topbar-end">
            <a href="/" className="admin-store-link" target="_blank" rel="noreferrer">
              {icons.external}
              <span>{text.shell.viewStore}</span>
            </a>
            <Account email={email} role={role} />
          </div>
        </header>
        <div className="admin-content" id="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
