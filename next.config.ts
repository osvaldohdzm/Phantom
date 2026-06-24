import type { NextConfig } from "next";
import { collectDevOrigins } from "./src/lib/collect-dev-origins";

const backendUrl = (process.env.API_PROXY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Turbopack blocks cross-origin dev/RSC fetches unless the browser host is listed.
  // @ts-ignore - Next.js 16 root config
  allowedDevOrigins: collectDevOrigins(),
  // Nessus CSV puede superar 50 MB; el backend acepta hasta 150 MB (ingest.py).
  experimental: {
    proxyClientMaxBodySize: "160mb",
    // Ingesta grande (parseo + catálogo + BD) puede tardar >30 s.
    proxyTimeout: 600_000,
  },
  async redirects() {
    return [
      { source: "/Vulnerabilities", destination: "/vul-mgmt/dashboard", permanent: true },
      { source: "/vulnerabilities", destination: "/vul-mgmt/dashboard", permanent: true },
      // Evita redirect() en page.tsx (rompe Performance.measure en dev con Turbopack).
      { source: "/vul-mgmt", destination: "/vul-mgmt/dashboard", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/secops-health",
        destination: `${backendUrl}/health`,
      },
      // Ingest multipart va a app/api/secops/ingest/[...path]/route.ts (sin límite 10 MB).
      {
        source: "/api/secops/:path((?!ingest(?:/|$)).*)",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
