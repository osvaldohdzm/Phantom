import type { NextConfig } from "next";

/** Dev-only (Turbopack / RSC). En producción no importa módulos bajo src/ (Docker runner). */
function collectDevOrigins(): string[] {
  const fallback = ["localhost", "127.0.0.1"];
  if (process.env.NODE_ENV === "production") return fallback;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./src/lib/collect-dev-origins") as {
      collectDevOrigins: () => string[];
    };
    return mod.collectDevOrigins();
  } catch {
    return fallback;
  }
}

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
    const backendUrl = (process.env.API_PROXY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    return [
      {
        source: "/api/secops-health",
        destination: `${backendUrl}/health`,
      },
      // Ingest multipart va a app/api/secops/ingest/[...path]/route.ts (sin límite 10 MB).
      // El resto de /api/secops/* usa app/api/secops/[...path]/route.ts (proxy en runtime).
      {
        source: "/api/secops/:path((?!ingest(?:/|$)).*)",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
