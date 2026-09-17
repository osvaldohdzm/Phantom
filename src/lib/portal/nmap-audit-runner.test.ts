import { describe, expect, it } from 'vitest';
import {
  buildIntelligentNmapAuditScript,
  buildMockNmapAuditReport,
  evaluateSshAlgorithms,
} from './nmap-audit-runner';

describe('nmap-audit-runner', () => {
  it('generates a 4-stage script with adaptive min-rate and commands logged', () => {
    const script = buildIntelligentNmapAuditScript('10.13.128.200', 1500);
    expect(script).toContain('TARGET="10.13.128.200"');
    expect(script).toContain('MIN_RATE=1500');
    expect(script).toContain('[STAGE 1/4 - RAPID OPEN PORT DISCOVERY]');
    expect(script).toContain('[CMD] ${DISCOVERY_CMD}');
    expect(script).toContain('--min-rate ${MIN_RATE}');
    expect(script).toContain('[STAGE 2/4 - SERVICE & VERSION DETECTION]');
    expect(script).toContain('[CMD] ${VERSION_CMD}');
    expect(script).toContain('[STAGE 3/4 - INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT]');
    expect(script).toContain('ssh2-enum-algos,ssh-auth-methods,ssh-hostkey,sshv1');
    expect(script).toContain('[STAGE 4/4 - CORE VULNERABILITY ASSESSMENT]');
    expect(script).toContain('[CMD] ${VULN_CMD}');
  });

  it('evaluates obsolete SSH ciphers and algorithms accurately', () => {
    const sampleOutput = `
      kex_algorithms: curve25519-sha256, diffie-hellman-group1-sha1
      encryption_algorithms: aes256-gcm@openssh.com, 3des-cbc, aes128-cbc
      mac_algorithms: hmac-sha2-256-etm@openssh.com, hmac-md5
      sshv1: Server offers SSHv1
    `;
    const res = evaluateSshAlgorithms(sampleOutput);
    expect(res.hasObsoleteKex).toBe(true);
    expect(res.hasObsoleteCiphers).toBe(true);
    expect(res.hasWeakMacs).toBe(true);
    expect(res.hasSshv1).toBe(true);
    expect(res.findings.length).toBeGreaterThanOrEqual(4);
    expect(res.recommendations.length).toBeGreaterThanOrEqual(4);
  });

  it('builds realistic mock report with command logs and warnings', () => {
    const report = buildMockNmapAuditReport('127.0.0.1');
    expect(report).toContain('[STAGE 1/4 - RAPID OPEN PORT DISCOVERY]');
    expect(report).toContain('[CMD] nmap -Pn -n -F -T4 --min-rate 1500 --max-retries 1 --open 127.0.0.1');
    expect(report).toContain('[STAGE 2/4 - SERVICE & VERSION DETECTION]');
    expect(report).toContain('[STAGE 3/4 - INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT]');
    expect(report).toContain('[!] OBSOLETE KEY EXCHANGE DETECTED');
    expect(report).toContain('[!] OBSOLETE / WEAK CIPHER DETECTED');
    expect(report).toContain('[STAGE 4/4 - CORE VULNERABILITY ASSESSMENT]');
  });
});
