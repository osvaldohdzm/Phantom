<#
.SYNOPSIS
    Generates Certificate Signing Requests (CSRs) or Self-Signed Certificates for the BaxterHub environment.

.DESCRIPTION
    This script is a production-ready certificate management tool. It enforces Administrative privileges at startup.
    It supports creating CSRs (using certreq.exe and .inf files) and Self-Signed Certificates (using New-SelfSignedCertificate).
    It consolidates all cryptographic configurations, template attributes, and output formats (INF, CSR, CER, PFX, PEM)
    required across the BaxterHub infrastructure.

    Unattended ADCS submit (no Certification Authority List GUI):
    certreq.exe is always invoked with -q. CSR generation uses -new -q -f.
    Submit always uses -submit -q -config <CA>. Accept uses -accept -q.
    certreq is NEVER called without -q / -config (that pops the CA picker and hangs WinRM).

    Default CA is the local issuing CA on this worker (USDFHUBCAI), NOT ca01.
    ca01.hub.baxter.com\HUB-ISSUING-CA returns RPC 0x800706ba from this host.
    The enrollment-policy GUI name "Hub Issuing CA (Kerberos)" is NOT a valid -config string.

.PARAMETER SubjectName
    The full Subject Distinguished Name (DN) string. Example: "CN=baxterhub.local, OU=IT, O=BaxterHub, L=City, S=State, C=US".

.PARAMETER SubjectAlternativeNames
    An optional array of strings representing Subject Alternative Names (SANs) - DNS names or IP addresses.

.PARAMETER KeyLength
    The length of the RSA key. Default is 2048. Supported values are 2048 and 4096.

.PARAMETER CertType
    The type of certificate action: "CSR" to generate a certificate signing request, or "SelfSigned" to generate a self-signed certificate.

.PARAMETER ValidMonths
    The validity period of the certificate in months. Default is 24 months.

.PARAMETER OutputPath
    The target directory where generated files will be stored. Defaults to the current working directory (".").

.PARAMETER TemplateName
    Optional Active Directory Certificate Services (ADCS) template name (e.g., "NurseCall", "Hub_WebServer") to embed in the request.

.PARAMETER ProviderType
    Cryptographic provider selection:
    - "CSP" (Default on this worker): Microsoft RSA SChannel Cryptographic Provider. Required here — CNG yields NTE_PROV_TYPE_NOT_DEF (0x80090017) and a certreq GUI.
    - "CNG": Microsoft Software Key Storage Provider (KSP) for modern CNG compatibility.

.PARAMETER NonExportable
    A switch to indicate the private key should be marked as non-exportable. By default, keys are exportable.

.PARAMETER UserKeySet
    A switch to indicate keys should be stored in the Current User store context. Defaults to the Local Machine store context.

.PARAMETER SubmitToCA
    A switch to indicate the script should automatically submit the CSR to the CA and accept/package the certificate (CSR mode only).

.PARAMETER PrivateKeyPassword
    The password used to secure the exported PFX file. Default is "Baxter2026!".

.PARAMETER KeepInStore
    A switch to retain the generated certificate in the local store instead of deleting it after exporting PFX/PEM files.

.EXAMPLE
    # Generate a CSR with SANs using CSP provider for Hub_WebServer template and submit unattended:
    .\Generate-BaxterHubCertificate.ps1 -SubjectName "CN=clientportal.spectre.local, O=BaxterHub, C=US" -SubjectAlternativeNames "clientportal.spectre.local", "1.1.1.1" -TemplateName "Hub_WebServer" -CertType CSR -SubmitToCA -ProviderType CSP

.EXAMPLE
    # Generate a Self-Signed certificate with 4096-bit key length:
    .\Generate-BaxterHubCertificate.ps1 -SubjectName "CN=baxterhub.local, OU=IT, O=BaxterHub" -SubjectAlternativeNames "baxterhub.local", "127.0.0.1" -KeyLength 4096 -CertType SelfSigned
#>

[CmdletBinding()]
Param(
    [Parameter(Mandatory=$true, HelpMessage="Subject DN string, e.g., 'CN=baxterhub.local, OU=IT, O=BaxterHub, L=City, S=State, C=US'")]
    [ValidateNotNullOrEmpty()]
    [string]$SubjectName,

    [Parameter(Mandatory=$false, HelpMessage="Subject Alternative Names (SANs) - array of DNS names or IP addresses")]
    [string[]]$SubjectAlternativeNames,

    [Parameter(Mandatory=$false, HelpMessage="Key Algorithm to use: RSA, ECDSA_P256, ECDSA_P384, ECDSA_P521, ECDH_P256, ECDH_P384, ECDH_P521")]
    [ValidateSet("RSA", "ECDSA_P256", "ECDSA_P384", "ECDSA_P521", "ECDH_P256", "ECDH_P384", "ECDH_P521")]
    [string]$KeyAlgorithm = "RSA",

    [Parameter(Mandatory=$false, HelpMessage="Key Length. For RSA: 2048 or 4096. For ECDSA/ECDH: 256, 384, or 521. Defaults to 2048.")]
    [int]$KeyLength = 2048,

    [Parameter(Mandatory=$false, HelpMessage="Certificate type: CSR or SelfSigned")]
    [ValidateSet("CSR", "SelfSigned")]
    [string]$CertType = "CSR",

    [Parameter(Mandatory=$false, HelpMessage="Validity period in months (for Self-Signed certificates)")]
    [int]$ValidMonths = 24,

    [Parameter(Mandatory=$false, HelpMessage="Output directory where files will be saved")]
    [string]$OutputPath = ".",

    [Parameter(Mandatory=$false, HelpMessage="Certificate Template Name (e.g. NurseCall, Hub_WebServer)")]
    [string]$TemplateName,

    [Parameter(Mandatory=$false, HelpMessage="Cryptographic Provider Type: CSP (legacy SChannel, required on this worker) or CNG (Key Storage Provider)")]
    [ValidateSet("CNG", "CSP")]
    [string]$ProviderType = "CSP",

    [Parameter(Mandatory=$false, HelpMessage="Specify to make the private key non-exportable")]
    [switch]$NonExportable,

    [Parameter(Mandatory=$false, HelpMessage="Use the Current User store context instead of the Local Machine store")]
    [switch]$UserKeySet,

    [Parameter(Mandatory=$false, HelpMessage="Automatically submit the CSR to the CA and accept/package the certificate")]
    [switch]$SubmitToCA,

    [Parameter(Mandatory=$false, HelpMessage="Password used to encrypt the exported PFX file")]
    [string]$PrivateKeyPassword = "Baxter2026!",

    [Parameter(Mandatory=$false, HelpMessage="Keep the generated certificate in the local store instead of cleaning it up")]
    [switch]$KeepInStore,

    [Parameter(Mandatory=$false, HelpMessage="CA config for certreq -config (ComputerName\\CAName). Not the GUI enrollment-policy display name.")]
    [string]$CAServer = "USDFHUBCAI.hub.baxter.com\HUB-ISSUING-CA",

    [Parameter(Mandatory=$false, HelpMessage="Requester Name/Department")]
    [string]$Requester = "Horacio Arellano / Nathan F. Walker (Digital Health)"
)

$ErrorActionPreference = "Stop"

function Get-CaConfigCandidates {
    Param(
        [Parameter(Mandatory=$false)]
        [string]$Requested
    )

    $list = New-Object 'System.Collections.Generic.List[string]'

    function Add-CaConfig([string]$Config) {
        if ([string]::IsNullOrWhiteSpace($Config)) { return }
        # GUI enrollment-policy names like "Hub Issuing CA (Kerberos)" are invalid for certreq -config
        if ($Config -match '[()]') { return }
        if (-not $list.Contains($Config)) {
            [void]$list.Add($Config)
        }
    }

    # Prefer the local issuing CA on this worker. ca01 is RPC-unreachable here
    # (0x800706ba) and would stall 30–60s if tried first.
    $requestedIsRemoteCa01 = $Requested -match '(?i)^ca01[\.\\]'

    if (-not $requestedIsRemoteCa01) {
        Add-CaConfig $Requested
    }
    Add-CaConfig 'USDFHUBCAI.hub.baxter.com\HUB-ISSUING-CA'
    Add-CaConfig "$env:COMPUTERNAME\HUB-ISSUING-CA"
    if (-not [string]::IsNullOrWhiteSpace($env:USERDNSDOMAIN)) {
        Add-CaConfig "$($env:COMPUTERNAME).$($env:USERDNSDOMAIN)\HUB-ISSUING-CA"
    }
    Add-CaConfig 'USDFHUBCAI\HUB-ISSUING-CA'
    Add-CaConfig '.\HUB-ISSUING-CA'
    if ($requestedIsRemoteCa01) {
        Add-CaConfig $Requested
    }

    return $list
}

function Export-CertificateAssets {
    Param(
        [Parameter(Mandatory=$true)]
        $CertObject,
        [Parameter(Mandatory=$true)]
        [string]$TargetFolder,
        [Parameter(Mandatory=$true)]
        [string]$CertName
    )

    try {
        # 1. Standalone Leaf Certificate (.cer)
        $cerFilePath = Join-Path $TargetFolder "$CertName.cer"
        if (Test-Path $cerFilePath) { Remove-Item $cerFilePath -Force }
        Export-Certificate -Cert $CertObject -FilePath $cerFilePath -Type CERT | Out-Null
        Write-Host "[OK] Standalone CER exported: $cerFilePath" -ForegroundColor Green

        # 2. Complete Trust Chain (.pem)
        $pemFilePath = Join-Path $TargetFolder "$($CertName)_fullchain.pem"
        $chain = New-Object -TypeName System.Security.Cryptography.X509Certificates.X509Chain
        $chain.Build($CertObject) | Out-Null
        $pem = ""
        foreach ($element in $chain.ChainElements) {
            $b64 = [System.Convert]::ToBase64String($element.Certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert), 'InsertLineBreaks')
            $pem += "-----BEGIN CERTIFICATE-----`r`n$b64`r`n-----END CERTIFICATE-----`r`n"
        }
        Set-Content -Path $pemFilePath -Value $pem
        Write-Host "[OK] Complete PEM Chain exported: $pemFilePath" -ForegroundColor Green

        # 3. Matching Private Key (.key)
        $keyFilePath = Join-Path $TargetFolder "$($CertName)_private_key.key"
        $privateKeyPem = ""
        if ($CertObject.HasPrivateKey) {
            $keyObj = $null
            if ($KeyAlgorithm -eq "RSA") {
                $keyObj = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($CertObject)
            } else {
                $keyObj = [System.Security.Cryptography.X509Certificates.ECDsaCertificateExtensions]::GetECDsaPrivateKey($CertObject)
            }

            if ($keyObj) {
                $privateKeyBytes = $null
                # Attempt CNG Key export (supported on modern Windows .NET runtimes)
                if ($keyObj.GetType().GetProperty("Key")) {
                    try {
                        $cngKey = $keyObj.Key
                        $privateKeyBytes = $cngKey.Export([System.Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob)
                    } catch {
                        Write-Verbose "CNG Key export failed: $_"
                    }
                }

                # Fallback to direct .NET Core PKCS8 export method if available
                if ($null -eq $privateKeyBytes) {
                    try {
                        $exportMethod = $keyObj.GetType().GetMethod("ExportPkcs8PrivateKey", [type[]]@())
                        if ($exportMethod) {
                            $privateKeyBytes = $exportMethod.Invoke($keyObj, $null)
                        }
                    } catch {}
                }

                # Construct PEM from PKCS#8 bytes
                if ($privateKeyBytes) {
                    $b64 = [System.Convert]::ToBase64String($privateKeyBytes, 'InsertLineBreaks')
                    $privateKeyPem = "-----BEGIN PRIVATE KEY-----`r`n$b64`r`n-----END PRIVATE KEY-----`r`n"
                    Set-Content -Path $keyFilePath -Value $privateKeyPem
                    Write-Host "[OK] Matching Private Key (.key) exported" -ForegroundColor Green
                } else {
                    Write-Warning "Could not extract private key bytes. The private key may be marked as non-exportable."
                }
            }
        }

        # 4. Backup PFX (.pfx)
        $pfxFilePath = Join-Path $TargetFolder "$($CertName)_backup.pfx"
        if (Test-Path $pfxFilePath) { Remove-Item $pfxFilePath -Force }
        $securePass = ConvertTo-SecureString -String $PrivateKeyPassword -Force -AsPlainText
        Export-PfxCertificate -Cert $CertObject.PSPath -FilePath $pfxFilePath -Password $securePass -Force | Out-Null
        Write-Host "[OK] Backup PFX exported: $pfxFilePath" -ForegroundColor Green

        # 5. INSTRUCTIONS.txt
        $deliveryReadmePath = Join-Path $TargetFolder "INSTRUCTIONS.txt"
        $TargetIP = "N/A"
        foreach ($entry in $SanList) {
            if ($entry -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
                $TargetIP = $entry
                break
            }
        }
        $deliveryReadmeContent = @"
BAXTER ENTERPRISE PKI SERVICE - CERTIFICATE DELIVERY
======================================================================
Target FQDN : $CNValue
Target IP   : $TargetIP
CA Server   : $CAServer
Requester   : $Requester

DELIVERABLE ASSETS INCLUDED:
1. $CertName.cer            -> Standalone Leaf Certificate (DER/Base64).
2. $($CertName)_fullchain.pem  -> Complete Trust Chain (Leaf -> Intermediate -> Root).
3. $($CertName)_private_key.key-> Matching $KeyAlgorithm Private Key (PEM format).
4. $($CertName)_backup.pfx     -> PKCS#12 Container (Password: $PrivateKeyPassword).
======================================================================
"@
        Set-Content -Path $deliveryReadmePath -Value $deliveryReadmeContent
        Write-Host "[OK] Delivery instructions created: $deliveryReadmePath" -ForegroundColor Green

        # 6. Delivery ZIP Package (Containing ONLY the requested assets)
        $zipFilePath = Join-Path $TargetFolder "Package_$CertName.zip"
        if (Test-Path $zipFilePath) { Remove-Item $zipFilePath -Force }

        $assetsToZip = @($cerFilePath, $pemFilePath, $deliveryReadmePath)
        if (Test-Path $keyFilePath) { $assetsToZip += $keyFilePath }
        if (Test-Path $pfxFilePath) { $assetsToZip += $pfxFilePath }

        Compress-Archive -Path $assetsToZip -DestinationPath $zipFilePath -Force | Out-Null
        Write-Host "[OK] Final ZIP package created: $zipFilePath" -ForegroundColor Green
    }
    catch {
        Write-Warning "An error occurred during asset export: $_"
        throw $_
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         BaxterHub Certificate Generator Tool             " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Enforce Administrative Privileges
Write-Verbose "Verifying administrative privileges..."
$IsAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdmin) {
    Write-Host "CRITICAL ERROR: This script must be run with Administrative privileges (Run as Administrator)." -ForegroundColor Red
    Write-Host "Please open a PowerShell terminal as Administrator and execute the script again." -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
    Exit 1
}
Write-Verbose "Administrative privileges verified successfully."

# 1.1 Key Algorithm & Key Length Validation
# Handle key length defaults for ECC if the user didn't explicitly override it or passed the default RSA length
if ($KeyAlgorithm -match '256$') {
    if ($KeyLength -eq 2048) { $KeyLength = 256 }
}
elseif ($KeyAlgorithm -match '384$') {
    if ($KeyLength -eq 2048) { $KeyLength = 384 }
}
elseif ($KeyAlgorithm -match '521$') {
    if ($KeyLength -eq 2048) { $KeyLength = 521 }
}

if ($KeyAlgorithm -eq "RSA") {
    if ($KeyLength -ne 2048 -and $KeyLength -ne 4096) {
        Write-Host "CRITICAL ERROR: For RSA algorithm, KeyLength must be either 2048 or 4096. Received: $KeyLength" -ForegroundColor Red
        Exit 1
    }
} else {
    $validEccLengths = @(256, 384, 521)
    if ($validEccLengths -notcontains $KeyLength) {
        Write-Host "CRITICAL ERROR: For ECDSA/ECDH algorithms, KeyLength must be one of: 256, 384, or 521. Received: $KeyLength" -ForegroundColor Red
        Exit 1
    }
}

if ($ProviderType -eq "CSP" -and $KeyAlgorithm -ne "RSA") {
    Write-Host "CRITICAL ERROR: ProviderType 'CSP' (SChannel) only supports 'RSA' key algorithm. Use 'CNG' for ECDSA/ECDH." -ForegroundColor Red
    Exit 1
}

# 2. Output Directory Preparation
$OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
if (-not (Test-Path $OutputPath)) {
    Write-Verbose "Creating output directory: $OutputPath"
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
} else {
    Write-Verbose "Output directory exists: $OutputPath"
}

# 3. Subject parsing & Base name sanitization
$CNValue = ""
if ($SubjectName -match '(?i)CN\s*=\s*([^,]+)') {
    $CNValue = $Matches[1].Trim()
    Write-Verbose "Extracted Common Name (CN): $CNValue"
} else {
    Write-Warning "Common Name (CN) could not be extracted from Subject DN. Sanitizing full string as CN."
    $CNValue = $SubjectName -replace '[^\w\.\-]', '_'
}

# Extract the short hostname (first segment) as the base filename for deliverables
$BaseName = $CNValue.Split('.')[0]
$SanitizedCertName = $BaseName -replace '\*', 'wildcard'
$SanitizedCertName = $SanitizedCertName -replace '[\\\/\:\*\?\"<>\|]', '_'
Write-Verbose "Base filename for artifacts: $SanitizedCertName"

# 4. SAN List Construction
$SanList = [System.Collections.Generic.List[string]]::new()
if (-not [string]::IsNullOrEmpty($CNValue)) {
    $SanList.Add($CNValue)
}
if ($SubjectAlternativeNames) {
    foreach ($san in $SubjectAlternativeNames) {
        if (-not $SanList.Contains($san)) {
            $SanList.Add($san)
        }
    }
}

# Formatting SANs for certreq .inf syntax (dns=...&ipaddress=...)
$sanParts = @()
foreach ($entry in $SanList) {
    # Check if the entry is an IPv4 address
    if ($entry -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
        $sanParts += "ipaddress=$entry"
    } else {
        $sanParts += "dns=$entry"
    }
}
$SanString = $sanParts -join "&"

# 5. Create Timestamped Subdirectory for this Certificate (using the full sanitized FQDN)
$FolderTimestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$SanitizedFolderName = $CNValue -replace '\*', 'wildcard'
$SanitizedFolderName = $SanitizedFolderName -replace '[\\\/\:\*\?\"<>\|]', '_'
$TargetDir = Join-Path $OutputPath "$($FolderTimestamp)_$($SanitizedFolderName)"
if (-not (Test-Path $TargetDir)) {
    Write-Verbose "Creating target subdirectory: $TargetDir"
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# 5.1 Output Path Bindings
$infPath = Join-Path $TargetDir "$SanitizedCertName.inf"
$csrPath = Join-Path $TargetDir "$SanitizedCertName.csr"
$cerPath = Join-Path $TargetDir "$SanitizedCertName.cer"
$pfxPath = Join-Path $TargetDir "$($SanitizedCertName)_backup.pfx"
$keyPath = Join-Path $TargetDir "$($SanitizedCertName)_private_key.key"
$zipPath = Join-Path $TargetDir "Package_$($SanitizedCertName).zip"
$pemPath = Join-Path $TargetDir "$($SanitizedCertName)_fullchain.pem"
$instructionsPath = Join-Path $TargetDir "$($SanitizedCertName)_Private_Key_Instructions.txt"
$summaryPath = Join-Path $TargetDir "$($SanitizedCertName)_summary.txt"

# 6. Execute based on CertType
try {
    if ($CertType -eq "CSR") {
        Write-Host ">>> MODE: CSR (Certificate Signing Request) Generation" -ForegroundColor Yellow
        Write-Host "Creating INF file at: $infPath" -ForegroundColor Gray

        $ExportableVal = if ($NonExportable) { "FALSE" } else { "TRUE" }
        $MachineKeySetVal = if ($UserKeySet) { "FALSE" } else { "TRUE" }

        # Build INF contents
        $infContent = @"
[NewRequest]
Subject = "$SubjectName"
Exportable = $ExportableVal
KeyAlgorithm = $KeyAlgorithm
KeyLength = $KeyLength
MachineKeySet = $MachineKeySetVal
RequestType = PKCS10
"@

        if ($ProviderType -eq "CNG") {
            $infContent += "`r`nProviderName = `"Microsoft Software Key Storage Provider`""
            $infContent += "`r`nHashAlgorithm = SHA256"
        } else {
            $infContent += "`r`nProviderName = `"Microsoft RSA SChannel Cryptographic Provider`""
            $infContent += "`r`nProviderType = 12"
            $infContent += "`r`nKeySpec = 1"
        }

        # Add EKUs for Server & Client Authentication (Standard dual-use)
        $infContent += @"


[EnhancedKeyUsageExtension]
OID=1.3.6.1.5.5.7.3.1 ; Server Authentication
OID=1.3.6.1.5.5.7.3.2 ; Client Authentication
"@

        # Add SANs and Key Usage (2.5.29.15)
        $KeyUsageHex = if ($KeyAlgorithm -eq "RSA") { "03,02,05,A0" } else { "03,02,05,C0" }
        if ($SanString) {
            $infContent += @"


[Extensions]
2.5.29.17 = "{text}$SanString"
2.5.29.15 = "{critical}{hex}$KeyUsageHex"
"@
        } else {
            $infContent += @"


[Extensions]
2.5.29.15 = "{critical}{hex}$KeyUsageHex"
"@
        }

        # Add Template if provided
        if ($TemplateName) {
            $infContent += @"


[RequestAttributes]
CertificateTemplate = "$TemplateName"
"@
        }

        [System.IO.File]::WriteAllText($infPath, $infContent, [System.Text.Encoding]::ASCII)

        Write-Host "Running certreq.exe to generate CSR..." -ForegroundColor Gray
        if (Test-Path $csrPath) { Remove-Item $csrPath -Force }

        $certreqOutput = & certreq.exe -new -q -f "$infPath" "$csrPath" 2>&1
        if (Test-Path $csrPath) {
            Write-Host "[OK] CSR successfully generated: $csrPath" -ForegroundColor Green
        } else {
            throw "certreq.exe execution failed to generate CSR. Details: $certreqOutput"
        }

        # Write private key handling instructions
        $storeContextStr = if ($UserKeySet) { "CurrentUser" } else { "LocalMachine" }
        $instructionsContent = @"
PRIVATE KEY STORAGE & ENROLLMENT INSTRUCTIONS
================================================================================
Subject Name : $SubjectName
Key Length   : $KeyLength
Provider Type: $ProviderType
Key Context  : $(if ($UserKeySet) { "Current User Store" } else { "Local Machine Store" })
Exportable   : $(if ($NonExportable) { "FALSE" } else { "TRUE" })

The private key was securely created and is stored within the Windows KSP/CSP.
It is linked to the pending request session.

HOW TO IMPORT THE SIGNED CERTIFICATE:
1. Submit '$SanitizedCertName.csr' to your Certificate Authority (CA).
2. Once the CA issues the certificate (e.g., cert.cer), copy it to this machine.
3. Install the certificate to bind it with the private key:
   certreq -accept -q cert.cer
4. Once accepted, locate the certificate's Thumbprint in your store:
   Get-ChildItem Cert:\$storeContextStr\My
5. (Optional) Export the certificate with the private key to a PFX file:
   Export-PfxCertificate -Cert Cert:\$storeContextStr\My\<Thumbprint> -FilePath $SanitizedCertName.pfx -Password (ConvertTo-SecureString -String "$PrivateKeyPassword" -Force -AsPlainText)
================================================================================
"@
        Set-Content -Path $instructionsPath -Value $instructionsContent
        Write-Host "[OK] Instructions file created: $instructionsPath" -ForegroundColor Green

        # 6a. Submit to CA Option — always -q -config, never the CA picker
        if ($SubmitToCA) {
            Write-Host "Submitting CSR to CA (unattended: certreq -submit -q -config)..." -ForegroundColor Yellow
            $attribs = @()
            if ($TemplateName) {
                $attribs += "CertificateTemplate:$TemplateName"
            }
            $attribString = $attribs -join "`n"

            $caCandidates = Get-CaConfigCandidates -Requested $CAServer
            Write-Host "CA configs to try: $($caCandidates -join ' | ')" -ForegroundColor Gray

            $issued = $false
            $submitLog = New-Object 'System.Collections.Generic.List[string]'

            foreach ($cfg in $caCandidates) {
                if (Test-Path $cerPath) { Remove-Item $cerPath -Force }
                Write-Host "Trying certreq -submit -q -config `"$cfg`" ..." -ForegroundColor Gray

                try {
                    if ($attribString) {
                        $submitOutput = & certreq.exe -submit -q -config $cfg -attrib $attribString $csrPath $cerPath 2>&1
                    } else {
                        $submitOutput = & certreq.exe -submit -q -config $cfg $csrPath $cerPath 2>&1
                    }
                } catch {
                    $submitOutput = $_
                }

                $submitText = ($submitOutput | Out-String).Trim()
                [void]$submitLog.Add("[$cfg] $submitText")

                if (Test-Path $cerPath) {
                    Write-Host "[OK] Certificate issued by $cfg and saved: $cerPath" -ForegroundColor Green
                    $CAServer = $cfg
                    $issued = $true
                    break
                }

                Write-Warning "CA config '$cfg' did not return a certificate. ($submitText)"
            }

            if ($issued) {
                Write-Host "Accepting certificate into local store..." -ForegroundColor Gray
                $acceptOutput = & certreq.exe -accept -q "$cerPath" 2>&1 | Out-String
                Start-Sleep -Seconds 2

                # Find the imported certificate
                $importedCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2
                $importedCert.Import($cerPath)
                $thumbprint = $importedCert.Thumbprint

                $storeLocation = if ($UserKeySet) { "Cert:\CurrentUser\My" } else { "Cert:\LocalMachine\My" }
                $cert = Get-ChildItem -Path $storeLocation | Where-Object { $_.Thumbprint -eq $thumbprint } | Select-Object -First 1

                if ($cert) {
                    Write-Host "Certificate verified in store. Exporting deliverables..." -ForegroundColor Gray
                    Export-CertificateAssets -CertObject $cert -TargetFolder $TargetDir -CertName $SanitizedCertName

                    # Cleanup from store if KeepInStore is not requested
                    if (-not $KeepInStore) {
                        Write-Host "Cleaning up certificate from local store (KeepInStore is false)..." -ForegroundColor Gray
                        Remove-Item $cert.PSPath -Force | Out-Null
                    }
                } else {
                    Write-Warning "Could not find the certificate with thumbprint '$thumbprint' in '$storeLocation'. Accept output: $acceptOutput"
                }
            } else {
                Write-Warning "CA did not return an issued certificate automatically. Tried: $($caCandidates -join ' | '). (Submit Output: $($submitLog -join ' || '))"
            }
        }
    }
    elseif ($CertType -eq "SelfSigned") {
        Write-Host ">>> MODE: Self-Signed Certificate Generation" -ForegroundColor Yellow

        $dnsNames = $SanList
        $storeLocation = if ($UserKeySet) { "Cert:\CurrentUser\My" } else { "Cert:\LocalMachine\My" }

        # Setup parameters
        $SelfSignedParams = @{
            Subject           = $SubjectName
            DnsName           = $dnsNames
            KeyLength         = $KeyLength
            KeyAlgorithm      = $KeyAlgorithm
            NotAfter          = (Get-Date).AddMonths($ValidMonths)
            CertStoreLocation = $storeLocation
            TextExtension     = @("2.5.29.37={text}1.3.6.1.5.5.7.3.1,1.3.6.1.5.5.7.3.2")
        }

        if ($KeyAlgorithm -eq "RSA") {
            $SelfSignedParams.Add("KeyUsage", @("DigitalSignature", "KeyEncipherment"))
        } else {
            $SelfSignedParams.Add("KeyUsage", @("DigitalSignature", "NonRepudiation"))
        }

        # Key Exportability
        if ($NonExportable) {
            $SelfSignedParams.Add("KeyExportPolicy", "NotExportable")
        } else {
            $SelfSignedParams.Add("KeyExportPolicy", "Exportable")
        }

        # Key Provider
        if ($ProviderType -eq "CNG") {
            $SelfSignedParams.Add("Provider", "Microsoft Software Key Storage Provider")
        } else {
            $SelfSignedParams.Add("Provider", "Microsoft RSA SChannel Cryptographic Provider")
        }

        Write-Host "Generating self-signed certificate using New-SelfSignedCertificate..." -ForegroundColor Gray
        $cert = New-SelfSignedCertificate @SelfSignedParams

        if ($cert) {
            Write-Host "[OK] Certificate created in store: $($cert.PSPath)" -ForegroundColor Green
            Export-CertificateAssets -CertObject $cert -TargetFolder $TargetDir -CertName $SanitizedCertName

            # Cleanup from store if KeepInStore is not requested
            if (-not $KeepInStore) {
                Write-Host "Cleaning up certificate from local store (KeepInStore is false)..." -ForegroundColor Gray
                Remove-Item $cert.PSPath -Force | Out-Null
            }
        } else {
            throw "Failed to generate self-signed certificate."
        }
    }

    # 7. Write Summary Log
    $summaryContent = @"
================================================================================
BAXTERHUB CERTIFICATE OPERATION SUMMARY
================================================================================
Timestamp        : $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Certificate Type : $CertType
Subject Name     : $SubjectName
Common Name      : $CNValue
Key Length       : $KeyLength
Provider Type    : $ProviderType
Store Location   : $(if ($UserKeySet) { "Current User" } else { "Local Machine" })
Key Exportable   : $(if ($NonExportable) { "FALSE" } else { "TRUE" })
CA Server        : $CAServer

Subject Alternative Names (SANs):
$(foreach ($san in $SanList) { "  - $san" })

Generated Artifacts:
$(if (Test-Path $infPath) { "  [INF Configuration] $infPath" })
$(if (Test-Path $csrPath) { "  [CSR Request]       $csrPath" })
$(if (Test-Path $cerPath) { "  [CER Certificate]   $cerPath" })
$(if (Test-Path $pemPath) { "  [PEM Chain]         $pemPath" })
$(if (Test-Path $keyPath) { "  [PEM Private Key]   $keyPath" })
$(if (Test-Path $pfxPath) { "  [PFX Backup Bundle] $pfxPath" })
$(if (Test-Path $zipPath) { "  [ZIP Delivery Package] $zipPath" })
$(if (Test-Path $instructionsPath) { "  [CSR Instructions]  $instructionsPath" })
$(if (Test-Path (Join-Path $TargetDir "INSTRUCTIONS.txt")) { "  [Delivery README]   $(Join-Path $TargetDir "INSTRUCTIONS.txt")" })
================================================================================
"@
    Set-Content -Path $summaryPath -Value $summaryContent
    Write-Host "[OK] Summary report written: $summaryPath" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "             Certificate Operation Completed              " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Cyan

} catch {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "CRITICAL EXCEPTION OCCURRED DURING RUNTIME" -ForegroundColor Red
    Write-Host "Details: $_" -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
    Exit 1
}
