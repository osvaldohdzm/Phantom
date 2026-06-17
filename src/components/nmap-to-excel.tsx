'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, ShieldAlert, Loader2, Trash2, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { NmapResult, parseNmapFile } from '@/lib/nmap-parser';

export function NmapToExcel() {
  const [results, setResults] = useState<NmapResult[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [selectedFileFilter, setSelectedFileFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(`[DEBUG] ${msg}`);
    setDebugLogs((prev) => [...prev.slice(-14), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const filteredResults =
    selectedFileFilter === 'all' ? results : results.filter((r) => r.Archivo === selectedFileFilter);

  const handleFilesUpload = async (files: FileList | File[]) => {
    addLog(`>>> Inicio de carga: ${files.length} archivos detectados`);
    if (!files || files.length === 0) {
      addLog('ERROR: No hay archivos');
      return;
    }

    setIsParsing(true);
    setError(null);
    const filesArray = Array.from(files);
    const newFileNames = filesArray.map((f) => f.name);

    addLog(`Archivos: ${newFileNames.join(', ')}`);
    setFileNames((prev) => Array.from(new Set([...prev, ...newFileNames])));

    const allNewResults: NmapResult[] = [];
    try {
      for (const file of filesArray) {
        addLog(`Leyendo: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        try {
          const text = await file.text();
          addLog(`Contenido (primeros 40 carácteres): "${text.substring(0, 40).replace(/\n/g, ' ')}..."`);
          const fileResults = parseNmapFile(text, file.name);
          addLog(`Parseo completado: ${fileResults.length} servicios encontrados en ${file.name}`);
          if (fileResults.length === 0) {
            addLog(`AVISO: ${file.name} no devolvió resultados.`);
          }
          allNewResults.push(...fileResults);
        } catch (err: unknown) {
          const m = err instanceof Error ? err.message : String(err);
          addLog(`ERROR PARSEANDO ${file.name}: ${m}`);
        }
      }

      addLog(`Resultados totales en esta carga: ${allNewResults.length}`);
      setResults((prev) => [...prev, ...allNewResults]);

      if (allNewResults.length > 0) {
        if (filesArray.length === 1) {
          setSelectedFileFilter(filesArray[0].name);
        } else {
          setSelectedFileFilter('all');
        }
      } else {
        setError("No se encontraron servicios 'open'. Verifica el formato del archivo.");
      }
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      addLog(`FALLO CRÍTICO: ${m}`);
      setError('Error crítico al procesar.');
    } finally {
      setIsParsing(false);
      addLog('>>> Proceso finalizado');
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      addLog('Archivos soltados (Drag & Drop)');
      void handleFilesUpload(acceptedFiles);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleExport = async () => {
    if (results.length === 0) return;
    try {
      addLog('Iniciando exportación Excel...');
      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(results);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Nmap Report');
      XLSX.writeFile(workbook, `Nmap_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      addLog('Exportación completada');
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      addLog(`ERROR EXPORTANDO: ${m}`);
      setError('Error al exportar Excel.');
    }
  };

  const clearData = () => {
    addLog('Limpiando todos los datos');
    setResults([]);
    setFileNames([]);
    setSelectedFileFilter('all');
    setError(null);
  };

  return (
    <main className="min-h-full text-slate-50 p-6 md:p-10 selection:bg-emerald-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"
            >
              Parser Nmap → Excel
            </motion.h1>
            <p className="text-slate-400 mt-2">
              Herramienta de reconocimiento: exporta superficie de ataque a hojas compatibles con el flujo
              Phantom.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
            onClick={() => window.open('https://nmap.org/book/output-formats.html', '_blank')}
          >
            Formatos Nmap
          </Button>
        </header>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-400 text-sm flex items-center gap-3"
          >
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p>{error}</p>
            <button type="button" onClick={() => setError(null)} className="ml-auto hover:text-red-200">
              ✕
            </button>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-emerald-400 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Cargar archivos
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Arrastra salidas Nmap o selecciónalas manualmente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps({
                    onClick: () => addLog('Click en zona de carga'),
                  })}
                  className={cn(
                    'relative group cursor-pointer border-2 border-dashed rounded-xl p-8 transition-all duration-300 flex flex-col items-center justify-center text-center',
                    isDragActive || isParsing
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-950/50'
                  )}
                >
                  <input {...getInputProps()} className="hidden" accept=".xml,.gnmap,.nmap,.txt,*" />
                  <motion.div
                    animate={isDragActive || isParsing ? { scale: 1.1 } : { scale: 1 }}
                    className={cn(
                      'p-4 rounded-full mb-4 transition-colors',
                      isDragActive || isParsing
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400 group-hover:text-emerald-400'
                    )}
                  >
                    {isParsing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                  </motion.div>
                  <div className="max-w-full overflow-hidden relative z-0">
                    <p className="font-medium text-slate-200 truncate px-2">
                      {isParsing
                        ? 'Procesando archivos...'
                        : fileNames.length > 0
                          ? `${fileNames.length} archivo(s) listos`
                          : 'Seleccionar archivos'}
                    </p>
                    {fileNames.length > 0 && !isParsing && (
                      <p className="text-[10px] text-emerald-500 mt-1 truncate px-2 font-mono">
                        {fileNames[fileNames.length - 1]}{' '}
                        {fileNames.length > 1 && `(+${fileNames.length - 1})`}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 relative z-0">
                    {isParsing ? 'Esto puede tardar unos segundos' : 'o arrastra y suelta aquí'}
                  </p>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                    disabled={results.length === 0 || isParsing}
                    onClick={() => void handleExport()}
                  >
                    <FileSpreadsheet className="mr-2 w-5 h-5" />
                    Exportar a Excel
                  </Button>
                  {results.length > 0 && (
                    <Button
                      variant="ghost"
                      className="text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                      onClick={clearData}
                    >
                      <Trash2 className="mr-2 w-4 h-4" />
                      Limpiar datos
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-xl">
              <CardHeader>
                <CardTitle className="text-cyan-400 text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Privacidad
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-400 space-y-2">
                <p>Procesamiento en el navegador; ideal para datos sensibles de pentest.</p>
                <p>La integración con API e IA del backend es opcional y configurable.</p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl h-full flex flex-col">
              <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800/50 pb-6 gap-4">
                <div>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    Vista previa
                    {results.length > 0 && (
                      <span className="text-xs font-normal px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                        {filteredResults.length} servicios
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>Datos alineados a inventario / superficie de ataque.</CardDescription>
                </div>
                {results.length > 0 && (
                  <div className="flex items-center gap-2 bg-slate-950/50 p-1 rounded-lg border border-slate-800">
                    <Filter className="w-4 h-4 text-slate-500 ml-2" />
                    <select
                      value={selectedFileFilter}
                      onChange={(e) => {
                        addLog(`Filtro cambiado a: ${e.target.value}`);
                        setSelectedFileFilter(e.target.value);
                      }}
                      className="bg-transparent text-xs text-slate-300 border-none focus:ring-0 cursor-pointer py-1 pr-8 outline-none"
                    >
                      <option value="all" className="bg-slate-900">
                        Todos los archivos
                      </option>
                      {fileNames.map((name) => (
                        <option key={name} value={name} className="bg-slate-900">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </CardHeader>
              <CardContent className="grow p-0 overflow-hidden relative">
                <AnimatePresence mode="wait">
                  {results.length > 0 ? (
                    <motion.div
                      key={selectedFileFilter}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="max-h-[560px] overflow-auto"
                    >
                      <Table>
                        <TableHeader className="bg-slate-950 sticky top-0 z-10 shadow-sm">
                          <TableRow className="border-slate-800 hover:bg-transparent">
                            <TableHead className="text-slate-400 font-bold">IP</TableHead>
                            <TableHead className="text-slate-400 font-bold text-center">Puerto</TableHead>
                            <TableHead className="text-slate-400 font-bold">Servicio</TableHead>
                            <TableHead className="text-slate-400 font-bold">Versión</TableHead>
                            {selectedFileFilter === 'all' && (
                              <TableHead className="text-slate-400 font-bold">Archivo</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredResults.map((result, index) => (
                            <TableRow
                              key={`${result.IP}-${result.Puerto}-${index}`}
                              className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                            >
                              <TableCell className="font-mono text-cyan-400">{result.IP}</TableCell>
                              <TableCell className="text-center font-bold text-emerald-400">{result.Puerto}</TableCell>
                              <TableCell className="text-slate-300">{result.Servicio}</TableCell>
                              <TableCell className="text-slate-500 text-xs italic">{result.Versión}</TableCell>
                              {selectedFileFilter === 'all' && (
                                <TableCell className="text-slate-600 text-[10px] truncate max-w-[100px]">
                                  {result.Archivo}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-72 text-slate-600 space-y-4"
                    >
                      <div className="p-6 rounded-full bg-slate-950/50 border border-slate-800/50">
                        <FileSpreadsheet className="w-12 h-12 opacity-20" />
                      </div>
                      <p className="text-sm px-8 text-center">
                        No hay datos. Sube GNMAP, XML o TXT de Nmap.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>

        {debugLogs.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-black border border-emerald-500/30 rounded-lg overflow-hidden shadow-2xl">
              <div className="bg-slate-900 px-4 py-2 flex justify-between items-center border-b border-emerald-500/20">
                <span className="font-mono text-[10px] text-emerald-400 font-bold tracking-widest">
                  LOG DE HERRAMIENTA
                </span>
                <button
                  type="button"
                  onClick={() => setDebugLogs([])}
                  className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors font-mono"
                >
                  [ LIMPIAR ]
                </button>
              </div>
              <div className="p-4 font-mono text-[11px] text-emerald-400/80 h-40 overflow-y-auto bg-slate-950/50">
                {debugLogs.map((log, i) => (
                  <div key={i} className="mb-1 border-l-2 border-emerald-500/20 pl-2">
                    <span className="text-emerald-900 mr-2">{'>'}</span>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
