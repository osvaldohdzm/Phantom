import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
  let commitId = "";
  try {
    commitId = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch (e) {
    commitId = "unknown";
  }

  return NextResponse.json({
    version: 'v0.4.1',
    name: 'Phantom SecOps',
    timestamp: new Date().toISOString(),
    commitId,
  });
}
