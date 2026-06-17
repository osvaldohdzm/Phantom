'use client';

import { useState } from 'react';
import { parseNmap, parseNessus, NmapHost, NessusVuln } from './parsers';
import { generateHTML, ReportMetadata } from './html-template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Download, UploadCloud, FileType2, Loader2 } from 'lucide-react';

export default function ExposureReportPage() {
  const [metadata, setMetadata] = useState<ReportMetadata>({
    title: '',
    date: new Date().toISOString().split('T')[0],
  });

  const [files, setFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (files.length === 0) {
      alert('Por favor sube al menos un archivo de Nmap o Nessus.');
      return;
    }

    setIsGenerating(true);

    try {
      const allHosts: NmapHost[] = [];
      let allVulns: NessusVuln[] = [];

      // Parse files
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'csv' || ext === 'nessus') {
          const vulns = await parseNessus(file);
          allVulns.push(...vulns);
        } else if (ext === 'xml' || ext === 'nmap' || ext === 'gnmap' || ext === 'txt') {
          // Attempt Nmap first
          try {
            const hosts = await parseNmap(file);
            allHosts.push(...hosts);
          } catch (e) {
            console.error('Failed to parse as Nmap, trying Nessus XML...', e);
            const vulns = await parseNessus(file);
            allVulns.push(...vulns);
          }
        }
      }

      // Merge duplicate hosts from different nmap scans
      const hostMap = new Map<string, NmapHost>();
      for (const h of allHosts) {
        if (!hostMap.has(h.ip)) {
          hostMap.set(h.ip, h);
        } else {
          // Merge ports
          const existing = hostMap.get(h.ip)!;
          const newPorts = [...existing.ports, ...h.ports];
          // Remove duplicates
          existing.ports = newPorts.filter((v, i, a) => a.findIndex(t => (t.port === v.port)) === i);
          if (!existing.hostname && h.hostname) existing.hostname = h.hostname;
        }
      }

      // Filter out dead hosts identified by Nessus Plugin 10180
      const deadNessusHosts = new Set(
        allVulns.filter(v => v.pluginId === '10180' && v.pluginOutput.toLowerCase().includes('considered as dead'))
                .map(v => v.host)
      );
      allVulns = allVulns.filter(v => !deadNessusHosts.has(v.host));

      // Filter out specific unwanted SSL vulnerabilities
      const unwantedVulns = new Set([
        'SSL Certificate Cannot Be Trusted',
        'SSL Self-Signed Certificate'
      ]);
      allVulns = allVulns.filter(v => !unwantedVulns.has(v.name));

      // Extract unmapped hosts from Nessus if they weren't in Nmap
      const uniqueNessusHosts = Array.from(new Set(allVulns.map(v => v.host)));
      for (const hostIp of uniqueNessusHosts) {
        if (!hostMap.has(hostIp)) {
          // Try to guess if it's IP
          hostMap.set(hostIp, {
            ip: hostIp,
            hostname: '',
            os: '',
            ports: []
          });
        }
      }

      const mergedHosts = Array.from(hostMap.values());
      const reportData = { hosts: mergedHosts, vulnerabilities: allVulns };

      // Fetch vis.js minified source
      let visJsSource = '';
      try {
        const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.2/standalone/umd/vis-network.min.js');
        if (res.ok) {
          visJsSource = await res.text();
        } else {
          throw new Error('Failed to fetch vis.js');
        }
      } catch (err) {
        alert('Error: Fallo al descargar dependencias offline (vis.js). Revisa tu conexión a internet.');
        setIsGenerating(false);
        return;
      }

      // Generate HTML
      const htmlString = generateHTML(reportData, metadata, visJsSource);

      // Trigger Download
      const blob = new Blob([htmlString], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Exposure_Report_${metadata.title.replace(/\s+/g, '_') || 'Network'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('¡Reporte generado y descargado exitosamente!');

    } catch (err) {
      console.error(err);
      alert('Error generando el reporte: ' + String(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="size-6 text-violet-400" />
        <h1 className="text-2xl font-bold tracking-tight">Network Exposure Live Report</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Genera un reporte HTML interactivo y standalone a partir de resultados de Nmap y Nessus.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metadata del Reporte</CardTitle>
            <CardDescription>Información contextual para la cabecera del reporte.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Nombre del Reporte</label>
              <Input
                value={metadata.title}
                onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Fecha</label>
              <Input
                type="date"
                value={metadata.date}
                onChange={(e) => setMetadata({ ...metadata, date: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Archivos de Origen</CardTitle>
              <CardDescription>Sube resultados de Nmap (XML/Grepable) y Nessus (CSV/XML).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed border-border hover:border-violet-500 rounded-lg p-8 text-center transition-colors cursor-pointer bg-muted/30"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <UploadCloud className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Haz clic para subir archivos</p>
                <p className="text-xs text-muted-foreground mt-1">.xml, .csv, .nessus, .nmap, .gnmap</p>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  accept=".xml,.csv,.nessus,.nmap,.gnmap,.txt"
                  onChange={handleFileChange}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Archivos Cargados</label>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded-md border border-border">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileType2 className="size-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                          <span className="text-sm truncate">{f.name}</span>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="text-muted-foreground hover:text-destructive px-2"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium"
            disabled={files.length === 0 || isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" /> Generando Reporte...
              </>
            ) : (
              <>
                <Download className="mr-2 size-5" /> Generar y Descargar Standalone HTML
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
