import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: 'v0.4.1',
    name: 'Phantom SecOps',
    timestamp: new Date().toISOString(),
  });
}
