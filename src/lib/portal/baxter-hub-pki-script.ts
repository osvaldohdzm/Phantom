/**
 * Baxter HUB PKI worker — invoke the desktop Generate-BaxterHubCertificate.ps1
 * instead of rolling certreq INF/CSR logic inline in the client portal.
 *
 * The production script lives on the Windows PKI worker:
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

function powershellOnJumpHost(innerScript: string): string {
  return innerScript;
}

/**
 * Jump-host pwsh that WinRM-invokes the desktop BaxterHub certificate script
 * on the Windows worker, then returns the generated Package_*.zip as base64.
 */
export function buildPkiIssueJumpHostScript(p: PkiJumpHostParams): string {
  const scriptPath = p.scriptPath || BAXTER_PKI_SCRIPT_PATH;
  const scriptDir = BAXTER_PKI_SCRIPT_DIR;

  return powershellOnJumpHost(`
          try {
            Write-Host '[+] Inicializando orquestador local en el Jump Host...'
            Write-Host '[+] Estrategia: Generate-BaxterHubCertificate.ps1 en el escritorio del PKI Worker (no certreq inline).'
            Write-Host '[+] Construyendo credenciales de dominio para ${p.winUsername}...'
            \$secpw = ConvertTo-SecureString '${p.winPassword}' -AsPlainText -Force
            \$cred = New-Object System.Management.Automation.PSCredential ('${p.winUsername}', \$secpw)

            Write-Host '[+] Realizando diagnóstico preliminar en el Worker Windows...'
            try {
              \$winWhoami = Invoke-Command -ComputerName ${p.winHost} -Port ${p.winPort} -Credential \$cred -ScriptBlock { whoami } -ErrorAction Stop
              \$winHostname = Invoke-Command -ComputerName ${p.winHost} -Port ${p.winPort} -Credential \$cred -ScriptBlock { hostname } -ErrorAction Stop
              Write-Host ("  -> Diagnóstico exitoso. Usuario WinRM: " + \$winWhoami + ", Hostname: " + \$winHostname)
            } catch {
              Write-Warning ("[!] Diagnóstico fallido: " + \$_.Exception.Message + ". Intentando continuar...")
            }

            \$scriptBlock = {
              param(\$fqdn, \$ip, \$template, \$caName, \$serverName, \$pass, \$scriptPath, \$scriptDir)
              \$ErrorActionPreference = "Stop"

              Write-Host "[+] Localizando Generate-BaxterHubCertificate.ps1 en el escritorio..."
              if (-not \$scriptPath -or -not (Test-Path -LiteralPath \$scriptPath)) {
                \$candidate = Join-Path \$scriptDir "Generate-BaxterHubCertificate.ps1"
                if (Test-Path -LiteralPath \$candidate) {
                  \$scriptPath = \$candidate
                } else {
                  \$found = Get-ChildItem -LiteralPath \$scriptDir -Filter "*.ps1" -ErrorAction SilentlyContinue | Select-Object -First 1
                  if (\$found) { \$scriptPath = \$found.FullName }
                }
              }
              if (-not \$scriptPath -or -not (Test-Path -LiteralPath \$scriptPath)) {
                throw "No se encontró Generate-BaxterHubCertificate.ps1 en el escritorio. Ruta esperada: \$scriptDir"
              }
              Write-Host ("[OK] Script de escritorio: " + \$scriptPath)

              \$outputDir = Split-Path -Parent \$scriptPath
              if (-not \$outputDir) { \$outputDir = \$scriptDir }
              \$subject = "CN=\$fqdn, O=BaxterHub, C=US"

              \$argList = @(
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", \$scriptPath,
                "-SubjectName", \$subject,
                "-CertType", "CSR",
                "-TemplateName", \$template,
                "-OutputPath", \$outputDir,
                "-SubmitToCA",
                "-PrivateKeyPassword", \$pass,
                "-ProviderType", "CNG",
                "-KeyLength", "2048",
                "-SubjectAlternativeNames", \$fqdn
              )
              if (\$ip -and \$ip.Trim() -ne "") {
                \$argList += @("-SubjectAlternativeNames", \$ip)
              }
              if (\$caName -and \$caName.Trim() -ne "") {
                \$argList += @("-CAServer", \$caName)
              }

              Write-Host "[+] Ejecutando Generate-BaxterHubCertificate.ps1 (CSR + SubmitToCA). Extraer y formatear Package_*.zip..."
              & powershell.exe @argList
              if (\$LASTEXITCODE -ne 0) {
                throw "Generate-BaxterHubCertificate.ps1 terminó con código \$LASTEXITCODE"
              }

              \$zip = Get-ChildItem -LiteralPath \$outputDir -Recurse -Filter "Package_*.zip" -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
              if (-not \$zip) {
                throw "El script de escritorio no dejó Package_*.zip en \$outputDir"
              }
              Write-Host ("[OK] Paquete generado: " + \$zip.FullName)

              \$base64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes(\$zip.FullName))
              Write-Output "ZIP_BASE64_START"
              Write-Output \$base64
              Write-Output "ZIP_BASE64_END"
            };

            Write-Host '[+] Conectando via WinRM al worker ${p.winHost}...'
            Write-Host '[+] Invocando script de escritorio: ${scriptPath}'
            \$res = Invoke-Command -ComputerName ${p.winHost} -Port ${p.winPort} -Credential \$cred -ScriptBlock \$scriptBlock -ArgumentList '${p.fqdn}', '${p.ip}', '${p.template}', '${p.caName}', '${p.serverName}', '${p.pfxPassword}', '${scriptPath}', '${scriptDir}' -ErrorAction Stop
            Write-Host '[✓] Ejecución remota completada exitosamente.'
            Write-Output \$res
          } catch {
            Write-Error ("[!] Error crítico en el Jump Host: " + \$_)
          }
  `);
}

/**
 * Jump-host pwsh that verifies WinRM plus the desktop generator script.
 * Does not issue or submit a certificate (worker is a separate machine).
 */
export function buildPkiVerifyJumpHostScript(p: PkiVerifyParams): string {
  const scriptPath = p.scriptPath || BAXTER_PKI_SCRIPT_PATH;
  const scriptDir = BAXTER_PKI_SCRIPT_DIR;

  return powershellOnJumpHost(`
                              try {
                                Write-Output '[+] Comprobando credenciales para ${p.winUsername}...'
                                \$secpw = ConvertTo-SecureString '${p.winPassword}' -AsPlainText -Force
                                \$cred = New-Object System.Management.Automation.PSCredential ('${p.winUsername}', \$secpw)

                                Write-Output '[+] Realizando diagnóstico preliminar (whoami & hostname)...'
                                \$winWhoami = Invoke-Command -ComputerName ${p.winHost} -Port ${p.winPort} -Credential \$cred -ScriptBlock { whoami } -ErrorAction Stop
                                \$winHostname = Invoke-Command -ComputerName ${p.winHost} -Port ${p.winPort} -Credential \$cred -ScriptBlock { hostname } -ErrorAction Stop
                                Write-Output ("  -> Usuario WinRM: " + \$winWhoami)
                                Write-Output ("  -> Hostname WinRM: " + \$winHostname)

                                Write-Output '[+] Verificando especificaciones: Generate-BaxterHubCertificate.ps1 en el escritorio (sin emitir certificado)...'
                                \$verifyBlock = {
                                  param(\$scriptPath, \$scriptDir)
                                  \$resolved = \$scriptPath
                                  if (-not \$resolved -or -not (Test-Path -LiteralPath \$resolved)) {
                                    \$candidate = Join-Path \$scriptDir "Generate-BaxterHubCertificate.ps1"
                                    if (Test-Path -LiteralPath \$candidate) {
                                      \$resolved = \$candidate
                                    } else {
                                      \$found = Get-ChildItem -LiteralPath \$scriptDir -Filter "*.ps1" -ErrorAction SilentlyContinue | Select-Object -First 1
                                      if (\$found) { \$resolved = \$found.FullName }
                                    }
                                  }
                                  if (\$resolved -and (Test-Path -LiteralPath \$resolved)) {
                                    \$item = Get-Item -LiteralPath \$resolved
                                    Write-Output ("SCRIPT_PKI_OK=" + \$item.FullName)
                                    Write-Output ("SCRIPT_PKI_SIZE=" + \$item.Length)
                                    Write-Output 'CONEXION_WINRM_EXITOSA'
                                  } else {
                                    Write-Output ("SCRIPT_PKI_MISSING=" + \$scriptDir)
                                    Write-Output 'ERROR_WINRM: Generate-BaxterHubCertificate.ps1 no está en el escritorio del PKI Worker'
                                  }
                                }
                                \$res = Invoke-Command -ComputerName ${p.winHost} -Port ${p.winPort} -Credential \$cred -ScriptBlock \$verifyBlock -ArgumentList '${scriptPath}', '${scriptDir}' -ErrorAction Stop
                                Write-Output \$res
                              } catch {
                                Write-Output ("ERROR_WINRM: " + \$_.Exception.Message)
                              }
  `);
}

export function usesDesktopCertificateScript(script: string): boolean {
  return (
    script.includes('Generate-BaxterHubCertificate.ps1') &&
    script.includes('Certificates Requests') &&
    !script.includes('[NewRequest]') &&
    !script.includes('certreq -new')
  );
}
