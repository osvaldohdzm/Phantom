import { NextResponse } from 'next/server';
import fs from 'fs';
import { getAuditLogPath, writeAuditLog } from '@/lib/audit-logger';

export async function GET() {
  try {
    const logFilePath = getAuditLogPath();
    if (!fs.existsSync(logFilePath)) {
      return NextResponse.json({ logs: [], path: logFilePath });
    }
    const content = fs.readFileSync(logFilePath, 'utf8');
    const logs = content.split('\n').filter(Boolean);
    return NextResponse.json({ logs, path: logFilePath });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const logFilePath = getAuditLogPath();
    
    // Parse who cleared it if available in headers (for auditing audit log clearance!)
    const userEmail = request.headers.get('x-user-email') || 'platform_admin';
    const tenantName = request.headers.get('x-tenant-name') || 'Platform';

    // Clear file
    fs.writeFileSync(logFilePath, '', 'utf8');

    // Audit the clearance itself! This is highly standard for compliance.
    writeAuditLog({
      severity: 'CRITICAL',
      category: 'PCI-DSS:10.2.2, ISO-27001:A.12.4.3',
      tenant: tenantName,
      user: userEmail,
      action: 'CLEAR_AUDIT_LOGS',
      status: 'SUCCESS',
      msg: 'Audit log trace cleared by administrator.',
    });

    return NextResponse.json({ success: true, path: logFilePath });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
