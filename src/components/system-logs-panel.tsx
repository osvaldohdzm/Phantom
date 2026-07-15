'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { Terminal, RefreshCw, Download, Search, AlertCircle, FileText, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSystemLogs, type SystemLogsResponse } from '@/lib/secops-api';

export function SystemLogsPanel() {
  const [logsData, setLogsData] = useState<SystemLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linesCount, setLinesCount] = useState(200);
  const [filterQuery, setFilterQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement | null>(null);
  const consoleContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchLogs = async (lines = linesCount) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSystemLogs(lines);
      setLogsData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al recuperar logs del sistema');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, [linesCount]);

  // Scroll to bottom when new logs are loaded if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsData, autoScroll]);

  // Highlight specific HTTP methods, status codes, and levels in uvicorn logs
  const formatLogLine = (line: string) => {
    if (!line) return '';

    // Simple parser to color HTTP requests and warnings/errors
    let formatted = line;
    const parts = [];

    // Check level/method and color appropriately
    if (line.includes('INFO') || line.includes('info:')) {
      parts.push(<span key="level" className="text-emerald-500 font-semibold">[INFO]</span>);
    } else if (line.includes('WARNING') || line.includes('warn:')) {
      parts.push(<span key="level" className="text-amber-500 font-semibold">[WARN]</span>);
    } else if (line.includes('ERROR') || line.includes('error:')) {
      parts.push(<span key="level" className="text-rose-500 font-bold">[ERROR]</span>);
    }

    // Color HTTP verbs
    const verbMatch = line.match(/"(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b/);
    let verbColor = 'text-cyan-400';
    if (verbMatch) {
      const verb = verbMatch[1];
      if (verb === 'GET') verbColor = 'text-green-400';
      if (verb === 'POST') verbColor = 'text-cyan-400';
      if (verb === 'PUT') verbColor = 'text-yellow-400';
      if (verb === 'DELETE') verbColor = 'text-rose-400';
    }

    // Color HTTP Status Codes (2xx, 3xx, 4xx, 5xx)
    const statusMatch = line.match(/\b(20\d|30\d|40\d|50\d)\b/);
    let statusSpan = null;
    if (statusMatch) {
      const status = statusMatch[1];
      let statusColor = 'text-emerald-400';
      if (status.startsWith('3')) statusColor = 'text-cyan-300';
      if (status.startsWith('4')) statusColor = 'text-amber-400';
      if (status.startsWith('5')) statusColor = 'text-rose-500 font-bold';
      statusSpan = <span className={statusColor}>{status}</span>;
    }

    // Return the line as is if it has no matches, else build formatted view
    return (
      <div className="hover:bg-muted/10 px-2 py-0.5 rounded transition-colors whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
        {line.includes('INFO') || line.includes('WARNING') || line.includes('ERROR') ? (
          <>
            {line.split(/INFO|WARNING|ERROR/).map((text, idx, arr) => (
              <span key={idx}>
                {text}
                {idx < arr.length - 1 && (
                  line.includes('INFO') ? (
                    <span className="text-emerald-400 font-medium">INFO</span>
                  ) : line.includes('WARNING') ? (
                    <span className="text-amber-400 font-medium">WARNING</span>
                  ) : (
                    <span className="text-rose-500 font-bold">ERROR</span>
                  )
                )}
              </span>
            ))}
          </>
        ) : (
          line
        )}
      </div>
    );
  };

  const filteredLines = useMemo(() => {
    if (!logsData?.lines) return [];
    if (!filterQuery.trim()) return logsData.lines;
    const query = filterQuery.toLowerCase();
    return logsData.lines.filter((line) => line.toLowerCase().includes(query));
  }, [logsData, filterQuery]);

  const handleDownload = () => {
    if (!logsData?.lines) return;
    const blob = new Blob([logsData.lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'phantom_server.log';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyPath = () => {
    if (logsData?.log_path) {
      void navigator.clipboard.writeText(logsData.log_path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-border/40 shadow-md">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Terminal className="size-5 text-cyan-500 animate-pulse" />
              Logs de la Aplicación
            </CardTitle>
            <CardDescription className="text-xs">
              Consola de ejecución del servidor en tiempo real (uvicorn backend + HTTP access logs).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              Líneas:
              <select
                className="h-8 rounded-lg border border-input bg-background/50 px-2 text-[10px] focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                value={linesCount}
                onChange={(e) => setLinesCount(Number(e.target.value))}
              >
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
              </select>
            </label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchLogs()}
              disabled={loading}
              className="h-8 px-3 text-xs border-border/60 hover:bg-muted/40 font-medium"
            >
              <RefreshCw className={`size-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!logsData?.exists}
              className="h-8 px-3 text-xs border-border/60 hover:bg-muted/40 font-medium"
            >
              <Download className="size-3.5 mr-1" />
              Descargar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Info bar: path & status */}
        {logsData && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/20 border border-border/40 rounded-xl text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="size-4 text-cyan-500 shrink-0" />
              <span className="text-muted-foreground font-medium shrink-0">Ruta del archivo:</span>
              <span className="font-mono text-foreground font-medium truncate select-all px-1.5 py-0.5 rounded bg-muted/60" title={logsData.log_path}>
                {logsData.log_path}
              </span>
              <button
                type="button"
                onClick={handleCopyPath}
                className="p-1 rounded hover:bg-muted/80 text-muted-foreground"
                title="Copiar ruta"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <FileText className="size-3" />}
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/20">
              {logsData.message}
            </div>
          </div>
        )}

        {/* Search Filter */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filtrar logs por término (ej. GET, POST, /api/v1/vault, ERROR)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full h-9 pl-10 pr-4 rounded-lg border border-input bg-background/40 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="p-4 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-600 text-xs flex items-start gap-2">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Error al cargar logs</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Logs Console Container */}
        {logsData?.exists ? (
          <div className="space-y-2">
            <div
              ref={consoleContainerRef}
              className="bg-[#0f141c] text-[#a5b4fc] border border-border/40 rounded-xl p-4 overflow-y-auto max-h-[480px] min-h-[250px] scrollbar-thin shadow-inner"
            >
              {filteredLines.length === 0 ? (
                <div className="text-center py-20 text-xs text-muted-foreground italic font-mono">
                  {filterQuery ? 'No se encontraron líneas que coincidan con el filtro' : 'Archivo de logs vacío'}
                </div>
              ) : (
                <div className="flex flex-col space-y-0.5">
                  {filteredLines.map((line, idx) => (
                    <div key={idx}>{formatLogLine(line)}</div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-input text-cyan-500 accent-cyan-500"
                />
                Auto-desplazamiento al final
              </label>
              <span>
                Mostrando {filteredLines.length} de {logsData.lines.length} líneas
              </span>
            </div>
          </div>
        ) : (
          !loading && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-4">
              <AlertCircle className="size-10 mx-auto text-amber-500 animate-pulse" />
              <div className="max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-foreground">Consola de Logs Inactiva</h3>
                <p className="text-xs text-muted-foreground mt-2">
                  No se detectó el archivo de logs en la ruta especificada. Asegúrate de que el servidor FastAPI está iniciado nativamente y redirecciona sus logs a:
                </p>
                <p className="text-[10px] text-foreground font-mono bg-muted/60 px-2 py-1.5 rounded-lg border border-border/20 mt-2 select-all">
                  {logsData?.log_path || 'storage/logs/phantom.log'}
                </p>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Ejecuta Phantom usando <code className="font-mono bg-muted px-1 py-0.5 rounded">./phantom dev</code> o <code className="font-mono bg-muted px-1 py-0.5 rounded">./phantom start</code> para que los logs se generen correctamente.
                </p>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
