import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { copy } from "@/content/copy";
import { forum, ysabeau } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: copy.meta.title,
  description: copy.meta.description,
};

export const viewport: Viewport = {
  themeColor: "#E4DCCD",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className={`${forum.variable} ${ysabeau.variable}`}>
      <body data-ground="bone">
        <a href="#content" className="skip-link" data-ground="raised">
          {copy.nav.skipToContent}
        </a>
        <ToastProvider>
          <main id="content" tabIndex={-1}>
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
