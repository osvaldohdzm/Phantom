import { describe, expect, it } from 'vitest';
import {
  BAXTER_PKI_DEFAULT_CA,
  BAXTER_PKI_DEFAULT_HOST,
  BAXTER_PKI_DEFAULT_USER,
  BAXTER_PKI_SCRIPT_DIR,
  BAXTER_PKI_SCRIPT_PATH,
  buildPkiIssueJumpHostScript,
  buildPkiVerifyJumpHostScript,
  escapePsLiteral,
  usesDesktopCertificateScript,
} from './baxter-hub-pki-script';

const issueScript = buildPkiIssueJumpHostScript({
  winHost: BAXTER_PKI_DEFAULT_HOST,
  winPort: '5985',
  winUsername: escapePsLiteral(BAXTER_PKI_DEFAULT_USER),
  winPassword: escapePsLiteral('secret'),
  fqdn: escapePsLiteral('ri-vnc01.hub.baxter.com'),
  ip: escapePsLiteral('10.1.2.3'),
  template: escapePsLiteral('NurseCall'),
  caName: escapePsLiteral(BAXTER_PKI_DEFAULT_CA),
  serverName: escapePsLiteral('ri-vnc01'),
  pfxPassword: escapePsLiteral('Baxter2026!'),
  scriptPath: escapePsLiteral(BAXTER_PKI_SCRIPT_PATH),
});

const verifyScript = buildPkiVerifyJumpHostScript({
  winHost: BAXTER_PKI_DEFAULT_HOST,
  winPort: '5985',
  winUsername: escapePsLiteral(BAXTER_PKI_DEFAULT_USER),
  winPassword: escapePsLiteral('secret'),
  scriptPath: escapePsLiteral(BAXTER_PKI_SCRIPT_PATH),
});

describe('Baxter HUB PKI desktop-script strategy', () => {
  it('points at the worker desktop Certificates Requests folder', () => {
    expect(BAXTER_PKI_SCRIPT_DIR).toBe('C:\\Users\\hernano30\\Desktop\\Certificates Requests');
    expect(BAXTER_PKI_SCRIPT_PATH).toContain('Generate-BaxterHubCertificate.ps1');
    expect(BAXTER_PKI_DEFAULT_HOST).toBe('10.11.240.88');
    expect(BAXTER_PKI_DEFAULT_USER).toBe('hub\\hernano30');
  });

  it('issues certificates by invoking the desktop script, not inline certreq', () => {
    expect(usesDesktopCertificateScript(issueScript)).toBe(true);
    expect(issueScript).toContain('-SubmitToCA');
    expect(issueScript).toContain('Package_*.zip');
    expect(issueScript).toContain('ZIP_BASE64_START');
    expect(issueScript).toContain('NurseCall');
    expect(issueScript).toContain('ri-vnc01.hub.baxter.com');
    expect(issueScript).not.toContain('certreq -new');
    expect(issueScript).not.toContain('[NewRequest]');
    expect(issueScript).not.toContain('Export-RsaPrivateKeyToPem');
  });

  it('verify specs check the desktop script exists and do not generate a certificate', () => {
    expect(usesDesktopCertificateScript(verifyScript)).toBe(true);
    expect(verifyScript).toContain('SCRIPT_PKI_OK');
    expect(verifyScript).toContain('sin emitir certificado');
    expect(verifyScript).not.toContain('-SubmitToCA');
    expect(verifyScript).not.toContain('certreq -new');
    expect(verifyScript).not.toContain('[NewRequest]');
  });
});
