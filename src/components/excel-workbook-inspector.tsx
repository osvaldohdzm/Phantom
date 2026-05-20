'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  Search,
  ScrollText,
  Table2,
  Layers,
  AlertCircle,
  CheckCircle2,
  Download,
  ChevronDown,
  ChevronUp,
  History,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { inspectWorkbookFromBuffer, type InspectResult } from '@/lib/xlsx-inspect';
import {
  clearSavedExcelInspect,
  loadSavedExcelInspect,
  saveExcelInspect,
  type SavedExcelInspect,
  type SavedExcelInspectSummary,
} from '@/lib/excel-inspect-storage';

type LogLevel = 'aviso' | 'info' | 'error';

type LogEntry = { t: string; level: LogLevel; message: string };

const categoryStyles: Record<string, string> = {
  Tablero: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  'Alcance / SoW': 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  Evaluaciones: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
  Vulnerabilidades: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  Catálogos: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  'Superficie / Inventario': 'bg-sky-500/15 text-sky-200 border-sky-500/25',
  'Seguimiento / Reportes': 'bg-orange-500/15 text-orange-200 border-orange-500/25',
  Explotación: 'bg-red-600/20 text-red-300 border-red-500/30',
  General: 'bg-slate-700/40 text-slate-400 border-slate-600/40',
};

const LOG_PREVIEW_CHARS = 960;

function pushLog(set: React.Dispatch<React.SetStateAction<LogEntry[]>>, level: LogLevel, message: string) {
  const t = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  set((prev) => [...prev.slice(-400), { t, level, message }]);
}

function LogLine({
  entry,
  expanded,
  onToggle,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const long = entry.message.length > LOG_PREVIEW_CHARS;
  const body = !long || expanded ? entry.message : `${entry.message.slice(0, LOG_PREVIEW_CHARS)}…`;
  return (
    <div
      className={cn(
        'border-l-2 pl-2 py-0.5 whitespace-pre-wrap break-words',
        entry.level === 'aviso' && 'border-amber-500/60 text-amber-200/90',
        entry.level === 'info' && 'border-slate-600 text-slate-400',
        entry.level === 'error' && 'border-red-500/70 text-red-300'
      )}
    >
      <span className="text-slate-600">{entry.t}</span>{' '}
      <span className="text-slate-500">
        {entry.level === 'aviso' ? 'Aviso' : entry.level === 'error' ? 'Error' : 'Información'}
      </span>
      <br />
      <span className="text-emerald-100/85">{body}</span>
      {long && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 font-mono"
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3" /> Contraer
            </>
          ) : (
            <>
              <ChevronDown className="size-3" /> Expandir ({entry.message.length.toLocaleString()} caracteres)
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function ExcelWorkbookInspector() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logExpanded, setLogExpanded] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InspectResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [savedOffer, setSavedOffer] = useState<
    null | { mode: 'full'; payload: SavedExcelInspect } | { mode: 'summary'; payload: SavedExcelInspectSummary }
  >(null);

  useEffect(() => {
    const s = loadSavedExcelInspect();
    if (!s) return;
    if ('summaryOnly' in s && s.summaryOnly) setSavedOffer({ mode: 'summary', payload: s });
    else setSavedOffer({ mode: 'full', payload: s as SavedExcelInspect });
  }, []);

  const selectedSheet = useMemo(() => {
    if (!result || !selected) return null;
    return result.sheets.find((s) => s.name === selected) ?? null;
  }, [result, selected]);

  const filteredSheets = useMemo(() => {
    if (!result) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return result.sheets;
    return result.sheets.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    );
  }, [result, filter]);

  const runInspect = useCallback(
    async (file: File) => {
      setError(null);
      setBusy(true);
      setLogs([]);
      pushLog(setLogs, 'aviso', 'Se inició la ejecución');
      try {
        pushLog(setLogs, 'info', `Archivo: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        const buf = await file.arrayBuffer();
        pushLog(setLogs, 'info', 'Leyendo libro de Excel…');
        const res = await inspectWorkbookFromBuffer(file.name, buf);
        setResult(res);
        setSelected(res.sheets[0]?.name ?? null);
        pushLog(setLogs, 'info', `Iniciando análisis de ${res.sheetCount} hojas…`);
        for (const sh of res.sheets) {
          pushLog(
            setLogs,
            'info',
            `--- HOJA: ${sh.name} ---\nColumnas: ${sh.headers.join(' | ') || '(vacío)'}\nFilas estimadas: ${sh.rowCount}`
          );
          const preview = sh.sampleRows.slice(1, 4);
          if (preview.length) {
            pushLog(setLogs, 'info', `Ejemplo de datos (${preview.length} filas): ${JSON.stringify(preview, null, 0).slice(0, 3500)}`);
          }
        }
        pushLog(setLogs, 'aviso', `Se completó la ejecución (${res.durationMs} ms)`);
        saveExcelInspect(res);
        setSavedOffer(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        pushLog(setLogs, 'error', msg);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const onDrop = useCallback(
    (files: File[]) => {
      const f = files[0];
      if (f) void runInspect(f);
    },
    [runInspect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    disabled: busy,
  });

  const clearAll = () => {
    setResult(null);
    setSelected(null);
    setLogs([]);
    setLogExpanded({});
    setError(null);
    setFilter('');
    clearSavedExcelInspect();
    setSavedOffer(null);
  };

  const restoreFromStorage = () => {
    if (!savedOffer || savedOffer.mode !== 'full') return;
    const { result: r } = savedOffer.payload;
    setResult(r);
    setSelected(r.sheets[0]?.name ?? null);
    setLogs([]);
    setLogExpanded({});
    pushLog(setLogs, 'aviso', 'Sesión restaurada desde el almacenamiento local del navegador');
    pushLog(setLogs, 'info', `Archivo: ${r.fileName} · ${r.sheetCount} hojas · guardado ${new Date(savedOffer.payload.savedAt).toLocaleString('es-MX')}`);
    setSavedOffer(null);
  };

  const dismissSavedOffer = () => {
    clearSavedExcelInspect();
    setSavedOffer(null);
  };

  const exportLogTxt = () => {
    const body = logs.map((l) => `${l.t}\t${l.level}\t${l.message.replace(/\n/g, '↵ ')}`).join('\n');
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spectre-excel-registro-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-full p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Ingesta · Paridad Excel</p>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-50 tracking-tight">Inspector de libro Excel</h1>
          <p className="text-slate-400 mt-2 max-w-3xl text-sm leading-relaxed">
            Equivalente al flujo de <span className="text-slate-300">Código.gs</span>: analiza todas las hojas
            (Tablero, SoW, Evaluaciones, Catálogo vulnerabilidades, Seguimiento, etc.), muestra columnas y muestras de
            filas, y mantiene un <span className="text-slate-300">registro de ejecución</span> auditable. Todo ocurre
            en el navegador.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {result && (
            <Button variant="outline" className="border-slate-700 text-slate-300" onClick={clearAll} type="button">
              Limpiar
            </Button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle className="size-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {savedOffer && (
        <div className="rounded-xl border border-violet-500/35 bg-violet-950/30 px-4 py-3 text-sm text-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <History className="size-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-slate-100">
                {savedOffer.mode === 'full'
                  ? 'Hay una sesión de inspección guardada en este navegador'
                  : 'Última sesión guardada en modo resumido (libro muy grande)'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {savedOffer.mode === 'full'
                  ? `${savedOffer.payload.result.fileName} · ${savedOffer.payload.result.sheetCount} hojas · ${new Date(savedOffer.payload.savedAt).toLocaleString('es-MX')}`
                  : `${savedOffer.payload.fileName} · ${savedOffer.payload.sheetCount} hojas (sin muestras en disco)`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {savedOffer.mode === 'full' && (
              <Button
                type="button"
                size="sm"
                className="bg-violet-600 hover:bg-violet-500 text-white"
                onClick={restoreFromStorage}
              >
                Restaurar vista
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={dismissSavedOffer}>
              Olvidar guardado
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-3 space-y-4">
          <Card className="bg-slate-900/90 border-slate-800 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                <Upload className="size-4 text-violet-400" />
                Cargar .xlsx
              </CardTitle>
              <CardDescription className="text-xs">Un libro a la vez (formato Office Open XML).</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={cn(
                  'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
                  busy
                    ? 'border-slate-600 bg-slate-950/80'
                    : isDragActive
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
                )}
              >
                <input {...getInputProps()} />
                {busy ? (
                  <Loader2 className="size-10 mx-auto text-violet-400 animate-spin mb-3" />
                ) : (
                  <FileSpreadsheet className="size-10 mx-auto text-slate-500 mb-3" />
                )}
                <p className="text-sm text-slate-300 font-medium">
                  {busy ? 'Analizando…' : 'Arrastra aquí o haz clic'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Compatible con plantillas de pentest / vulns.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/90 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-200 flex items-center gap-2">
                <Layers className="size-4 text-cyan-400" />
                Hojas ({result?.sheetCount ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar por nombre…"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-violet-500/50"
                  disabled={!result}
                />
              </div>
              <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
                {!result && (
                  <p className="text-xs text-slate-500 py-4 text-center">Sube un archivo para listar hojas.</p>
                )}
                {filteredSheets.map((sh) => (
                  <button
                    key={sh.name}
                    type="button"
                    onClick={() => setSelected(sh.name)}
                    className={cn(
                      'w-full text-left rounded-lg border px-2.5 py-2 transition-colors',
                      selected === sh.name
                        ? 'border-violet-500/50 bg-violet-500/10'
                        : 'border-transparent hover:bg-slate-800/60'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-200 truncate">{sh.name}</span>
                      <span className="text-[10px] font-mono text-slate-500 shrink-0">{sh.rowCount}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          'inline-block text-[10px] px-1.5 py-0.5 rounded border',
                          categoryStyles[sh.category] ?? categoryStyles.General
                        )}
                      >
                        {sh.category}
                      </span>
                      <span
                        className="text-[9px] font-mono text-slate-500 px-1 py-0.5 rounded bg-slate-950/80 border border-slate-800/80 max-w-full truncate"
                        title="Pista para ingesta API"
                      >
                        {sh.entityHint}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-5 space-y-4">
          <Card className="bg-slate-900/90 border-slate-800 min-h-[320px]">
            <CardHeader className="border-b border-slate-800/80 pb-3">
              <CardTitle className="text-base text-slate-100 flex items-center gap-2">
                <Table2 className="size-4 text-emerald-400" />
                Vista de hoja
              </CardTitle>
              <CardDescription className="text-xs">
                {selectedSheet ? (
                  <>
                    <span className="text-slate-400">{selectedSheet.name}</span>
                    <span className="text-slate-600 mx-1">·</span>
                    <span>
                      {selectedSheet.colCount} columnas · ~{selectedSheet.rowCount} filas ·{' '}
                      <code className="text-slate-500">{selectedSheet.entityHint}</code>
                    </span>
                  </>
                ) : (
                  'Selecciona una hoja en la lista.'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <AnimatePresence mode="wait">
                {selectedSheet ? (
                  <motion.div
                    key={selectedSheet.name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSheet.headers.map((h, i) => (
                        <span
                          key={`${h}-${i}`}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 max-w-[200px] truncate"
                          title={h}
                        >
                          {h || `·`}
                        </span>
                      ))}
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-800">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-slate-950 text-left text-slate-500">
                            {selectedSheet.headers.slice(0, selectedSheet.sampleRows[0]?.length ?? 0).map((h, i) => (
                              <th key={i} className="px-2 py-2 font-medium border-b border-slate-800 whitespace-nowrap">
                                {h || `#${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSheet.sampleRows.map((row, ri) => (
                            <tr key={ri} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-2 py-1.5 text-slate-400 max-w-[220px] truncate font-mono">
                                  {String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-600 text-sm">
                    <Table2 className="size-10 opacity-20 mb-2" />
                    Sin vista previa
                  </div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-4">
          <Card className="bg-slate-950 border border-emerald-900/40 h-full flex flex-col min-h-[480px]">
            <CardHeader className="border-b border-emerald-900/30 pb-3">
              <CardTitle className="text-sm font-mono text-emerald-400/95 flex items-center gap-2 tracking-wide">
                <ScrollText className="size-4" />
                REGISTRO DE EJECUCIÓN
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Aviso · Información · Error (orden cronológico). Mensajes largos se pueden expandir.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 min-h-0">
              <div className="h-[min(60vh,560px)] overflow-y-auto font-mono text-[11px] leading-relaxed px-3 py-2 space-y-2">
                {logs.length === 0 && !busy && (
                  <p className="text-slate-600 px-1 py-6 text-center">Los mensajes aparecerán aquí al procesar.</p>
                )}
                {logs.map((l, i) => (
                  <LogLine
                    key={`${l.t}-${i}-${l.message.slice(0, 24)}`}
                    entry={l}
                    expanded={!!logExpanded[i]}
                    onToggle={() =>
                      setLogExpanded((prev) => ({
                        ...prev,
                        [i]: !prev[i],
                      }))
                    }
                  />
                ))}
              </div>
              {logs.length > 0 && (
                <div className="border-t border-emerald-900/30 p-2 flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[10px] text-slate-500 hover:text-cyan-400 font-mono h-7 gap-1"
                    onClick={exportLogTxt}
                  >
                    <Download className="size-3" />
                    Exportar .txt
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[10px] text-slate-500 hover:text-emerald-400 font-mono h-7"
                    onClick={() => {
                      setLogs([]);
                      setLogExpanded({});
                    }}
                  >
                    [ LIMPIAR LOG ]
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="py-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-500/80" />
            Procesamiento local (sin enviar el Excel al servidor)
          </span>
          <span className="hidden sm:inline text-slate-700">|</span>
          <span>
            Las hojas muestran una pista <code className="text-slate-500">entityHint</code> para mapear a entidades API;
            la última ejecución se guarda en este navegador (localStorage).
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
