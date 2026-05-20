export interface NmapResult {
  IP: string;
  Puerto: string;
  Servicio: string;
  Versión: string;
  Archivo: string;
}

export const parseGnmap = (text: string, filename: string): NmapResult[] => {
  console.log(`Parsing GNMAP: ${filename}`);
  const lines = text.split(/\r?\n/);
  const results: NmapResult[] = [];

  lines.forEach((line) => {
    // GNMAP lines with results contain 'Host:' and 'Ports:'
    if (line.includes('Host:') && line.includes('Ports:')) {
      const ipMatch = line.match(/Host: ([\d.]+)/);
      if (!ipMatch) return;

      const ip = ipMatch[1];
      const portsSection = line.split('Ports: ')[1];
      if (!portsSection) return;

      // GNMAP ports are separated by ', ' or sometimes just ','
      const portEntries = portsSection.split(/,\s*/);

      portEntries.forEach((entry) => {
        // Each entry is port/state/protocol/owner/service/rpc_info/version
        // We only care about the parts we need.
        const parts = entry.split('/');
        if (parts.length >= 2) {
          const portId = parts[0].trim();
          const state = parts[1].trim();
          
          if (state === 'open') {
            const servicio = parts[4]?.trim() || 'N/A';
            const version = parts[6]?.trim() || 'N/A';
            
            results.push({
              IP: ip,
              Puerto: portId,
              Servicio: servicio,
              Versión: version,
              Archivo: filename,
            });
          }
        }
      });
    }
  });

  console.log(`Found ${results.length} services in GNMAP ${filename}`);
  return results;
};

export const parseXml = (text: string, filename: string): NmapResult[] => {
  console.log(`Parsing XML: ${filename}`);
  const results: NmapResult[] = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'text/xml');
    
    // Check for parser errors
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) {
      console.error('XML Parser Error:', parserError[0].textContent);
      return [];
    }

    const hosts = xmlDoc.getElementsByTagName('host');
    for (let i = 0; i < hosts.length; i++) {
      const host = hosts[i];
      
      const addresses = host.getElementsByTagName('address');
      let address = 'Unknown';
      for (let k = 0; k < addresses.length; k++) {
        const addr = addresses[k].getAttribute('addr');
        const type = addresses[k].getAttribute('addrtype');
        if (type === 'ipv4' && addr) {
          address = addr;
          break;
        }
      }
      
      if (address === 'Unknown' && addresses.length > 0) {
        address = addresses[0].getAttribute('addr') || 'Unknown';
      }

      const ports = host.getElementsByTagName('port');
      for (let j = 0; j < ports.length; j++) {
        const port = ports[j];
        const state = port.getElementsByTagName('state')[0]?.getAttribute('state');
        
        if (state !== 'open') continue;

        const portId = port.getAttribute('portid') || 'Unknown';
        const service = port.getElementsByTagName('service')[0];
        const serviceName = service?.getAttribute('name') || 'N/A';
        const product = service?.getAttribute('product') || '';
        const version = service?.getAttribute('version') || '';
        const extra = service?.getAttribute('extrainfo') || '';
        
        const fullVersion = [product, version, extra].filter(Boolean).join(' ') || 'N/A';
        
        results.push({
          IP: address,
          Puerto: portId,
          Servicio: serviceName,
          Versión: fullVersion,
          Archivo: filename,
        });
      }
    }
  } catch (e) {
    console.error(`Error in parseXml for ${filename}:`, e);
  }
  
  console.log(`Found ${results.length} services in XML ${filename}`);
  return results;
};

export const parseNormalNmap = (text: string, filename: string): NmapResult[] => {
  console.log(`Parsing Normal Nmap: ${filename}`);
  const results: NmapResult[] = [];
  const lines = text.split(/\r?\n/);
  let currentIp = 'Unknown';

  lines.forEach((line) => {
    // Match IP: "Nmap scan report for 192.168.1.1" or "Nmap scan report for host (192.168.1.1)"
    const nmapScanMatch = line.match(/Nmap scan report for (?:.*?\(?([\d.]+)\)?|([\d.]+))/);
    if (nmapScanMatch) {
      currentIp = nmapScanMatch[1] || nmapScanMatch[2] || currentIp;
    }

    // Match Port: "80/tcp open  http  Apache..."
    // More lenient regex for the port line
    const portMatch = line.match(/^\s*(\d+)\/(\w+)\s+(\w+)\s+([\w.-]+)\s*(.*)$/);
    if (portMatch) {
      const state = portMatch[3];
      if (state === 'open') {
        results.push({
          IP: currentIp,
          Puerto: portMatch[1],
          Servicio: portMatch[4],
          Versión: portMatch[5].trim() || 'N/A',
          Archivo: filename,
        });
      }
    }
  });

  console.log(`Found ${results.length} services in Normal Nmap ${filename}`);
  return results;
};

export const parseNmapFile = (text: string, filename: string): NmapResult[] => {
  console.log(`Total text length for ${filename}: ${text.length}`);
  const trimmedText = text.trim();
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.endsWith('.xml') || trimmedText.startsWith('<?xml') || trimmedText.startsWith('<nmaprun')) {
    return parseXml(text, filename);
  } else if (lowerFilename.endsWith('.gnmap')) {
    return parseGnmap(text, filename);
  } else {
    // Try GNMAP first if it looks like it
    if (text.includes('Host:') && text.includes('Ports:')) {
      return parseGnmap(text, filename);
    }
    
    // Fallback to normal parsing
    const results = parseNormalNmap(text, filename);
    
    // If normal parsing failed, maybe try GNMAP one last time just in case
    if (results.length === 0 && text.includes('Ports:')) {
      return parseGnmap(text, filename);
    }
    
    return results;
  }
};

