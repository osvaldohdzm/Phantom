const fs = require('fs');

const sample = `Plugin ID,CVE,CVSS v2.0 Base Score,Risk,Host,Protocol,Port,Name,Synopsis,Description,Solution,See Also,Plugin Output,STIG Severity,CVSS v3.0 Base Score,CVSS v2.0 Temporal Score,CVSS v3.0 Temporal Score,Risk Factor,BID,XREF,MSKB,Plugin Publication Date,Plugin Modification Date,Metasploit,Core Impact,CANVAS
10180,,,None,10.13.128.0,tcp,0,Ping the remote host,"It was possible to identify the status of the remote host (alive or
dead).","Nessus was able to determine if the remote host is alive using one or
more of the following ping types :

  - An ARP ping, provided the host is on the local subnet
    and Nessus is running over Ethernet.",n/a,,"The remote host (10.13.128.0) is considered as dead - not scanning
The remote host (10.13.128.0) did not respond to the following ping methods :
- TCP ping
- ICMP ping
",,,,,None,,,,24/06/1999,25/02/2025,,,
`;

function parseNessusCSV(csv) {
  const lines = [];
  let currentLine = '';
  let insideQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentLine.trim()) lines.push(currentLine);
      currentLine = '';
      if (char === '\r' && csv[i + 1] === '\n') i++;
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);

  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const vulns = [];

  const getIdx = (name) => headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
  
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

  console.log("Headers found:", headers);
  console.log("Indexes: ", { idIdx, cveIdx, cvssIdx, riskIdx, hostIdx, protoIdx, portIdx, nameIdx, synIdx, descIdx, solIdx, outIdx });

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    console.log("Row", i, "values length:", values.length);
    if (values.length < headers.length && values.length < 5) continue;

    const safeGet = (idx) => idx > -1 && idx < values.length ? values[idx].trim() : '';

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

function parseCSVLine(line) {
  const result = [];
  let currentStr = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        currentStr += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(currentStr);
      currentStr = '';
    } else {
      currentStr += char;
    }
  }
  result.push(currentStr);
  return result;
}

console.log(parseNessusCSV(sample));
