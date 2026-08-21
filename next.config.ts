import { execSync } from "child_process";
import type { NextConfig } from "next";

// Get git commit hash at build time
let commitId = "";
try {
  commitId = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch (e) {
  commitId = "unknown";
}

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
  env: {
    NEXT_PUBLIC_GIT_COMMIT_ID: commitId,
  },
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
  // No uses rewrites afterFiles hacia API_PROXY_URL aquí:
  // se hornean en build (p.ej. :8000) y en Next ganan a /api/secops/[...path],
  // rompiendo el login en prod (404 HTML). El proxy runtime vive en:
  //   src/app/api/secops/[...path]/route.ts
  //   src/app/api/secops-health/route.ts
  //   src/app/api/secops/ingest/[...path]/route.ts
};

export default nextConfig;
