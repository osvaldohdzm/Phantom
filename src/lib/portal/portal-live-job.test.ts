import { describe, expect, it } from 'vitest';
import {
  PKI_WAIT_STAGE_COUNT,
  buildPkiElapsedHeartbeat,
  buildPkiWaitStageLine,
  detectPortalLiveJobKind,
  portalLiveJobCopy,
  sanitizePkiRemoteLogLines,
} from './portal-live-job';

describe('portal live job copy', () => {
  it('treats Baxter PKI certificate requests as PKI, not Nmap', () => {
    expect(detectPortalLiveJobKind('Solicitud de Certificado PKI Baxter (TLS/SSL)')).toBe('pki');
    const copy = portalLiveJobCopy('pki');
    expect(copy.title).toMatch(/PKI/i);
    expect(copy.title).not.toMatch(/Nmap/i);
    expect(copy.awaiting).not.toMatch(/Nmap/i);
    expect(copy.description).toMatch(/WinRM/i);
  });

  it('keeps Nmap copy only for scan services', () => {
    expect(detectPortalLiveJobKind('Escaneo de Puertos Abiertos')).toBe('nmap');
    expect(portalLiveJobCopy('nmap').title).toContain('Nmap');
  });

  it('lists PKI wait stages so the client sees WinRM/ADCS instead of a frozen Nmap bar', () => {
    const ctx = {
      fqdn: 'clientportal.spectre.local',
      ip: '1.1.1.1',
      template: 'WebServer',
      jumpHost: '10.11.254.245:22',
      winHost: '10.11.240.88',
    };
    expect(buildPkiWaitStageLine(0, ctx)).toContain('NO es un escaneo Nmap');
    expect(buildPkiWaitStageLine(4, ctx)).toContain('clientportal.spectre.local');
    expect(buildPkiWaitStageLine(4, ctx)).toContain('1.1.1.1');
    expect(buildPkiWaitStageLine(PKI_WAIT_STAGE_COUNT, ctx)).toBeNull();
    expect(buildPkiElapsedHeartbeat(45)).toContain('45s');
  });

  it('strips ZIP base64 and CLIXML from PKI logs', () => {
    const cleaned = sanitizePkiRemoteLogLines([
      '[+] WinRM ntlm OK. Hostname: USDFHUBCAI',
      'ZIP_BASE64_START',
      'A'.repeat(500),
      'ZIP_BASE64_END',
      '#< CLIXML',
      '<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04">noise</Objs>',
    ]);
    expect(cleaned).toEqual(['[+] WinRM ntlm OK. Hostname: USDFHUBCAI']);
  });
});
