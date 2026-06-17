/**
 * Production Next.js server with HTTPS (certificates/localhost.pem).
 * API traffic is proxied to the FastAPI backend via next.config rewrites.
 *
 * BIND_ADDRESS (default 0.0.0.0) — never use shell HOSTNAME on macOS (machine name).
 */
import { createServer } from 'https';
import { parse } from 'url';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import next from 'next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const bindAddress = process.env.BIND_ADDRESS || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const certPath =
  process.env.SSL_CERT_PATH || path.join(__dirname, 'certificates', 'localhost.pem');
const keyPath =
  process.env.SSL_KEY_PATH || path.join(__dirname, 'certificates', 'localhost-key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('[!] SSL certificates not found.');
  console.error(`    Expected: ${certPath}`);
  console.error(`    and:      ${keyPath}`);
  console.error('    Run: ./scripts/generate-certs.sh');
  process.exit(1);
}

const app = next({ dev: false, hostname: bindAddress, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

function localIpv4s() {
  const ips = new Set();
  for (const list of Object.values(os.networkInterfaces())) {
    if (!list) continue;
    for (const nic of list) {
      if (nic.family === 'IPv4' && !nic.internal) ips.add(nic.address);
    }
  }
  return [...ips];
}

await app.prepare();

createServer(httpsOptions, (req, res) => {
  const parsedUrl = parse(req.url, true);
  void handle(req, res, parsedUrl);
}).listen(port, bindAddress, () => {
  const bindLabel = bindAddress === '0.0.0.0' ? 'all interfaces (0.0.0.0)' : bindAddress;
  console.log(`[+] Next.js production HTTPS on ${bindLabel}:${port}`);
  console.log(`    https://localhost:${port}`);
  for (const ip of localIpv4s()) {
    console.log(`    https://${ip}:${port}`);
  }
});
