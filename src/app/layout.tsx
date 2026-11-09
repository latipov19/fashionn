import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { ToastProvider } from "@/components/ui/toast";
import { copy } from "@/content/copy";
import { themeCss } from "@/content/worlds";
import { LITE_KEY } from "@/lib/lite";
import { cormorant, geologica, sofiaCondensed } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100"),
  title: { default: copy.meta.title, template: copy.meta.titleTemplate },
  description: copy.meta.description,
};

export const viewport: Viewport = {
  themeColor: "#0B0B0D",
  viewportFit: "cover",
};

/** Applies light mode before the first paint, so the 3D portal never starts and then stops. */
const liteScript = `try{if(localStorage.getItem(${JSON.stringify(LITE_KEY)})==="on")document.documentElement.dataset.lite="on"}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className={`${geologica.variable} ${sofiaCondensed.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <body>
        {/* World tokens come from src/content/worlds.ts, the only place colours are defined. */}
        <style href="vv-theme" precedence="high">
          {themeCss()}
        </style>
        <Script id="vv-lite" strategy="beforeInteractive">
          {liteScript}
        </Script>
        <a href="#content" className="skip-link">
          {copy.nav.skipToContent}
        </a>
        <ToastProvider>
          <SiteHeader />
          <main id="content" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
