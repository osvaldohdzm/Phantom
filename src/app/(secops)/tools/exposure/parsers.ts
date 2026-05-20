// src/app/(secops)/tools/exposure/parsers.ts

export interface NmapHost {
  ip: string;
  hostname: string;
  os: string;
  ports: NmapPort[];
}

export interface NmapPort {
  port: number;
  protocol: string;
  service: string;
  state: string;
}

export interface NessusVuln {
  pluginId: string;
  cve: string;
  cvss: string;
  risk: string;
  host: string;
  protocol: string;
  port: number;
  name: string;
  synopsis: string;
  description: string;
  solution: string;
  pluginOutput: string;
}

export async function parseNmap(file: File): Promise<NmapHost[]> {
  const text = await file.text();
  if (text.includes('<?xml')) {
    return parseNmapXML(text);
  } else {
    return parseNmapGrepable(text);
  }
}

function parseNmapXML(xml: string): NmapHost[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const hostElements = doc.getElementsByTagName('host');
  const hosts: NmapHost[] = [];

  for (let i = 0; i < hostElements.length; i++) {
    const hostEl = hostElements[i];
    
    // Status check
    const statusEl = hostEl.getElementsByTagName('status')[0];
    if (statusEl && statusEl.getAttribute('state') !== 'up') continue;

    // IP
    let ip = '';
    const addresses = hostEl.getElementsByTagName('address');
    for (let j = 0; j < addresses.length; j++) {
      if (addresses[j].getAttribute('addrtype') === 'ipv4' || addresses[j].getAttribute('addrtype') === 'ipv6') {
        ip = addresses[j].getAttribute('addr') || '';
        break;
      }
    }
    if (!ip) continue;

    // Hostname
    let hostname = '';
    const hostnamesEl = hostEl.getElementsByTagName('hostnames')[0];
    if (hostnamesEl) {
      const nameEl = hostnamesEl.getElementsByTagName('hostname')[0];
      if (nameEl) hostname = nameEl.getAttribute('name') || '';
    }

    // OS
    let os = '';
    const osEl = hostEl.getElementsByTagName('os')[0];
    if (osEl) {
      const osMatch = osEl.getElementsByTagName('osmatch')[0];
      if (osMatch) os = osMatch.getAttribute('name') || '';
    }

    // Ports
    const ports: NmapPort[] = [];
    const portsEl = hostEl.getElementsByTagName('ports')[0];
    if (portsEl) {
      const portElements = portsEl.getElementsByTagName('port');
      for (let p = 0; p < portElements.length; p++) {
        const pEl = portElements[p];
        const stateEl = pEl.getElementsByTagName('state')[0];
        const state = stateEl ? stateEl.getAttribute('state') || '' : '';
        
        // We only care about open ports (or open|filtered)
        if (!state.includes('open')) continue;

        const portId = parseInt(pEl.getAttribute('portid') || '0', 10);
        const protocol = pEl.getAttribute('protocol') || '';
        
        const serviceEl = pEl.getElementsByTagName('service')[0];
        const service = serviceEl ? serviceEl.getAttribute('name') || '' : 'unknown';

        ports.push({ port: portId, protocol, service, state });
      }
    }

    hosts.push({ ip, hostname, os, ports });
  }

  return hosts;
}

function parseNmapGrepable(text: string): NmapHost[] {
  const hosts: NmapHost[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    
    // Format: Host: 192.168.1.1 (example.com)	Ports: 22/open/tcp//ssh///, 80/open/tcp//http///
    const hostMatch = line.match(/^Host: ([^\s]+)\s*(?:\(([^)]*)\))?\s*Ports: (.*)$/);
    if (hostMatch) {
      const ip = hostMatch[1];
      const hostname = hostMatch[2] || '';
      const portsStr = hostMatch[3];
      const ports: NmapPort[] = [];

      const portEntries = portsStr.split(',');
      for (const entry of portEntries) {
        const parts = entry.trim().split('/');
        if (parts.length >= 5) {
          const port = parseInt(parts[0], 10);
          const state = parts[1];
          const protocol = parts[2];
          const service = parts[4];

          if (state.includes('open')) {
            ports.push({ port, protocol, service, state });
          }
        }
      }

      hosts.push({ ip, hostname, os: '', ports });
    }
  }

  return hosts;
}

export async function parseNessus(file: File): Promise<NessusVuln[]> {
  const text = await file.text();
  if (text.trim().startsWith('<?xml') || text.includes('<NessusClientData_v2>')) {
    return parseNessusXML(text);
  } else {
    return parseNessusCSV(text);
  }
}

function parseNessusXML(xml: string): NessusVuln[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const vulns: NessusVuln[] = [];

  const hosts = doc.getElementsByTagName('ReportHost');
  for (let i = 0; i < hosts.length; i++) {
    const hostEl = hosts[i];
    const hostName = hostEl.getAttribute('name') || '';

    const items = hostEl.getElementsByTagName('ReportItem');
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      const pluginId = item.getAttribute('pluginID') || '';
      const port = parseInt(item.getAttribute('port') || '0', 10);
      const protocol = item.getAttribute('protocol') || '';
      const name = item.getAttribute('pluginName') || '';
      
      const riskEl = item.getElementsByTagName('risk_factor')[0];
      const risk = riskEl ? riskEl.textContent || 'None' : 'None';

      const cvssEl = item.getElementsByTagName('cvss3_base_score')[0] || item.getElementsByTagName('cvss_base_score')[0];
      const cvss = cvssEl ? cvssEl.textContent || '' : '';

      const cveEls = item.getElementsByTagName('cve');
      const cves = Array.from(cveEls).map(c => c.textContent).filter(Boolean).join(', ');

      const synEl = item.getElementsByTagName('synopsis')[0];
      const synopsis = synEl ? synEl.textContent || '' : '';

      const descEl = item.getElementsByTagName('description')[0];
      const description = descEl ? descEl.textContent || '' : '';

      const solEl = item.getElementsByTagName('solution')[0];
      const solution = solEl ? solEl.textContent || '' : '';

      const outEl = item.getElementsByTagName('plugin_output')[0];
      const pluginOutput = outEl ? outEl.textContent || '' : '';

      vulns.push({
        pluginId,
        cve: cves,
        cvss,
        risk,
        host: hostName,
        protocol,
        port,
        name,
        synopsis,
        description,
        solution,
        pluginOutput
      });
    }
  }

  return vulns;
}

function parseNessusCSV(csv: string): NessusVuln[] {
  const lines: string[] = [];
  let start = 0;
  let insideQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    if (csv[i] === '"') {
      insideQuotes = !insideQuotes;
    } else if (csv[i] === '\n' && !insideQuotes) {
      let end = i;
      if (i > 0 && csv[i - 1] === '\r') end = i - 1;
      
      const line = csv.substring(start, end);
      if (line.trim()) lines.push(line);
      start = i + 1;
    }
  }
  const lastLine = csv.substring(start);
  if (lastLine.trim()) lines.push(lastLine);

  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const vulns: NessusVuln[] = [];

  const getIdx = (name: string) => headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
  
  const idIdx = getIdx('Plugin ID');
  const cveIdx = getIdx('CVE');
  const cvssIdx = getIdx('CVSS v3.0 Base Score') > -1 ? getIdx('CVSS v3.0 Base Score') : getIdx('CVSS v2.0 Base Score');
  const riskIdx = getIdx('Risk');
  const hostIdx = getIdx('Host');
  const protoIdx = getIdx('Protocol');
  const portIdx = getIdx('Port');
  const nameIdx = getIdx('Name');
  const synIdx = getIdx('Synopsis');
  const descIdx = getIdx('Description');
  const solIdx = getIdx('Solution');
  const outIdx = getIdx('Plugin Output');

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length && values.length < 5) continue; // Skip malformed short lines

    const safeGet = (idx: number) => idx > -1 && idx < values.length ? values[idx].trim() : '';

    vulns.push({
      pluginId: safeGet(idIdx),
      cve: safeGet(cveIdx),
      cvss: safeGet(cvssIdx),
      risk: safeGet(riskIdx),
      host: safeGet(hostIdx),
      protocol: safeGet(protoIdx),
      port: parseInt(safeGet(portIdx) || '0', 10),
      name: safeGet(nameIdx),
      synopsis: safeGet(synIdx),
      description: safeGet(descIdx),
      solution: safeGet(solIdx),
      pluginOutput: safeGet(outIdx)
    });
  }

  return vulns;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let start = 0;
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (line[i] === ',' && !insideQuotes) {
      let col = line.substring(start, i);
      if (col.startsWith('"') && col.endsWith('"') && col.length >= 2) {
        col = col.substring(1, col.length - 1).replace(/""/g, '"');
      }
      result.push(col);
      start = i + 1;
    }
  }
  let lastCol = line.substring(start);
  if (lastCol.startsWith('"') && lastCol.endsWith('"') && lastCol.length >= 2) {
    lastCol = lastCol.substring(1, lastCol.length - 1).replace(/""/g, '"');
  }
  result.push(lastCol);
  return result;
}
