import { describe, expect, it } from 'vitest';
import {
  BAXTER_PKI_DEFAULT_CA,
  BAXTER_PKI_DEFAULT_HOST,
  BAXTER_PKI_DEFAULT_USER,
  BAXTER_PKI_SCRIPT_DIR,
  BAXTER_PKI_SCRIPT_PATH,
  BAXTER_PKI_SSH_TIMEOUT_SEC,
  BAXTER_PKI_PROVIDER_TYPE,
  buildPkiIssueJumpHostScript,
  buildPkiVerifyJumpHostScript,
  escapePsLiteral,
  resolvePkiWorkerConfig,
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
    expect(BAXTER_PKI_SSH_TIMEOUT_SEC).toBe(600);
    expect(BAXTER_PKI_PROVIDER_TYPE).toBe('CSP');
    expect(BAXTER_PKI_DEFAULT_CA).toContain('Hub Issuing CA (Kerberos)');
    expect(BAXTER_PKI_DEFAULT_CA).toContain('USDFHUBCAI');
  });

  it('issues certificates by invoking the desktop script, not inline certreq', () => {
    expect(usesDesktopCertificateScript(issueScript)).toBe(true);
    expect(issueScript).toContain('SubmitToCA');
    expect(issueScript).toContain('SubjectAlternativeNames');
    expect(issueScript).toContain('Package_*.zip');
    expect(issueScript).toContain('ZIP_BASE64_START');
    expect(issueScript).toContain('NurseCall');
    expect(issueScript).toContain('ri-vnc01.hub.baxter.com');
    expect(issueScript).toContain('pywinrm');
    expect(issueScript).toContain('--break-system-packages');
    expect(issueScript).toContain('python3 -u');
    expect(issueScript).toContain('PYTHONUNBUFFERED');
    expect(issueScript).toContain('WinRM sigue esperando');
    expect(issueScript).toContain('threading');
    expect(issueScript).toContain('$params = @{');
    expect(issueScript).toContain('& $scriptPath @params');
    expect(issueScript).toContain('if (-not $?)');
    expect(issueScript).toContain('ProviderType            = "CSP"');
    expect(issueScript).toContain('certreq.exe -submit -q -f -config $CAServer');
    expect(issueScript).not.toContain('CNG');
    expect(issueScript).not.toMatch(/-SubjectAlternativeNames[\s\S]*-SubjectAlternativeNames/);
    expect(issueScript).not.toContain('Invoke-Command -ComputerName');
    expect(issueScript).not.toContain('certreq -new');
    expect(issueScript).not.toContain('[NewRequest]');
    expect(issueScript).not.toContain('Export-RsaPrivateKeyToPem');
  });

  it('verify specs check the desktop script exists and do not generate a certificate', () => {
    expect(usesDesktopCertificateScript(verifyScript)).toBe(true);
    expect(verifyScript).toContain('SCRIPT_PKI_OK');
    expect(verifyScript).toContain('sin emitir certificado');
    expect(verifyScript).not.toContain('SubmitToCA');
    expect(verifyScript).not.toContain('certreq -new');
    expect(verifyScript).not.toContain('[NewRequest]');
  });

  it('fills WinRM worker defaults so the client form does not require the SOC editor tab', () => {
    const fromEmpty = resolvePkiWorkerConfig(null);
    expect(fromEmpty.host).toBe('10.11.240.88');
    expect(fromEmpty.username).toBe('hub\\hernano30');
    expect(fromEmpty.password.length).toBeGreaterThan(0);
    expect(fromEmpty.scriptPath).toContain('Generate-BaxterHubCertificate.ps1');

    const fromStaleCa = resolvePkiWorkerConfig(
      JSON.stringify({ host: '10.11.240.88', caName: 'ca01.hub.baxter.com\\HUB-ISSUING-CA' }),
    );
    expect(fromStaleCa.caName).toBe(BAXTER_PKI_DEFAULT_CA);

    const fromPartial = resolvePkiWorkerConfig(JSON.stringify({ host: '10.11.240.88' }));
    expect(fromPartial.password).toBe(fromEmpty.password);
    expect(fromPartial.username).toBe('hub\\hernano30');
  });
});
