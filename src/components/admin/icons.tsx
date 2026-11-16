import type { ReactNode } from "react";

/** Line icons for the panel, 24 px grid, 1.6 stroke, currentColor. Decorative: labels carry the meaning. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const icons = {
  dashboard: (
    <Icon>
      <rect x="3.5" y="3.5" width="7" height="9" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="15.5" width="7" height="5" rx="1.5" />
    </Icon>
  ),
  products: (
    <Icon>
      <path d="M8.5 3.5 4 6.5l1.8 4 2-1V20.5h8.4V9.5l2 1 1.8-4-4.5-3a3.5 3.5 0 0 1-7 0Z" />
    </Icon>
  ),
  categories: (
    <Icon>
      <path d="M3.5 7.5h17M3.5 12h17M3.5 16.5h10" />
    </Icon>
  ),
  inventory: (
    <Icon>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16Z" />
      <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
    </Icon>
  ),
  media: (
    <Icon>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m20.5 16-5-5-8.5 8.5" />
    </Icon>
  ),
  orders: (
    <Icon>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2Z" />
      <path d="M9 8.5h6M9 12.5h6" />
    </Icon>
  ),
  customers: (
    <Icon>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 20c.7-3.5 3-5.5 6-5.5s5.3 2 6 5.5" />
      <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.2 2.5 3.5 5.2" />
    </Icon>
  ),
  promotions: (
    <Icon>
      <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1l7.9 7.9a1.4 1.4 0 0 1 0 2l-7.1 7.1a1.4 1.4 0 0 1-2 0Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </Icon>
  ),
  analytics: (
    <Icon>
      <path d="M4 20.5h16" />
      <path d="M7 16.5v-5M12 16.5v-9M17 16.5V12" />
    </Icon>
  ),
  team: (
    <Icon>
      <path d="M12 3.5 19.5 6v5.5c0 4.4-3.2 7.9-7.5 9-4.3-1.1-7.5-4.6-7.5-9V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </Icon>
  ),
  activity: (
    <Icon>
      <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </Icon>
  ),
  menu: (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  ),
  close: (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  ),
  collapse: (
    <Icon>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15M15.5 10l-2 2 2 2" />
    </Icon>
  ),
  external: (
    <Icon>
      <path d="M13.5 4.5h6v6M19.5 4.5l-8 8M10 5.5H5.5v13h13V14" />
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M14 4.5H5.5v15H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5" />
    </Icon>
  ),
  plus: (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  ),
  cube: (
    <Icon>
      <path d="M12 3.5 19.5 7.8v8.4L12 20.5l-7.5-4.3V7.8Z" />
      <path d="M4.5 7.8 12 12l7.5-4.2M12 12v8.5" />
    </Icon>
  ),
  alert: (
    <Icon>
      <path d="M12 3.5 21 19.5H3Z" />
      <path d="M12 10v4M12 16.8v.2" />
    </Icon>
  ),
};

export type IconName = keyof typeof icons;
