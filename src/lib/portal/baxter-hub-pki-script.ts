/**
 * Baxter HUB PKI worker — invoke the desktop Generate-BaxterHubCertificate.ps1
 * instead of rolling certreq INF/CSR logic inline in the client portal.
 *
 * Jump host is Linux (baxtersrv300). PowerShell Core there has no WSMan, so
 * remoting uses Python pywinrm. The desktop script still runs on Windows.
 *
 *   C:\Users\hernano30\Desktop\Certificates Requests\Generate-BaxterHubCertificate.ps1
 */

export const BAXTER_PKI_SCRIPT_DIR =
  'C:\\Users\\hernano30\\Desktop\\Certificates Requests';
export const BAXTER_PKI_SCRIPT_NAME = 'Generate-BaxterHubCertificate.ps1';
export const BAXTER_PKI_SCRIPT_PATH = `${BAXTER_PKI_SCRIPT_DIR}\\${BAXTER_PKI_SCRIPT_NAME}`;
export const BAXTER_PKI_DEFAULT_CA = 'ca01.hub.baxter.com\\HUB-ISSUING-CA';
export const BAXTER_PKI_DEFAULT_HOST = '10.11.240.88';
export const BAXTER_PKI_DEFAULT_USER = 'hub\\hernano30';
export const BAXTER_PKI_DEFAULT_PORT = '5985';
/** WinRM password for the Windows PKI worker (desktop script host). */
export const BAXTER_PKI_DEFAULT_PASSWORD = 'Baxter1234567!';

export type PkiWorkerConfig = {
  host: string;
  port: string;
  username: string;
  password: string;
  caName: string;
  scriptPath: string;
};

export function defaultPkiWorkerConfig(): PkiWorkerConfig {
  return {
    host: BAXTER_PKI_DEFAULT_HOST,
    port: BAXTER_PKI_DEFAULT_PORT,
    username: BAXTER_PKI_DEFAULT_USER,
    password: BAXTER_PKI_DEFAULT_PASSWORD,
    caName: BAXTER_PKI_DEFAULT_CA,
    scriptPath: BAXTER_PKI_SCRIPT_PATH,
  };
}

/** Merge saved portal config with worker defaults so clients can submit without the SOC editor tab. */
export function resolvePkiWorkerConfig(raw: string | null | undefined): PkiWorkerConfig {
  const defaults = defaultPkiWorkerConfig();
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<PkiWorkerConfig>;
    return {
      host: parsed.host || defaults.host,
      port: parsed.port || defaults.port,
      username: parsed.username || defaults.username,
      password: (parsed.password && String(parsed.password).trim()) || defaults.password,
      caName: parsed.caName || defaults.caName,
      scriptPath: parsed.scriptPath || defaults.scriptPath,
    };
  } catch {
    return defaults;
  }
}

export type PkiJumpHostParams = {
  winHost: string;
  winPort: string;
  winUsername: string;
  winPassword: string;
  fqdn: string;
  ip: string;
  template: string;
  caName: string;
  serverName: string;
  pfxPassword: string;
  scriptPath: string;
};

export type PkiVerifyParams = {
  winHost: string;
  winPort: string;
  winUsername: string;
  winPassword: string;
  scriptPath: string;
};

/** Escape a value interpolated into a PowerShell single-quoted string. */
export function escapePsLiteral(value: string): string {
  return String(value ?? '').replace(/'/g, "''");
}

/** Escape a value interpolated into a Bash single-quoted string. */
export function escapeBashSingleQuoted(value: string): string {
  return String(value ?? '').replace(/'/g, `'\\''`);
}

const LINUX_WINRM_PYTHON = `import os, sys, subprocess

def ensure_winrm():
    try:
        import winrm
        return winrm
    except ImportError:
        pass
    print('[+] pywinrm no está en el jump host Linux. Instalando (pwsh/WSMan no existe aquí)...')
    attempts = [
        [sys.executable, '-m', 'pip', 'install', '--user', 'pywinrm'],
        [sys.executable, '-m', 'pip', 'install', '--user', '--break-system-packages', 'pywinrm'],
        ['sudo', sys.executable, '-m', 'pip', 'install', 'pywinrm'],
        ['sudo', 'apt-get', 'install', '-y', 'python3-winrm'],
    ]
    last = None
    for cmd in attempts:
        try:
            subprocess.check_call(cmd)
            import winrm
            return winrm
        except Exception as exc:
            last = exc
    raise SystemExit('[!] No se pudo instalar pywinrm. En baxtersrv300 ejecuta: pip3 install --user pywinrm  (último error: %s)' % last)

def decode(blob):
    if blob is None:
        return ''
    if isinstance(blob, bytes):
        return blob.decode('utf-8', 'replace')
    return str(blob)

winrm = ensure_winrm()
host = os.environ['PKI_WIN_HOST']
port = os.environ.get('PKI_WIN_PORT', '5985')
user = os.environ['PKI_WIN_USER']
password = os.environ['PKI_WIN_PASS']
script = open(os.environ['PKI_WIN_SCRIPT'], encoding='utf-8').read()
endpoint = 'http://%s:%s/wsman' % (host, port)
print('[+] Conectando via WinRM (NTLM) a %s como %s...' % (endpoint, user))
print('[+] Estrategia: Generate-BaxterHubCertificate.ps1 en el escritorio del PKI Worker (no certreq inline, no WSMan/pwsh).')

session = None
last_err = None
for transport in ('ntlm', 'basic'):
    try:
        s = winrm.Session(endpoint, auth=(user, password), transport=transport, server_cert_validation='ignore')
        probe = s.run_cmd('hostname')
        out = decode(probe.std_out).strip()
        err = decode(probe.std_err).strip()
        if probe.status_code == 0 or out:
            print('[✓] WinRM %s OK. Hostname: %s' % (transport, out or err))
            session = s
            break
        last_err = err or ('status %s' % probe.status_code)
        print('[!] Transporte %s no listo: %s' % (transport, last_err))
    except Exception as exc:
        last_err = exc
        print('[!] Transporte %s falló: %s' % (transport, exc))

if session is None:
    raise SystemExit('[!] Error crítico en el Jump Host: WinRM hacia %s:%s falló (%s)' % (host, port, last_err))

print('[+] Invocando script remoto en el worker Windows...')
result = session.run_ps(script)
sys.stdout.write(decode(result.std_out))
sys.stderr.write(decode(result.std_err))
if result.status_code:
    sys.exit(result.status_code)
`;

function buildLinuxWinrmJumpHostScript(
  windowsScript: string,
  p: { winHost: string; winPort: string; winUsername: string; winPassword: string },
): string {
  const host = escapeBashSingleQuoted(p.winHost);
  const port = escapeBashSingleQuoted(String(p.winPort || BAXTER_PKI_DEFAULT_PORT));
  const user = escapeBashSingleQuoted(p.winUsername);
  const pass = escapeBashSingleQuoted(p.winPassword);
  return `set -e
echo "[+] Inicializando orquestador Linux en el Jump Host (pywinrm)."
echo "[+] pwsh Invoke-Command/WSMan no está disponible en Ubuntu; se usa Python WinRM."
WIN_PS="$(mktemp /tmp/pki_win_XXXXXX.ps1)"
trap 'rm -f "$WIN_PS"' EXIT
cat > "$WIN_PS" <<'WINPS'
${windowsScript}
WINPS
export PKI_WIN_HOST='${host}'
export PKI_WIN_PORT='${port}'
export PKI_WIN_USER='${user}'
export PKI_WIN_PASS='${pass}'
export PKI_WIN_SCRIPT="$WIN_PS"
echo "[+] Destino WinRM: $PKI_WIN_HOST:$PKI_WIN_PORT usuario $PKI_WIN_USER"
if ! command -v python3 >/dev/null 2>&1; then
  echo "[!] python3 no está instalado en el jump host." >&2
  exit 1
fi
python3 - <<'PY'
${LINUX_WINRM_PYTHON}
PY
`;
}

function buildWindowsIssueScript(p: PkiJumpHostParams): string {
  const scriptPath = escapePsLiteral(p.scriptPath || BAXTER_PKI_SCRIPT_PATH);
  const scriptDir = escapePsLiteral(BAXTER_PKI_SCRIPT_DIR);
  const fqdn = escapePsLiteral(p.fqdn);
  const ip = escapePsLiteral(p.ip || '');
  const template = escapePsLiteral(p.template);
  const caName = escapePsLiteral(p.caName || '');
  const pass = escapePsLiteral(p.pfxPassword);
  return `$ErrorActionPreference = "Stop"
$scriptPath = '${scriptPath}'
$scriptDir = '${scriptDir}'
$fqdn = '${fqdn}'
$ip = '${ip}'
$template = '${template}'
$caName = '${caName}'
$pass = '${pass}'

Write-Host "[+] Localizando Generate-BaxterHubCertificate.ps1 en el escritorio..."
if (-not $scriptPath -or -not (Test-Path -LiteralPath $scriptPath)) {
  $candidate = Join-Path $scriptDir "Generate-BaxterHubCertificate.ps1"
  if (Test-Path -LiteralPath $candidate) {
    $scriptPath = $candidate
  } else {
    $found = Get-ChildItem -LiteralPath $scriptDir -Filter "*.ps1" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $scriptPath = $found.FullName }
  }
}
if (-not $scriptPath -or -not (Test-Path -LiteralPath $scriptPath)) {
  throw "No se encontró Generate-BaxterHubCertificate.ps1 en el escritorio. Ruta esperada: $scriptDir"
}
Write-Host ("[OK] Script de escritorio: " + $scriptPath)

$outputDir = Split-Path -Parent $scriptPath
if (-not $outputDir) { $outputDir = $scriptDir }
$subject = "CN=$fqdn, O=BaxterHub, C=US"

$argList = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $scriptPath,
  "-SubjectName", $subject,
  "-CertType", "CSR",
  "-TemplateName", $template,
  "-OutputPath", $outputDir,
  "-SubmitToCA",
  "-PrivateKeyPassword", $pass,
  "-ProviderType", "CNG",
  "-KeyLength", "2048",
  "-SubjectAlternativeNames", $fqdn
)
if ($ip -and $ip.Trim() -ne "") {
  $argList += @("-SubjectAlternativeNames", $ip)
}
if ($caName -and $caName.Trim() -ne "") {
  $argList += @("-CAServer", $caName)
}

Write-Host "[+] Ejecutando Generate-BaxterHubCertificate.ps1 (CSR + SubmitToCA). Extraer y formatear Package_*.zip..."
& powershell.exe @argList
if ($LASTEXITCODE -ne 0) {
  throw "Generate-BaxterHubCertificate.ps1 terminó con código $LASTEXITCODE"
}

$zip = Get-ChildItem -LiteralPath $outputDir -Recurse -Filter "Package_*.zip" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $zip) {
  throw "El script de escritorio no dejó Package_*.zip en $outputDir"
}
Write-Host ("[OK] Paquete generado: " + $zip.FullName)

$base64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($zip.FullName))
Write-Output "ZIP_BASE64_START"
Write-Output $base64
Write-Output "ZIP_BASE64_END"
`;
}

function buildWindowsVerifyScript(p: PkiVerifyParams): string {
  const scriptPath = escapePsLiteral(p.scriptPath || BAXTER_PKI_SCRIPT_PATH);
  const scriptDir = escapePsLiteral(BAXTER_PKI_SCRIPT_DIR);
  return `$ErrorActionPreference = "Stop"
$scriptPath = '${scriptPath}'
$scriptDir = '${scriptDir}'
Write-Output "[+] Verificando especificaciones: Generate-BaxterHubCertificate.ps1 en el escritorio (sin emitir certificado)..."
$resolved = $scriptPath
if (-not $resolved -or -not (Test-Path -LiteralPath $resolved)) {
  $candidate = Join-Path $scriptDir "Generate-BaxterHubCertificate.ps1"
  if (Test-Path -LiteralPath $candidate) {
    $resolved = $candidate
  } else {
    $found = Get-ChildItem -LiteralPath $scriptDir -Filter "*.ps1" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { $resolved = $found.FullName }
  }
}
if ($resolved -and (Test-Path -LiteralPath $resolved)) {
  $item = Get-Item -LiteralPath $resolved
  Write-Output ("SCRIPT_PKI_OK=" + $item.FullName)
  Write-Output ("SCRIPT_PKI_SIZE=" + $item.Length)
  Write-Output "CONEXION_WINRM_EXITOSA"
} else {
  Write-Output ("SCRIPT_PKI_MISSING=" + $scriptDir)
  Write-Output "ERROR_WINRM: Generate-BaxterHubCertificate.ps1 no está en el escritorio del PKI Worker"
}
`;
}

/**
 * Jump-host bash+Python (Linux). WinRM via pywinrm — PowerShell Core on Ubuntu
 * has no WSMan client, so Invoke-Command -ComputerName cannot be used.
 */
export function buildPkiIssueJumpHostScript(p: PkiJumpHostParams): string {
  return buildLinuxWinrmJumpHostScript(buildWindowsIssueScript(p), p);
}

/**
 * Jump-host bash+Python that verifies WinRM plus the desktop generator script.
 * Does not issue or submit a certificate (worker is a separate machine).
 */
export function buildPkiVerifyJumpHostScript(p: PkiVerifyParams): string {
  return buildLinuxWinrmJumpHostScript(buildWindowsVerifyScript(p), p);
}

export function usesDesktopCertificateScript(script: string): boolean {
  return (
    script.includes('Generate-BaxterHubCertificate.ps1') &&
    script.includes('Certificates Requests') &&
    script.includes('pywinrm') &&
    !script.includes('Invoke-Command -ComputerName') &&
    !script.includes('[NewRequest]') &&
    !script.includes('certreq -new')
  );
}
