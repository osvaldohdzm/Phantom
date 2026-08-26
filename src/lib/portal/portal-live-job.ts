export type PortalLiveJobKind = 'pki' | 'flame' | 'nmap';

export function detectPortalLiveJobKind(ticketType: string): PortalLiveJobKind {
  const t = ticketType || '';
  const lower = t.toLowerCase();
  if (lower.includes('certificado') || lower.includes('pki') || lower.includes('certreq')) return 'pki';
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
      title: 'Emisión de certificado PKI en curso',
      description:
        'No es Nmap. Portal → SSH jump host Linux → WinRM al PKI Worker Windows → Generate-BaxterHubCertificate.ps1 (ADCS).',
      awaiting:
        '[~] Esperando WinRM + ADCS. El portal no hace streaming: el log real llega cuando SSH termina (hasta ~10 min).',
      submitBusy: 'Generando certificado…',
    };
  }
  if (kind === 'flame') {
    return {
      title: 'Flamethrower en curso',
      description: 'Prueba de carga DNS / estrés en el agente SSH.',
      awaiting: '[~] Esperando stdout de Flamethrower...',
      submitBusy: 'Ejecutando Flamethrower…',
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
  winHost: string;
};

export const PKI_WAIT_STAGE_COUNT = 7;

export function buildPkiWaitStageLine(index: number, ctx: PkiWaitStageContext): string | null {
  const ipNote = ctx.ip?.trim() ? ` SAN IP=${ctx.ip.trim()}` : '';
  const stages = [
    `[+] Paso 1/${PKI_WAIT_STAGE_COUNT} — SSH al jump host ${ctx.jumpHost} (esto NO es un escaneo Nmap).`,
    `[+] Paso 2/${PKI_WAIT_STAGE_COUNT} — En Ubuntu: Python WinRM (pywinrm). pwsh/WSMan no existe en el jump host.`,
    `[+] Paso 3/${PKI_WAIT_STAGE_COUNT} — WinRM NTLM a ${ctx.winHost}:5985 como hub\\hernano30.`,
    `[+] Paso 4/${PKI_WAIT_STAGE_COUNT} — Localizar Generate-BaxterHubCertificate.ps1 en el escritorio del worker.`,
    `[+] Paso 5/${PKI_WAIT_STAGE_COUNT} — CSR + SubmitToCA. CN=${ctx.fqdn}${ipNote} plantilla ${ctx.template}.`,
    `[+] Paso 6/${PKI_WAIT_STAGE_COUNT} — ADCS (ca01 HUB-ISSUING-CA) emite el certificado. Puede tardar 1–3 minutos.`,
    `[+] Paso 7/${PKI_WAIT_STAGE_COUNT} — Extraer Package_*.zip y devolverlo al portal.`,
  ];
  return stages[index] ?? null;
}

export function buildPkiElapsedHeartbeat(elapsedSec: number): string {
  return `[~] ${elapsedSec}s transcurridos — el worker Windows sigue en CSR/ADCS. El log real aparece cuando SSH termina (hasta ~10 min).`;
}

/** Drop the base64 payload, CLIXML dump, and the jump-host wrapper so the UI stays readable. */
export function sanitizePkiRemoteLogLines(lines: string[]): string[] {
  return lines.filter((raw) => {
    const l = String(raw ?? '').trim();
    if (!l) return false;
    if (l.length > 400 && /^[A-Za-z0-9+/=\s]+$/.test(l)) return false;
    if (l.includes('ZIP_BASE64_START') || l.includes('ZIP_BASE64_END')) return false;
    if (l.startsWith('TMP_FILE=')) return false;
    if (l.includes('base64 -d') && l.includes('echo "')) return false;
    if (l.includes('#< CLIXML') || l.includes('<Objs Version=')) return false;
    if (l.includes('not well-formed (invalid token)')) return false;
    return true;
  });
}
