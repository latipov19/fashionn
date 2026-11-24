import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Browsers ignore this over plain HTTP, so it only bites in production behind HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const config: NextConfig = {
  poweredByHeader: false,
  // PGlite ships WASM and sharp ships native binaries; neither can be bundled.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    // Uploads are capped at 10 MB in validation. These leave room for multipart overhead.
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The try-on page is the one place the camera may run, and only for this site itself. The
      // later rule wins for the same header key.
      { source: "/try-on", headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }] },
    ];
  },
};

export default config;
