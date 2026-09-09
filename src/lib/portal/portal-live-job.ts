export type PortalLiveJobKind = 'pki' | 'flame' | 'nmap';

export function detectPortalLiveJobKind(ticketType: string): PortalLiveJobKind {
  const t = ticketType || '';
  const lower = t.toLowerCase();
  if (
    lower.includes('certificado') ||
    lower.includes('certificate') ||
    lower.includes('pki') ||
    lower.includes('certreq')
  ) {
    return 'pki';
  }
  if (
    t === 'DNS Functional & Performance Assessment' ||
    t === 'DDoS Stress Simulation' ||
    t === 'DDoS stress simulation' ||
    lower.includes('flame') ||
    lower.includes('stress')
  ) {
    return 'flame';
  }
  return 'nmap';
}

export function portalLiveJobCopy(kind: PortalLiveJobKind) {
  if (kind === 'pki') {
    return {
      title: 'PKI certificate issuance in progress',
      description:
        'Two servers: Portal SSH to Ubuntu jump host (baxtersrv300), then WinRM to Windows PKI worker 10.11.240.88. The jump host does not issue the cert.',
      awaiting:
        '[~] Waiting on WinRM + ADCS. The portal does not stream: the real log arrives when SSH returns (up to ~10 min).',
      submitBusy: 'Issuing certificate...',
    };
  }
  if (kind === 'flame') {
    return {
      title: 'Flamethrower in progress',
      description: 'DNS load / stress test on the SSH agent host.',
      awaiting: '[~] Waiting for Flamethrower stdout...',
      submitBusy: 'Running Flamethrower...',
    };
  }
  return {
    title: 'Nmap Scan Running',
    description: 'Executing delegated command on SSH agent host — please wait.',
    awaiting: '[+] Awaiting Nmap stdout...',
    submitBusy: 'Scan in progress...',
  };
}

export type PkiWaitStageContext = {
  fqdn: string;
  ip: string;
  template: string;
  jumpHost: string;
  jumpName: string;
  winHost: string;
};

export const PKI_WAIT_STAGE_COUNT = 7;

export function buildPkiWaitStageLine(index: number, ctx: PkiWaitStageContext): string | null {
  const ipNote = ctx.ip?.trim() ? ` SAN IP=${ctx.ip.trim()}` : '';
  const jump = ctx.jumpName ? `${ctx.jumpName} (${ctx.jumpHost})` : ctx.jumpHost;
  const stages = [
    `[+] Step 1/${PKI_WAIT_STAGE_COUNT} - SSH to Ubuntu jump host ${jump}. This Linux box does NOT issue the certificate.`,
    `[+] Step 2/${PKI_WAIT_STAGE_COUNT} - On Ubuntu: Python WinRM (pywinrm). PowerShell WSMan is not available on the jump host.`,
    `[+] Step 3/${PKI_WAIT_STAGE_COUNT} - WinRM NTLM to Windows PKI worker ${ctx.winHost}:5985 as hub\\hernano30.`,
    `[+] Step 4/${PKI_WAIT_STAGE_COUNT} - Locate existing Generate-BaxterHubCertificate.ps1 on the worker desktop.`,
    `[+] Step 5/${PKI_WAIT_STAGE_COUNT} - Scheduled Task (batch logon, same token as RDP) so certreq can enroll. CN=${ctx.fqdn}${ipNote} template ${ctx.template}.`,
    `[+] Step 6/${PKI_WAIT_STAGE_COUNT} - ADCS Hub Issuing CA on USDFHUBCAI issues the certificate. This can take 1-3 minutes.`,
    `[+] Step 7/${PKI_WAIT_STAGE_COUNT} - Collect Package_*.zip from the Windows worker and return it to the portal.`,
  ];
  return stages[index] ?? null;
}

export function buildPkiElapsedHeartbeat(elapsedSec: number): string {
  return `[~] ${elapsedSec}s elapsed - Windows PKI worker still running CSR/ADCS. The real log appears when SSH returns (up to ~10 min).`;
}

const TRANSCRIPT_NOISE = /^(Start time:|End time:|Username:|RunAs User:|Configuration Name:|Machine:|Host Application:|Process ID:|PSVersion:|PSEdition:|PSCompatibleVersions:|BuildVersion:|CLRVersion:|WSManStackVersion:|PSRemotingProtocolVersion:|SerializationVersion:)/i;

/** Drop the SSH wrapper, base64 payload, secrets, and PowerShell transcript noise. */
export function sanitizePkiRemoteLogLines(lines: string[]): string[] {
  return lines.filter((raw) => {
    const l = String(raw ?? '').trim();
    if (!l) return false;
    if (l.length > 220 && /^[A-Za-z0-9+/=\s]+$/.test(l)) return false;
    if (l.includes('ZIP_BASE64_START') || l.includes('ZIP_BASE64_END')) return false;
    if (l.startsWith('TMP_FILE=')) return false;
    if (l.startsWith('echo "') || (l.includes('base64 -d') && l.includes('echo'))) return false;
    if (/^bash\s+"\$TMP_FILE"/.test(l)) return false;
    if (/^STATUS=\$\?/.test(l) || /^rm -f "\$TMP_FILE"/.test(l) || /^exit \$STATUS/.test(l)) return false;
    if (l.includes('#< CLIXML') || l.includes('<Objs Version=')) return false;
    if (l.includes('not well-formed (invalid token)')) return false;
    if (l.includes('--- INICIO SALIDA TERMINAL ---') || l.includes('--- FIN SALIDA TERMINAL ---')) return false;
    if (l.includes('--- REMOTE OUTPUT START ---') || l.includes('--- REMOTE OUTPUT END ---')) return false;
    if (l.includes('Windows PowerShell transcript')) return false;
    if (/^\*+$/.test(l)) return false;
    if (TRANSCRIPT_NOISE.test(l)) return false;
    if (l.startsWith('Warning: Permanently added')) return false;
    if (/PKI_WIN_PASS=/.test(l) || /\$winPass\s*=/.test(l) || /\$pass\s*=\s*'/.test(l)) return false;
    if (l.includes('spawn ssh')) return false;
    return true;
  });
}

export type PkiTicketReportInput = {
  issued: boolean;
  ticketId: string;
  fqdn: string;
  sanIp: string;
  template: string;
  jumpName: string;
  jumpHost: string;
  winHost: string;
  winPort: string;
  pfxPassword: string;
  remoteLines: string[];
};

/** Client-facing ticket log: success/failure, which server did what, filtered worker output. ASCII English. */
export function buildPkiClientReport(input: PkiTicketReportInput): string {
  const jump = input.jumpName ? `${input.jumpName} (${input.jumpHost})` : input.jumpHost;
  const worker = `${input.winHost}:${input.winPort || '5985'}`;
  const cleaned = sanitizePkiRemoteLogLines(input.remoteLines);
  const zipLine = cleaned.find((l) => /Package_.*\.zip/i.test(l) && /\[OK\]/.test(l));
  const caLine = cleaned.find((l) => /Certificate issued by/i.test(l) || /issued by/i.test(l));

  const header = input.issued
    ? [
        'RESULT: ISSUED',
        'The certificate was issued. Use Download Certificate ZIP on this ticket.',
      ]
    : [
        'RESULT: FAILED',
        'The certificate was not issued. The jump host or the Windows PKI worker did not return Package_*.zip.',
      ];

  const topology = [
    '',
    'WHERE IT RAN (two different servers):',
    `  1. Jump host (Ubuntu Linux): ${jump}`,
    '     SSH landing box. It does NOT create the certificate. It only forwards the job via WinRM.',
    `  2. PKI worker (Windows ADCS): ${worker} (hostname USDFHUBCAI)`,
    '     Runs Generate-BaxterHubCertificate.ps1 on the desktop and enrolls with Hub Issuing CA.',
    '',
    'REQUEST:',
    `  Ticket: ${input.ticketId}`,
    `  Common Name: ${input.fqdn}`,
    `  SAN IP: ${input.sanIp?.trim() || '(none)'}`,
    `  Template: ${input.template}`,
    input.issued ? `  PFX password: ${input.pfxPassword}` : '',
    zipLine ? `  ${zipLine.replace(/^\[[^\]]+\]\s*/, '')}` : '',
    caLine ? `  ${caLine.replace(/^\[[^\]]+\]\s*/, '')}` : '',
    '',
    'WORKER LOG (secrets and SSH wrapper removed):',
  ].filter((line) => line !== '');

  return [...header, ...topology, ...(cleaned.length ? cleaned : ['no worker log captured'])].join('\n');
}
