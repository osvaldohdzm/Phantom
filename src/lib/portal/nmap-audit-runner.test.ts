import { describe, expect, it } from 'vitest';
import {
  buildIntelligentNmapAuditScript,
  buildTargetedServiceEnumerationScript,
  buildVulnerabilityAssessmentScript,
  buildMockNmapAuditReport,
  buildMockOpenPortDiscoveryReport,
  buildMockVersionDetectionReport,
  buildMockTargetedServiceEnumerationReport,
  buildMockVulnerabilityAssessmentReport,
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
    expect(script).toContain('get_service_nse "ssh"');
    expect(script).toContain('ssh2-enum-algos');
    expect(script).toContain('[STAGE 4/4 - CORE VULNERABILITY ASSESSMENT]');
    expect(script).toContain('[CMD] ${VULN_CMD}');
  });

  it('generates targeted service enumeration script (stage 1 + 2 + 3)', () => {
    const script = buildTargetedServiceEnumerationScript('10.13.128.200', 1500);
    expect(script).toContain('[STAGE 1/3 - RAPID OPEN PORT DISCOVERY]');
    expect(script).toContain('[STAGE 2/3 - SERVICE & VERSION DETECTION]');
    expect(script).toContain('[STAGE 3/3 - INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT]');
    expect(script).toContain('ssh2-enum-algos');
    expect(script).not.toContain('STAGE 4');
  });

  it('generates vulnerability assessment script (stage 1 + 2 + 3 vuln)', () => {
    const script = buildVulnerabilityAssessmentScript('10.13.128.200', 1500);
    expect(script).toContain('[STAGE 1/3 - RAPID OPEN PORT DISCOVERY]');
    expect(script).toContain('[STAGE 2/3 - SERVICE & VERSION DETECTION]');
    expect(script).toContain('[STAGE 3/3 - CORE VULNERABILITY ASSESSMENT]');
    expect(script).toContain('vulners,vuln');
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

  it('builds realistic mock reports for all 4 scan modes', () => {
    const discovery = buildMockNmapAuditReport('127.0.0.1', 'discovery');
    expect(discovery).toContain('RAPID OPEN PORT DISCOVERY');
    expect(discovery).toContain('OPEN PORT DISCOVERY COMPLETED');

    const version = buildMockNmapAuditReport('127.0.0.1', 'version');
    expect(version).toContain('PORT & SERVICE VERSION DETECTION');
    expect(version).toContain('SERVICE VERSION DETECTION COMPLETED');

    const enumReport = buildMockNmapAuditReport('127.0.0.1', 'enumeration');
    expect(enumReport).toContain('TARGETED SERVICE ENUMERATION');
    expect(enumReport).toContain('OBSOLETE KEY EXCHANGE DETECTED');

    const vulnReport = buildMockNmapAuditReport('127.0.0.1', 'vuln');
    expect(vulnReport).toContain('CORE VULNERABILITY ASSESSMENT');
    expect(vulnReport).toContain('vulners:');

    const full = buildMockNmapAuditReport('127.0.0.1');
    expect(full).toContain('[STAGE 1/4 - RAPID OPEN PORT DISCOVERY]');
    expect(full).toContain('[STAGE 4/4 - CORE VULNERABILITY ASSESSMENT]');
  });
});
