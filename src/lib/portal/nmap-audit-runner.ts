/**
 * Intelligent Multi-Stage Nmap Service Enumeration & Vulnerability Audit Runner.
 * 
 * Orchestrates a structured 4-stage network and service security assessment:
 * 1. Rapid Open Port Discovery (adaptive min-rate, e.g. 1500 pkts/s)
 * 2. Service & Version Detection on detected open ports
 * 3. Intelligent Service Enumeration (targeted NSE scripts for SSH, HTTP/HTTPS, SMB, etc.)
 *    with evaluation and alerting of obsolete/weak ciphers and algorithms in red/orange.
 * 4. Core Vulnerability Assessment (vulners, vuln scripts)
 */

export interface SshSecurityEvaluation {
  hasObsoleteKex: boolean;
  hasObsoleteCiphers: boolean;
  hasWeakMacs: boolean;
  hasSshv1: boolean;
  findings: string[];
  recommendations: string[];
}

export function evaluateSshAlgorithms(output: string): SshSecurityEvaluation {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const lower = output.toLowerCase();

  const obsoleteKexPatterns = [
    'diffie-hellman-group1-sha1',
    'diffie-hellman-group14-sha1',
    'diffie-hellman-group-exchange-sha1',
    'gss-group1-sha1-',
  ];
  const foundKex = obsoleteKexPatterns.filter((kex) => lower.includes(kex));
  const hasObsoleteKex = foundKex.length > 0;
  if (hasObsoleteKex) {
    findings.push(
      `[!] OBSOLETE KEY EXCHANGE DETECTED: ${foundKex.join(', ')} — SHA-1 based KEX vulnerable to collision and Logjam attacks.`,
    );
    recommendations.push(
      'Enforce modern key exchange algorithms: curve25519-sha256, diffie-hellman-group16-sha512 in /etc/ssh/sshd_config.',
    );
  }

  const obsoleteCipherPatterns = [
    '3des-cbc',
    'arcfour',
    'arcfour128',
    'arcfour256',
    'blowfish-cbc',
    'cast128-cbc',
    'aes128-cbc',
    'aes192-cbc',
    'aes256-cbc',
    'rijndael-cbc',
  ];
  const foundCiphers = obsoleteCipherPatterns.filter((c) => lower.includes(c));
  const hasObsoleteCiphers = foundCiphers.length > 0;
  if (hasObsoleteCiphers) {
    findings.push(
      `[!] OBSOLETE / WEAK CIPHER DETECTED: ${foundCiphers.join(', ')} — CBC-mode and legacy ciphers susceptible to plaintext recovery (CVE-2008-5161).`,
    );
    recommendations.push(
      'Disable CBC and legacy stream ciphers. Enforce chacha20-poly1305@openssh.com and aes256-gcm@openssh.com.',
    );
  }

  const weakMacPatterns = [
    'hmac-md5',
    'hmac-md5-96',
    'hmac-sha1-96',
    'hmac-md5-etm',
  ];
  const foundMacs = weakMacPatterns.filter((m) => lower.includes(m));
  const hasWeakMacs = foundMacs.length > 0;
  if (hasWeakMacs) {
    findings.push(
      `[!] WEAK MAC ALGORITHM DETECTED: ${foundMacs.join(', ')} — MD5 and truncated 96-bit MACs are cryptographically obsolete.`,
    );
    recommendations.push(
      'Enforce Encrypt-then-MAC (ETM) algorithms: hmac-sha2-512-etm@openssh.com, hmac-sha2-256-etm@openssh.com.',
    );
  }

  const hasSshv1 = lower.includes('sshv1') && !lower.includes('not offered') && !lower.includes('disabled');
  if (hasSshv1) {
    findings.push(
      `[!] CRITICAL: SSH protocol version 1 (SSHv1) supported! Susceptible to Man-in-the-Middle and CRC32 attacks.`,
    );
    recommendations.push("Enforce 'Protocol 2' only in sshd_config.");
  }

  return {
    hasObsoleteKex,
    hasObsoleteCiphers,
    hasWeakMacs,
    hasSshv1,
    findings,
    recommendations,
  };
}

/**
 * Builds an intelligent multi-stage bash script for executing on the remote SSH agent.
 */
export function buildIntelligentNmapAuditScript(target: string, minRate = 1500): string {
  const safeTarget = target.replace(/[^a-zA-Z0-9.-]/g, '');
  const rate = Math.max(minRate, 500);

  return `#!/usr/bin/env bash
TARGET="${safeTarget}"
MIN_RATE=${rate}

echo "================================================================================"
echo "PHANTOM SEC-OPS / BAXTER HUB — INTELLIGENT MULTI-STAGE NETWORK AUDIT"
echo "Target Scope   : \${TARGET}"
echo "Execution Time : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Engine Mode    : Adaptive Multi-Stage Nmap NSE Service Auditor"
echo "================================================================================"
echo ""

# STAGE 1: RAPID OPEN PORT DISCOVERY
echo "[+] [STAGE 1/4 - RAPID OPEN PORT DISCOVERY]"
DISCOVERY_CMD="nmap -Pn -n -F -T4 --min-rate \${MIN_RATE} --max-retries 1 --open \${TARGET}"
echo "[CMD] \${DISCOVERY_CMD}"
DISCOVERY_RAW=$(nmap -Pn -n -F -T4 --min-rate \${MIN_RATE} --max-retries 1 --open -oG - "\${TARGET}" 2>&1)

# Extract discovered open ports
OPEN_PORTS=$(echo "\${DISCOVERY_RAW}" | grep -oE '[0-9]+/open/[a-z]+' | cut -d'/' -f1 | paste -sd, -)

if [ -z "\${OPEN_PORTS}" ]; then
  OPEN_PORTS="22,80,443"
  echo "[!] No ports responded to fast SYN/connect discovery. Testing standard default baseline ports (\${OPEN_PORTS})."
else
  echo "[+] Discovered Open Ports: \${OPEN_PORTS}"
fi
echo ""

# STAGE 2: TARGETED SERVICE & VERSION DETECTION
echo "[+] [STAGE 2/4 - SERVICE & VERSION DETECTION]"
VERSION_CMD="nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p \${OPEN_PORTS} \${TARGET}"
echo "[CMD] \${VERSION_CMD}"
VERSION_RAW=$(nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p "\${OPEN_PORTS}" "\${TARGET}" 2>&1)
echo "\${VERSION_RAW}"
echo ""

# Helper: dynamically discover installed NSE scripts by service prefix
get_service_nse() {
  local prefix="$1"
  local fallback="$2"
  local resolved=""
  if [ -d "/usr/share/nmap/scripts" ]; then
    resolved=$(ls /usr/share/nmap/scripts/\${prefix}*.nse 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/\\.nse$//' | paste -sd, -)
  fi
  if [ -n "\${resolved}" ]; then
    echo "\${resolved}"
  else
    echo "\${fallback}"
  fi
}

# STAGE 3: INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT
echo "[+] [STAGE 3/4 - INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT]"

# 3.1 SSH Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iq "ssh" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)22(,|$)"; then
  echo "[*] Targeted Service: OpenSSH detected on port 22."
  SSH_NSE=$(get_service_nse "ssh" "ssh-auth-methods,ssh-brute,ssh-hostkey,ssh-publickey-acceptance,ssh-run,ssh2-enum-algos,sshv1")
  echo "[*] Service NSE Script Suite: \${SSH_NSE}"
  SSH_CMD="nmap -Pn -n -p 22 --script \"\${SSH_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${SSH_CMD}"
  SSH_RAW=$(nmap -Pn -n -p 22 --script "\${SSH_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1)
  echo "\${SSH_RAW}"
  
  echo ""
  echo "--- [SSH ALGORITHM & CIPHER SECURITY EVALUATION] ---"
  
  if echo "\${SSH_RAW}" | grep -iE "diffie-hellman-group1-sha1|diffie-hellman-group14-sha1|diffie-hellman-group-exchange-sha1"; then
    echo "[!] OBSOLETE KEY EXCHANGE DETECTED: SHA-1 based KEX (diffie-hellman-group1-sha1 / group-exchange-sha1) is vulnerable to Logjam and collision attacks."
    echo "[!] RECOMMENDATION: Disable SHA-1 KEX in /etc/ssh/sshd_config. Enforce curve25519-sha256 or diffie-hellman-group16-sha512."
  fi
  
  if echo "\${SSH_RAW}" | grep -iE "3des-cbc|arcfour|arcfour128|arcfour256|blowfish-cbc|cast128-cbc|aes128-cbc|aes192-cbc|aes256-cbc"; then
    echo "[!] OBSOLETE / WEAK CIPHER DETECTED: CBC or legacy ciphers (3DES / RC4 / CBC mode) susceptible to plaintext recovery attacks (CVE-2008-5161)."
    echo "[!] RECOMMENDATION: Remove CBC, 3DES, and ARCFOUR ciphers. Enforce chacha20-poly1305@openssh.com or aes256-gcm@openssh.com."
  fi
  
  if echo "\${SSH_RAW}" | grep -iE "hmac-md5|hmac-md5-96|hmac-sha1-96"; then
    echo "[!] WEAK MAC ALGORITHM DETECTED: MD5 or 96-bit truncated HMAC algorithms in use."
    echo "[!] RECOMMENDATION: Enforce hmac-sha2-512-etm@openssh.com or hmac-sha2-256-etm@openssh.com."
  fi
  
  if echo "\${SSH_RAW}" | grep -i "sshv1" | grep -iv "not offered"; then
    echo "[!] CRITICAL: SSH protocol version 1 (SSHv1) supported! Susceptible to Man-in-the-Middle and CRC32 attacks."
    echo "[!] RECOMMENDATION: Enforce 'Protocol 2' only in sshd_config."
  fi
fi

# 3.2 HTTP/HTTPS Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iqE "http|ssl/http|https" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)(80|443|8080|8443)(,|$)"; then
  HTTP_PORTS=$(echo "\${OPEN_PORTS}" | tr ',' '\n' | grep -E '^(80|443|8080|8443)$' | paste -sd, -)
  if [ -z "\${HTTP_PORTS}" ]; then HTTP_PORTS="80,443"; fi
  echo ""
  echo "[*] Targeted Service: HTTP/Web Service detected on port(s) \${HTTP_PORTS}."
  HTTP_SCRIPTS=$(get_service_nse "http-" "http-title,http-headers,http-methods,http-server-header,http-security-headers,http-auth,http-robots.txt,http-sitemap-generator,http-cors,http-vhosts")
  SSL_SCRIPTS=$(get_service_nse "ssl-" "ssl-enum-ciphers,ssl-cert,ssl-date")
  WEB_NSE="\${HTTP_SCRIPTS},\${SSL_SCRIPTS}"
  echo "[*] Service NSE Script Suite: \${WEB_NSE}"
  HTTP_CMD="nmap -Pn -n -p \${HTTP_PORTS} --script \"\${WEB_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${HTTP_CMD}"
  HTTP_RAW=$(nmap -Pn -n -p "\${HTTP_PORTS}" --script "\${WEB_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1)
  echo "\${HTTP_RAW}"
  
  if echo "\${HTTP_RAW}" | grep -iE "SSLv2|SSLv3|TLSv1.0|TLSv1.1|RC4|3DES"; then
    echo "[!] OBSOLETE TLS/SSL CIPHER/PROTOCOL DETECTED: Deprecated SSLv3/TLS 1.0/TLS 1.1 or legacy ciphers detected."
    echo "[!] RECOMMENDATION: Disable legacy TLS protocols. Enforce TLSv1.2 and TLSv1.3 only."
  fi
fi

# 3.3 SMB Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iqE "smb|microsoft-ds|netbios" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)(445|139)(,|$)"; then
  echo ""
  echo "[*] Targeted Service: SMB/NetBIOS detected on port 445/139."
  SMB_NSE=$(get_service_nse "smb" "smb-protocols,smb-security-mode,smb2-security-mode,smb2-capabilities,smb-enum-shares,smb-os-discovery,smb2-time")
  echo "[*] Service NSE Script Suite: \${SMB_NSE}"
  SMB_CMD="nmap -Pn -n -p 445,139 --script \"\${SMB_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${SMB_CMD}"
  nmap -Pn -n -p 445,139 --script "\${SMB_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi

# 3.4 FTP Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iq "ftp" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)21(,|$)"; then
  echo ""
  echo "[*] Targeted Service: FTP detected on port 21."
  FTP_NSE=$(get_service_nse "ftp" "ftp-anon,ftp-bounce,ftp-syst,ftp-proftpd-backdoor,ftp-vsftpd-backdoor")
  echo "[*] Service NSE Script Suite: \${FTP_NSE}"
  FTP_CMD="nmap -Pn -n -p 21 --script \"\${FTP_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${FTP_CMD}"
  nmap -Pn -n -p 21 --script "\${FTP_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi

# 3.5 Database / MySQL Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iq "mysql" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)3306(,|$)"; then
  echo ""
  echo "[*] Targeted Service: MySQL Database detected on port 3306."
  MYSQL_NSE=$(get_service_nse "mysql" "mysql-info,mysql-enum,mysql-databases,mysql-users,mysql-empty-password")
  echo "[*] Service NSE Script Suite: \${MYSQL_NSE}"
  MYSQL_CMD="nmap -Pn -n -p 3306 --script \"\${MYSQL_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${MYSQL_CMD}"
  nmap -Pn -n -p 3306 --script "\${MYSQL_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi

# 3.6 Remote Desktop (RDP) Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iqE "rdp|ms-wbt-server" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)3389(,|$)"; then
  echo ""
  echo "[*] Targeted Service: Microsoft Remote Desktop (RDP) detected on port 3389."
  RDP_NSE=$(get_service_nse "rdp" "rdp-enum-encryption,rdp-ntlm-info")
  echo "[*] Service NSE Script Suite: \${RDP_NSE}"
  RDP_CMD="nmap -Pn -n -p 3389 --script \"\${RDP_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${RDP_CMD}"
  nmap -Pn -n -p 3389 --script "\${RDP_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi
echo ""

# STAGE 4: BASIC VULNERABILITY AUDIT
echo "[+] [STAGE 4/4 - CORE VULNERABILITY ASSESSMENT]"
VULN_CMD="nmap -Pn -n -T4 --max-retries 1 -p \${OPEN_PORTS} --script \"vulners,vuln\" --script-timeout 60s --host-timeout 240s \${TARGET}"
echo "[CMD] \${VULN_CMD}"
nmap -Pn -n -T4 --max-retries 1 -p "\${OPEN_PORTS}" --script "vulners,vuln" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1

echo ""
echo "================================================================================"
echo "[✓] PHANTOM AUDIT COMPLETED SUCCESSFULLY"
echo "================================================================================"
`;
}

/**
 * Stage 1 -> Stage 2 -> Stage 3: Targeted Service Enumeration & Cipher Audit Script
 */
export function buildTargetedServiceEnumerationScript(target: string, minRate = 1500): string {
  const safeTarget = target.replace(/[^a-zA-Z0-9.-]/g, '');
  const rate = Math.max(minRate, 500);

  return `#!/usr/bin/env bash
TARGET="${safeTarget}"
MIN_RATE=${rate}

echo "================================================================================"
echo "PHANTOM SEC-OPS / BAXTER HUB — TARGETED SERVICE ENUMERATION & CIPHER AUDIT"
echo "Target Scope   : \${TARGET}"
echo "Execution Time : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Engine Mode    : Targeted Service-Specific NSE Enumerator & Cipher Auditor"
echo "================================================================================"
echo ""

# Helper: dynamically discover installed NSE scripts by service prefix
get_service_nse() {
  local prefix="$1"
  local fallback="$2"
  local resolved=""
  if [ -d "/usr/share/nmap/scripts" ]; then
    resolved=$(ls /usr/share/nmap/scripts/\${prefix}*.nse 2>/dev/null | xargs -n1 basename 2>/dev/null | sed 's/\\.nse$//' | paste -sd, -)
  fi
  if [ -n "\${resolved}" ]; then
    echo "\${resolved}"
  else
    echo "\${fallback}"
  fi
}

# STAGE 1: RAPID OPEN PORT DISCOVERY
echo "[+] [STAGE 1/3 - RAPID OPEN PORT DISCOVERY]"
DISCOVERY_CMD="nmap -Pn -n -F -T4 --min-rate \${MIN_RATE} --max-retries 1 --open \${TARGET}"
echo "[CMD] \${DISCOVERY_CMD}"
DISCOVERY_RAW=$(nmap -Pn -n -F -T4 --min-rate \${MIN_RATE} --max-retries 1 --open -oG - "\${TARGET}" 2>&1)

OPEN_PORTS=$(echo "\${DISCOVERY_RAW}" | grep -oE '[0-9]+/open/[a-z]+' | cut -d'/' -f1 | paste -sd, -)

if [ -z "\${OPEN_PORTS}" ]; then
  OPEN_PORTS="22,80,443"
  echo "[!] No ports responded to fast SYN/connect discovery. Testing standard default baseline ports (\${OPEN_PORTS})."
else
  echo "[+] Discovered Open Ports: \${OPEN_PORTS}"
fi
echo ""

# STAGE 2: TARGETED SERVICE & VERSION DETECTION
echo "[+] [STAGE 2/3 - SERVICE & VERSION DETECTION]"
VERSION_CMD="nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p \${OPEN_PORTS} \${TARGET}"
echo "[CMD] \${VERSION_CMD}"
VERSION_RAW=$(nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p "\${OPEN_PORTS}" "\${TARGET}" 2>&1)
echo "\${VERSION_RAW}"
echo ""

# STAGE 3: INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT
echo "[+] [STAGE 3/3 - INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT]"

# 3.1 SSH Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iq "ssh" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)22(,|$)"; then
  echo "[*] Targeted Service: OpenSSH detected on port 22."
  SSH_NSE=$(get_service_nse "ssh" "ssh-auth-methods,ssh-brute,ssh-hostkey,ssh-publickey-acceptance,ssh-run,ssh2-enum-algos,sshv1")
  echo "[*] Service NSE Script Suite: \${SSH_NSE}"
  SSH_CMD="nmap -Pn -n -p 22 --script \"\${SSH_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${SSH_CMD}"
  SSH_RAW=$(nmap -Pn -n -p 22 --script "\${SSH_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1)
  echo "\${SSH_RAW}"
  
  echo ""
  echo "--- [SSH ALGORITHM & CIPHER SECURITY EVALUATION] ---"
  
  if echo "\${SSH_RAW}" | grep -iE "diffie-hellman-group1-sha1|diffie-hellman-group14-sha1|diffie-hellman-group-exchange-sha1"; then
    echo "[!] OBSOLETE KEY EXCHANGE DETECTED: SHA-1 based KEX (diffie-hellman-group1-sha1 / group-exchange-sha1) is vulnerable to Logjam and collision attacks."
    echo "[!] RECOMMENDATION: Disable SHA-1 KEX in /etc/ssh/sshd_config. Enforce curve25519-sha256 or diffie-hellman-group16-sha512."
  fi
  
  if echo "\${SSH_RAW}" | grep -iE "3des-cbc|arcfour|arcfour128|arcfour256|blowfish-cbc|cast128-cbc|aes128-cbc|aes192-cbc|aes256-cbc"; then
    echo "[!] OBSOLETE / WEAK CIPHER DETECTED: CBC or legacy ciphers (3DES / RC4 / CBC mode) susceptible to plaintext recovery attacks (CVE-2008-5161)."
    echo "[!] RECOMMENDATION: Remove CBC, 3DES, and ARCFOUR ciphers. Enforce chacha20-poly1305@openssh.com or aes256-gcm@openssh.com."
  fi
  
  if echo "\${SSH_RAW}" | grep -iE "hmac-md5|hmac-md5-96|hmac-sha1-96"; then
    echo "[!] WEAK MAC ALGORITHM DETECTED: MD5 or 96-bit truncated HMAC algorithms in use."
    echo "[!] RECOMMENDATION: Enforce hmac-sha2-512-etm@openssh.com or hmac-sha2-256-etm@openssh.com."
  fi
  
  if echo "\${SSH_RAW}" | grep -i "sshv1" | grep -iv "not offered"; then
    echo "[!] CRITICAL: SSH protocol version 1 (SSHv1) supported! Susceptible to Man-in-the-Middle and CRC32 attacks."
    echo "[!] RECOMMENDATION: Enforce 'Protocol 2' only in sshd_config."
  fi
fi

# 3.2 HTTP/HTTPS Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iqE "http|ssl/http|https" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)(80|443|8080|8443)(,|$)"; then
  HTTP_PORTS=$(echo "\${OPEN_PORTS}" | tr ',' '\n' | grep -E '^(80|443|8080|8443)$' | paste -sd, -)
  if [ -z "\${HTTP_PORTS}" ]; then HTTP_PORTS="80,443"; fi
  echo ""
  echo "[*] Targeted Service: HTTP/Web Service detected on port(s) \${HTTP_PORTS}."
  HTTP_SCRIPTS=$(get_service_nse "http-" "http-title,http-headers,http-methods,http-server-header,http-security-headers,http-auth,http-robots.txt,http-sitemap-generator,http-cors,http-vhosts")
  SSL_SCRIPTS=$(get_service_nse "ssl-" "ssl-enum-ciphers,ssl-cert,ssl-date")
  WEB_NSE="\${HTTP_SCRIPTS},\${SSL_SCRIPTS}"
  echo "[*] Service NSE Script Suite: \${WEB_NSE}"
  HTTP_CMD="nmap -Pn -n -p \${HTTP_PORTS} --script \"\${WEB_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${HTTP_CMD}"
  HTTP_RAW=$(nmap -Pn -n -p "\${HTTP_PORTS}" --script "\${WEB_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1)
  echo "\${HTTP_RAW}"
  
  if echo "\${HTTP_RAW}" | grep -iE "SSLv2|SSLv3|TLSv1.0|TLSv1.1|RC4|3DES"; then
    echo "[!] OBSOLETE TLS/SSL CIPHER/PROTOCOL DETECTED: Deprecated SSLv3/TLS 1.0/TLS 1.1 or legacy ciphers detected."
    echo "[!] RECOMMENDATION: Disable legacy TLS protocols. Enforce TLSv1.2 and TLSv1.3 only."
  fi
fi

# 3.3 SMB Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iqE "smb|microsoft-ds|netbios" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)(445|139)(,|$)"; then
  echo ""
  echo "[*] Targeted Service: SMB/NetBIOS detected on port 445/139."
  SMB_NSE=$(get_service_nse "smb" "smb-protocols,smb-security-mode,smb2-security-mode,smb2-capabilities,smb-enum-shares,smb-os-discovery,smb2-time")
  echo "[*] Service NSE Script Suite: \${SMB_NSE}"
  SMB_CMD="nmap -Pn -n -p 445,139 --script \"\${SMB_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${SMB_CMD}"
  nmap -Pn -n -p 445,139 --script "\${SMB_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi

# 3.4 FTP Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iq "ftp" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)21(,|$)"; then
  echo ""
  echo "[*] Targeted Service: FTP detected on port 21."
  FTP_NSE=$(get_service_nse "ftp" "ftp-anon,ftp-bounce,ftp-syst,ftp-proftpd-backdoor,ftp-vsftpd-backdoor")
  echo "[*] Service NSE Script Suite: \${FTP_NSE}"
  FTP_CMD="nmap -Pn -n -p 21 --script \"\${FTP_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${FTP_CMD}"
  nmap -Pn -n -p 21 --script "\${FTP_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi

# 3.5 Database / MySQL Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iq "mysql" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)3306(,|$)"; then
  echo ""
  echo "[*] Targeted Service: MySQL Database detected on port 3306."
  MYSQL_NSE=$(get_service_nse "mysql" "mysql-info,mysql-enum,mysql-databases,mysql-users,mysql-empty-password")
  echo "[*] Service NSE Script Suite: \${MYSQL_NSE}"
  MYSQL_CMD="nmap -Pn -n -p 3306 --script \"\${MYSQL_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${MYSQL_CMD}"
  nmap -Pn -n -p 3306 --script "\${MYSQL_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi

# 3.6 Remote Desktop (RDP) Targeted Enumeration
if echo "\${VERSION_RAW}" | grep -iqE "rdp|ms-wbt-server" || echo "\${OPEN_PORTS}" | grep -qE "(^|,)3389(,|$)"; then
  echo ""
  echo "[*] Targeted Service: Microsoft Remote Desktop (RDP) detected on port 3389."
  RDP_NSE=$(get_service_nse "rdp" "rdp-enum-encryption,rdp-ntlm-info")
  echo "[*] Service NSE Script Suite: \${RDP_NSE}"
  RDP_CMD="nmap -Pn -n -p 3389 --script \"\${RDP_NSE}\" --script-timeout 60s --host-timeout 240s \${TARGET}"
  echo "[CMD] \${RDP_CMD}"
  nmap -Pn -n -p 3389 --script "\${RDP_NSE}" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1
fi

echo ""
echo "================================================================================"
echo "[✓] TARGETED SERVICE ENUMERATION COMPLETED SUCCESSFULLY"
echo "================================================================================"
`;
}

/**
 * Stage 1 -> Stage 2 -> Stage 3: Common Vulnerabilities Basic Assessment Script
 */
export function buildVulnerabilityAssessmentScript(target: string, minRate = 1500): string {
  const safeTarget = target.replace(/[^a-zA-Z0-9.-]/g, '');
  const rate = Math.max(minRate, 500);

  return `#!/usr/bin/env bash
TARGET="${safeTarget}"
MIN_RATE=${rate}

echo "================================================================================"
echo "PHANTOM SEC-OPS / BAXTER HUB — CORE VULNERABILITY ASSESSMENT"
echo "Target Scope   : \${TARGET}"
echo "Execution Time : $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "Engine Mode    : Core Vulnerability & CVE Assessment (Nmap NSE)"
echo "================================================================================"
echo ""

# STAGE 1: RAPID OPEN PORT DISCOVERY
echo "[+] [STAGE 1/3 - RAPID OPEN PORT DISCOVERY]"
DISCOVERY_CMD="nmap -Pn -n -F -T4 --min-rate \${MIN_RATE} --max-retries 1 --open \${TARGET}"
echo "[CMD] \${DISCOVERY_CMD}"
DISCOVERY_RAW=$(nmap -Pn -n -F -T4 --min-rate \${MIN_RATE} --max-retries 1 --open -oG - "\${TARGET}" 2>&1)

OPEN_PORTS=$(echo "\${DISCOVERY_RAW}" | grep -oE '[0-9]+/open/[a-z]+' | cut -d'/' -f1 | paste -sd, -)

if [ -z "\${OPEN_PORTS}" ]; then
  OPEN_PORTS="22,80,443"
  echo "[!] No ports responded to fast SYN/connect discovery. Testing standard default baseline ports (\${OPEN_PORTS})."
else
  echo "[+] Discovered Open Ports: \${OPEN_PORTS}"
fi
echo ""

# STAGE 2: TARGETED SERVICE & VERSION DETECTION
echo "[+] [STAGE 2/3 - SERVICE & VERSION DETECTION]"
VERSION_CMD="nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p \${OPEN_PORTS} \${TARGET}"
echo "[CMD] \${VERSION_CMD}"
nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p "\${OPEN_PORTS}" "\${TARGET}" 2>&1
echo ""

# STAGE 3: CORE VULNERABILITY ASSESSMENT
echo "[+] [STAGE 3/3 - CORE VULNERABILITY ASSESSMENT]"
VULN_CMD="nmap -Pn -n -T4 --max-retries 1 -p \${OPEN_PORTS} --script \"vulners,vuln\" --script-timeout 60s --host-timeout 240s \${TARGET}"
echo "[CMD] \${VULN_CMD}"
nmap -Pn -n -T4 --max-retries 1 -p "\${OPEN_PORTS}" --script "vulners,vuln" --script-timeout 60s --host-timeout 240s "\${TARGET}" 2>&1

echo ""
echo "================================================================================"
echo "[✓] VULNERABILITY ASSESSMENT COMPLETED SUCCESSFULLY"
echo "================================================================================"
`;
}

export function buildMockOpenPortDiscoveryReport(target: string): string {
  const host = target || '127.0.0.1';
  return `================================================================================
PHANTOM SEC-OPS / BAXTER HUB — RAPID OPEN PORT DISCOVERY
Target Scope   : ${host}
Execution Time : ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
Engine Mode    : Ultra-fast TCP Open Port Discovery (Nmap SYN / Connect)
================================================================================

[CMD] nmap -Pn -n -F -T4 --min-rate 1500 --max-retries 1 --open ${host}
Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toLocaleDateString()}
Nmap scan report for ${host}
Host is up (0.00038s latency).
Not shown: 98 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http

[+] Discovered Open Ports: 22,80
================================================================================
[✓] OPEN PORT DISCOVERY COMPLETED (2 OPEN PORTS FOUND)
================================================================================`;
}

export function buildMockVersionDetectionReport(target: string): string {
  const host = target || '127.0.0.1';
  return `================================================================================
PHANTOM SEC-OPS / BAXTER HUB — PORT & SERVICE VERSION DETECTION
Target Scope   : ${host}
Execution Time : ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
Engine Mode    : Service Banner Grabbing & Version Probing (sV + light probes)
================================================================================

[CMD] nmap -Pn -n -F -sV --version-light -T4 --min-rate 1500 --max-retries 1 --host-timeout 60s ${host}
Starting Nmap 7.94 ( https://nmap.org )
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
================================================================================
[✓] SERVICE VERSION DETECTION COMPLETED
================================================================================`;
}

export function buildMockTargetedServiceEnumerationReport(target: string): string {
  const host = target || '127.0.0.1';
  return `================================================================================
PHANTOM SEC-OPS / BAXTER HUB — TARGETED SERVICE ENUMERATION & CIPHER AUDIT
Target Scope   : ${host}
Execution Time : ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
Engine Mode    : Targeted Service-Specific NSE Enumerator & Cipher Auditor
================================================================================

[+] [STAGE 1/3 - RAPID OPEN PORT DISCOVERY]
[CMD] nmap -Pn -n -F -T4 --min-rate 1500 --max-retries 1 --open ${host}
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
[+] Discovered Open Ports: 22,80

[+] [STAGE 2/3 - SERVICE & VERSION DETECTION]
[CMD] nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p 22,80 ${host}
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)

[+] [STAGE 3/3 - INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT]
[*] Targeted Service: OpenSSH detected on port 22.
[CMD] nmap -Pn -n -p 22 --script "ssh2-enum-algos,ssh-auth-methods,ssh-hostkey,sshv1" ${host}
PORT   STATE SERVICE
22/tcp open  ssh
| ssh2-enum-algos: 
|   kex_algorithms: (4)
|       curve25519-sha256
|       diffie-hellman-group-exchange-sha256
|       diffie-hellman-group14-sha1
|       diffie-hellman-group1-sha1
|   encryption_algorithms: (8)
|       chacha20-poly1305@openssh.com
|       aes256-gcm@openssh.com
|       aes128-gcm@openssh.com
|       aes256-ctr
|       aes128-ctr
|       3des-cbc
|       aes128-cbc
|       aes256-cbc
|   mac_algorithms: (4)
|       umac-128-etm@openssh.com
|       hmac-sha2-256-etm@openssh.com
|       hmac-sha1
|_      hmac-md5

--- [SSH ALGORITHM & CIPHER SECURITY EVALUATION] ---
[!] OBSOLETE KEY EXCHANGE DETECTED: SHA-1 based KEX (diffie-hellman-group1-sha1 / group-exchange-sha1) is vulnerable to Logjam and collision attacks.
[!] RECOMMENDATION: Disable SHA-1 KEX in /etc/ssh/sshd_config. Enforce curve25519-sha256 or diffie-hellman-group16-sha512.
[!] OBSOLETE / WEAK CIPHER DETECTED: CBC or legacy ciphers (3DES / RC4 / CBC mode) susceptible to plaintext recovery attacks (CVE-2008-5161).
[!] RECOMMENDATION: Remove CBC, 3DES, and ARCFOUR ciphers. Enforce chacha20-poly1305@openssh.com or aes256-gcm@openssh.com.
[!] WEAK MAC ALGORITHM DETECTED: MD5 or 96-bit truncated HMAC algorithms in use.
[!] RECOMMENDATION: Enforce hmac-sha2-512-etm@openssh.com or hmac-sha2-256-etm@openssh.com.

[*] Targeted Service: HTTP/Web Service detected on port(s) 80.
[CMD] nmap -Pn -n -p 80 --script "http-title,http-headers,http-methods,ssl-enum-ciphers,ssl-cert" ${host}
PORT   STATE SERVICE
80/tcp open  http
|_http-title: Baxter Innovation HUB - SecOps Portal
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
| http-headers: 
|   Server: nginx/1.18.0 (Ubuntu)
|   Strict-Transport-Security: max-age=31536000; includeSubDomains
|_  X-Content-Type-Options: nosniff

================================================================================
[✓] TARGETED SERVICE ENUMERATION COMPLETED SUCCESSFULLY
================================================================================`;
}

export function buildMockVulnerabilityAssessmentReport(target: string): string {
  const host = target || '127.0.0.1';
  return `================================================================================
PHANTOM SEC-OPS / BAXTER HUB — CORE VULNERABILITY ASSESSMENT
Target Scope   : ${host}
Execution Time : ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
Engine Mode    : Core Vulnerability & CVE Assessment (Nmap NSE)
================================================================================

[+] [STAGE 1/3 - RAPID OPEN PORT DISCOVERY]
[CMD] nmap -Pn -n -F -T4 --min-rate 1500 --max-retries 1 --open ${host}
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
[+] Discovered Open Ports: 22,80

[+] [STAGE 2/3 - SERVICE & VERSION DETECTION]
[CMD] nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p 22,80 ${host}
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)

[+] [STAGE 3/3 - CORE VULNERABILITY ASSESSMENT]
[CMD] nmap -Pn -n -T4 --max-retries 1 -p 22,80 --script "vulners,vuln" --host-timeout 90s ${host}
PORT   STATE SERVICE
22/tcp open  ssh
| vulners: 
|   cpe:/a:openbsd:openssh:8.2p1: 
|_    CVE-2023-38408  9.8  https://vulners.com/cve/CVE-2023-38408
80/tcp open  http
|_http-csrf: Couldn't find any CSRF vulnerabilities.
|_http-dombased-xss: Couldn't find any DOM based XSS.

================================================================================
[✓] VULNERABILITY ASSESSMENT COMPLETED SUCCESSFULLY
================================================================================`;
}

/**
 * Builds rich simulated multi-stage output for development, loopback, or test runs.
 */
export function buildMockNmapAuditReport(target: string, mode?: 'discovery' | 'version' | 'enumeration' | 'vuln' | 'full' | string): string {
  if (mode === 'discovery') return buildMockOpenPortDiscoveryReport(target);
  if (mode === 'version') return buildMockVersionDetectionReport(target);
  if (mode === 'enumeration') return buildMockTargetedServiceEnumerationReport(target);
  if (mode === 'vuln') return buildMockVulnerabilityAssessmentReport(target);

  const host = target || '127.0.0.1';
  return `================================================================================
PHANTOM SEC-OPS / BAXTER HUB — INTELLIGENT MULTI-STAGE NETWORK AUDIT
Target Scope   : ${host}
Execution Time : ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC
Engine Mode    : Adaptive Multi-Stage Nmap NSE Service Auditor
================================================================================

[+] [STAGE 1/4 - RAPID OPEN PORT DISCOVERY]
[CMD] nmap -Pn -n -F -T4 --min-rate 1500 --max-retries 1 --open ${host}
Starting Nmap 7.94 ( https://nmap.org ) at ${new Date().toLocaleDateString()}
Nmap scan report for ${host}
Host is up (0.00045s latency).
Not shown: 98 closed tcp ports (reset)
PORT     STATE SERVICE
22/tcp   open  ssh
80/tcp   open  http
[+] Discovered Open Ports: 22,80

[+] [STAGE 2/4 - SERVICE & VERSION DETECTION]
[CMD] nmap -Pn -n -sV --version-light -T4 --max-retries 1 -p 22,80 ${host}
Starting Nmap 7.94 ( https://nmap.org )
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
80/tcp   open  http    nginx 1.18.0 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

[+] [STAGE 3/4 - INTELLIGENT SERVICE ENUMERATION & CIPHER AUDIT]
[*] Targeted Service: OpenSSH detected on port 22.
[CMD] nmap -Pn -n -p 22 --script "ssh2-enum-algos,ssh-auth-methods,ssh-hostkey,sshv1" ${host}
Starting Nmap 7.94 ( https://nmap.org )
PORT   STATE SERVICE
22/tcp open  ssh
| ssh2-enum-algos: 
|   kex_algorithms: (4)
|       curve25519-sha256
|       diffie-hellman-group-exchange-sha256
|       diffie-hellman-group14-sha1
|       diffie-hellman-group1-sha1
|   server_host_key_algorithms: (4)
|       ssh-ed25519
|       rsa-sha2-512
|       rsa-sha2-256
|       ssh-rsa
|   encryption_algorithms: (8)
|       chacha20-poly1305@openssh.com
|       aes256-gcm@openssh.com
|       aes128-gcm@openssh.com
|       aes256-ctr
|       aes128-ctr
|       3des-cbc
|       aes128-cbc
|       aes256-cbc
|   mac_algorithms: (4)
|       umac-128-etm@openssh.com
|       hmac-sha2-256-etm@openssh.com
|       hmac-sha1
|_      hmac-md5
| ssh-auth-methods: 
|   Supported authentication methods:
|     publickey
|_    password
|_sshv1: Server does not offer SSHv1 (Protocol 2 only)

--- [SSH ALGORITHM & CIPHER SECURITY EVALUATION] ---
[!] OBSOLETE KEY EXCHANGE DETECTED: SHA-1 based KEX (diffie-hellman-group1-sha1 / group-exchange-sha1) is vulnerable to Logjam and collision attacks.
[!] RECOMMENDATION: Disable SHA-1 KEX in /etc/ssh/sshd_config. Enforce curve25519-sha256 or diffie-hellman-group16-sha512.
[!] OBSOLETE / WEAK CIPHER DETECTED: CBC or legacy ciphers (3DES / RC4 / CBC mode) susceptible to plaintext recovery attacks (CVE-2008-5161).
[!] RECOMMENDATION: Remove CBC, 3DES, and ARCFOUR ciphers. Enforce chacha20-poly1305@openssh.com or aes256-gcm@openssh.com.
[!] WEAK MAC ALGORITHM DETECTED: MD5 or 96-bit truncated HMAC algorithms in use.
[!] RECOMMENDATION: Enforce hmac-sha2-512-etm@openssh.com or hmac-sha2-256-etm@openssh.com.

[*] Targeted Service: HTTP/Web Service detected on port(s) 80.
[CMD] nmap -Pn -n -p 80 --script "http-title,http-headers,http-methods,ssl-enum-ciphers,ssl-cert" ${host}
PORT   STATE SERVICE
80/tcp open  http
|_http-title: Baxter Innovation HUB - SecOps Portal
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
| http-headers: 
|   Server: nginx/1.18.0 (Ubuntu)
|   Strict-Transport-Security: max-age=31536000; includeSubDomains
|_  X-Content-Type-Options: nosniff

[+] [STAGE 4/4 - CORE VULNERABILITY ASSESSMENT]
[CMD] nmap -Pn -n -T4 --max-retries 1 -p 22,80 --script "vulners,vuln" --host-timeout 60s ${host}
PORT   STATE SERVICE
22/tcp open  ssh
| vulners: 
|   cpe:/a:openbsd:openssh:8.2p1: 
|_    CVE-2023-38408  9.8  https://vulners.com/cve/CVE-2023-38408
80/tcp open  http
|_http-csrf: Couldn't find any CSRF vulnerabilities.
|_http-dombased-xss: Couldn't find any DOM based XSS.

================================================================================
[✓] PHANTOM AUDIT COMPLETED SUCCESSFULLY
================================================================================`;
}
