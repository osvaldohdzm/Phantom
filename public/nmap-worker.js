// nmap-worker.js
self.onmessage = function(e) {
  const { text } = e.data;
  const lines = text.split('\n');
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Ports:')) {
      const ipMatch = line.match(/Host: ([\d.]+)/);
      if (!ipMatch) continue;

      const ip = ipMatch[1];
      const portsSection = line.split('Ports: ')[1];
      if (!portsSection) continue;

      const ports = portsSection.split(', ');

      for (let j = 0; j < ports.length; j++) {
        const p = ports[j];
        const parts = p.split('/');
        if (parts.length >= 7) {
          results.push({
            IP: ip,
            Puerto: parts[0].trim(),
            Servicio: parts[4].trim() || 'N/A',
            Versión: parts[6].trim() || 'N/A',
          });
        }
      }
    }
  }

  self.postMessage({ results });
};
