import fs from 'fs';
import path from 'path';

export interface AuditLogOptions {
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  category: string; // e.g. PCI-DSS:10.2.2, ISO-27001:A.12.4.3
  tenant: string;
  user: string;
  action: string; // e.g. RUN_SCAN, CONFIG_AGENT, CLEAR_LOGS
  target?: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  msg: string;
}

export function getAuditLogPath(): string {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, 'audit.log');
}

export function writeAuditLog(opts: AuditLogOptions) {
  try {
    const logFilePath = getAuditLogPath();
    const timestamp = new Date().toISOString();
    const reqId = `REQ-${Math.floor(100000 + Math.random() * 900000)}`;
    const logLine = `[${timestamp}] [AUDIT] [${opts.severity}] [${reqId}] [${opts.category}] tenant=${opts.tenant} user=${opts.user} action=${opts.action} target=${opts.target || 'N/A'} status=${opts.status} msg="${opts.msg.replace(/"/g, '\\"')}"\n`;
    
    fs.appendFileSync(logFilePath, logLine, 'utf8');
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
