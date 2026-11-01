import type { NextConfig } from "next";

const paused = process.env.NEXT_PUBLIC_SITE_PAUSED !== "false";

const nextConfig: NextConfig = {
  async rewrites() {
    return { beforeFiles: paused ? [
      { source: "/", destination: "/paused/index.html" },
      { source: "/api/cron/email-campaigns", destination: "/paused/cron.json" },
    ] : [], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [{ source: "/login/:path*", headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ] }, { source: "/anteprima-home/:path*", headers: [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ] }];
  },
  outputFileTracingIncludes: {
    "/*": ["./lib/qrcode/fonts/NotoSans-Regular.ttf"],
    "/api/email-campaigns": ["./lib/email/assets/*-v1.png"],
    "/api/cron/*": ["./lib/email/assets/*-v1.png"],
    "/dashboard/ceremonies/badge": ["./lib/email/assets/*-v1.png"],
    "/dashboard/ceremonies/badges": ["./lib/email/assets/*-v1.png"],
  },
};

export default nextConfig;
