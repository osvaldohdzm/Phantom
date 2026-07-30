import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const certPath = path.join(process.cwd(), 'certificates', 'localhost.pem');
    if (!fs.existsSync(certPath)) {
      return new NextResponse('Certificate not found', { status: 404 });
    }
    const certContent = fs.readFileSync(certPath);
    return new NextResponse(certContent, {
      headers: {
        'Content-Type': 'application/x-x509-ca-cert',
        'Content-Disposition': 'attachment; filename="phantom-root.crt"',
      },
    });
  } catch (error: any) {
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}
