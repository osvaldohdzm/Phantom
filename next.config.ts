import type { NextConfig } from "next";
import { collectDevOrigins } from "./src/lib/collect-dev-origins";

const backendUrl = (process.env.API_PROXY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Turbopack blocks cross-origin dev/RSC fetches unless the browser host is listed.
  // @ts-ignore - Next.js 16 root config
  allowedDevOrigins: collectDevOrigins(),
  // Nessus CSV puede superar 10 MB; el backend acepta hasta 50 MB (ingest.py).
  experimental: {
    proxyClientMaxBodySize: "55mb",
    // Ingesta grande (parseo + catálogo + BD) puede tardar >30 s.
    proxyTimeout: 300_000,
  },
  async redirects() {
    return [
      { source: "/Vulnerabilities", destination: "/vul-mgmt", permanent: true },
      { source: "/vulnerabilities", destination: "/vul-mgmt", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/secops-health",
        destination: `${backendUrl}/health`,
      },
      {
        source: "/api/secops/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
