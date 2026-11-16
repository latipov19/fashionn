import type { Metadata } from "next";
import type { ReactNode } from "react";
import { copy } from "@/content/copy";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: copy.admin.title, template: `%s · ${copy.admin.title}` },
  robots: { index: false, follow: false },
};

/** Loads the panel's own stylesheet for every /admin route, sign-in included, and nowhere else. */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return children;
}
