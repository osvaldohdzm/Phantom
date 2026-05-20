import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack security blocks LAN access by default unless allowed:
  // @ts-ignore - Next.js 16 undocumented root config property typed as module.exports
  allowedDevOrigins: ['192.168.0.176', 'http://192.168.0.176', 'localhost', 'http://localhost'],
};

export default nextConfig;
