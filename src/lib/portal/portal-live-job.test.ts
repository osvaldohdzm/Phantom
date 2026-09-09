import { describe, expect, it } from 'vitest';
import {
  PKI_WAIT_STAGE_COUNT,
  buildPkiClientReport,
  buildPkiElapsedHeartbeat,
  buildPkiWaitStageLine,
  detectPortalLiveJobKind,
  portalLiveJobCopy,
  sanitizePkiRemoteLogLines,
} from './portal-live-job';

describe('portal live job copy', () => {
  it('treats Baxter PKI certificate requests as PKI, not Nmap', () => {
    expect(detectPortalLiveJobKind('Solicitud de Certificado PKI Baxter (TLS/SSL)')).toBe('pki');
    expect(detectPortalLiveJobKind('Baxter Hub PKI Certificate Request (TLS/SSL)')).toBe('pki');
    const copy = portalLiveJobCopy('pki');
    expect(copy.title).toMatch(/PKI/i);
    expect(copy.title).not.toMatch(/Nmap/i);
    expect(copy.awaiting).not.toMatch(/Nmap/i);
    expect(copy.description).toMatch(/WinRM/i);
    expect(copy.description).toMatch(/10\.11\.240\.88/);
    expect(copy.description).toMatch(/baxtersrv300/);
  });

  it('keeps Nmap copy only for scan services', () => {
    expect(detectPortalLiveJobKind('Escaneo de Puertos Abiertos')).toBe('nmap');
    expect(portalLiveJobCopy('nmap').title).toContain('Nmap');
  });

  it('lists PKI wait stages so the client sees Ubuntu jump vs Windows worker', () => {
    const ctx = {
      fqdn: 'clientportal.spectre.local',
      ip: '1.1.1.1',
      template: 'Hub_WebServer',
      jumpHost: '10.11.254.245:22',
      jumpName: 'Baxter PKI SSH Agent (baxtersrv300)',
      winHost: '10.11.240.88',
    };
    expect(buildPkiWaitStageLine(0, ctx)).toContain('does NOT issue');
    expect(buildPkiWaitStageLine(0, ctx)).toContain('baxtersrv300');
    expect(buildPkiWaitStageLine(2, ctx)).toContain('10.11.240.88');
    expect(buildPkiWaitStageLine(4, ctx)).toContain('clientportal.spectre.local');
    expect(buildPkiWaitStageLine(4, ctx)).toContain('1.1.1.1');
    expect(buildPkiWaitStageLine(PKI_WAIT_STAGE_COUNT, ctx)).toBeNull();
    expect(buildPkiElapsedHeartbeat(45)).toContain('45s');
  });

  it('strips ZIP base64, SSH wrapper, and CLIXML from PKI logs', () => {
    const cleaned = sanitizePkiRemoteLogLines([
      '[+] WinRM ntlm OK. Hostname: USDFHUBCAI',
      'TMP_FILE="/tmp/pki_req_$$.sh";',
      'echo "c2V0IC1lCmVjaG8g" | base64 -d > "$TMP_FILE";',
      'ZIP_BASE64_START',
      'A'.repeat(500),
      'ZIP_BASE64_END',
      '#< CLIXML',
      '**********************',
      'Windows PowerShell transcript start',
      'PSVersion: 5.1.20348.2760',
    ]);
    expect(cleaned).toEqual(['[+] WinRM ntlm OK. Hostname: USDFHUBCAI']);
  });

  it('builds an English success report naming both servers', () => {
    const report = buildPkiClientReport({
      issued: true,
      ticketId: 'TK-1234',
      fqdn: 'clientportal.spectre.local',
      sanIp: '1.1.1.1',
      template: 'Hub_WebServer',
      jumpName: 'Baxter PKI SSH Agent (baxtersrv300)',
      jumpHost: '10.11.254.245:22',
      winHost: '10.11.240.88',
      winPort: '5985',
      pfxPassword: 'TestBaxter!2026',
      remoteLines: [
        'TMP_FILE="/tmp/x.sh";',
        '[+] WinRM ntlm OK. Hostname: USDFHUBCAI',
        '[OK] Certificate issued by USDFHUBCAI.hub.baxter.com\\Hub Issuing CA',
        '[OK] Package created: C:\\Users\\hernano30\\Desktop\\Certificates Requests\\Package_clientportal.zip',
      ],
    });
    expect(report).toContain('RESULT: ISSUED');
    expect(report).toContain('baxtersrv300');
    expect(report).toContain('10.11.254.245:22');
    expect(report).toContain('10.11.240.88:5985');
    expect(report).toContain('does NOT create the certificate');
    expect(report).toContain('clientportal.spectre.local');
    expect(report).toContain('PFX password: TestBaxter!2026');
    expect(report).not.toContain('TMP_FILE=');
    expect(report).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/);
  });
});
