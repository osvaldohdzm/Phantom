'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileText,
  Loader2,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Upload,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { checkApiHealth, getApiBaseUrlLabel } from '@/lib/api-base';
import {
  deleteDocxTemplate,
  deleteReportJob,
  generateFindingsTable,
  syncFindingsFromCatalogApi,
  generateDocxReport,
  getReportJob,
  listDocxTemplates,
  listAllFindingsForEngagement,
  listReportJobs,
  reportDownloadUrl,
  uploadDocxTemplate,
  waitForReportJob,
  type DocxTemplate,
  type GenerateReportResult,
  type ReportJobHistoryItem,
} from '@/lib/secops-api';
import { groupFindingsForDisplay } from '@/lib/finding-grouping';
import { WordTemplatePlaceholdersGuide } from '@/components/word-template-placeholders-guide';

function formatReportDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function reportStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completado';
    case 'failed':
      return 'Error';
    case 'processing':
      return 'Generando';
    default:
      return status;
  }
}

export function DocxReportsPanel({
  engagementId,
  selectedFindingIds,
}: {
  engagementId?: string;
  selectedFindingIds?: string[];
}) {
  const [templates, setTemplates] = useState<DocxTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [onlyValidated, setOnlyValidated] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GenerateReportResult | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportJobHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [findingStats, setFindingStats] = useState<{
    total: number;
    validated: number;
    grouped: number;
  } | null>(null);
  const [generateStatus, setGenerateStatus] = useState<string | null>(null);
  const [tableResult, setTableResult] = useState<{
    rows: number;
    findings: number;
    jobId?: string;
  } | null>(null);

  const probeApi = useCallback(async () => {
    const ok = await checkApiHealth();
    setApiOnline(ok);
    return ok;
  }, []);

  const loadFindingStats = useCallback(async () => {
    if (!engagementId) {
      setFindingStats(null);
      return;
    }
    try {
      const { findings: all, totalInDb } = await listAllFindingsForEngagement(engagementId);
      const validated = all.filter((f) => f.status === 'Validado').length;
      const grouped = groupFindingsForDisplay(all).length;
      setFindingStats({ total: totalInDb || all.length, validated, grouped });
    } catch {
      setFindingStats(null);
    }
  }, [engagementId]);

  const loadReportHistory = useCallback(async () => {
    if (!engagementId) {
      setReportHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const jobs = await listReportJobs(engagementId);
      setReportHistory(jobs);
    } catch {
      setReportHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [engagementId]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    await probeApi();
    try {
      const data = await listDocxTemplates();
      setTemplates(data);
      if (data.length && !selectedTemplateId) setSelectedTemplateId(data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateId, probeApi]);

  useEffect(() => {
    void loadTemplates();
    void loadFindingStats();
    void loadReportHistory();
  }, [loadTemplates, loadFindingStats, loadReportHistory]);

  const onDropTemplate = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const name = templateName.trim() || file.name.replace(/\.docx$/i, '');
      setBusy('upload');
      setError(null);
      try {
        await uploadDocxTemplate(file, name, templateDesc || undefined);
        setTemplateName('');
        setTemplateDesc('');
        await loadTemplates();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al subir plantilla');
      } finally {
        setBusy(null);
      }
    },
    [templateName, templateDesc, loadTemplates]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDropTemplate(files),
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    disabled: busy === 'upload',
  });

  const syncCatalogBeforeExport = async () => {
    if (!engagementId) return;
    const sync = await syncFindingsFromCatalogApi({
      engagement_id: engagementId,
      finding_ids: selectedFindingIds?.length ? selectedFindingIds : undefined,
      only_validated: onlyValidated,
    });
    if (sync.synced > 0) {
      await loadFindingStats();
    }
    return sync;
  };

  const handleGenerateFindingsTable = async () => {
    if (!engagementId) {
      setError('Selecciona un proyecto en el paso 1 antes de generar la tabla.');
      return;
    }
    setBusy('table');
    setError(null);
    setTableResult(null);
    try {
      setGenerateStatus('Sincronizando catálogo operativo con hallazgos…');
      await syncCatalogBeforeExport();
      setGenerateStatus('Generando tabla de hallazgos…');
      const result = await generateFindingsTable({
        engagement_id: engagementId,
        finding_ids: selectedFindingIds?.length ? selectedFindingIds : undefined,
        only_validated: onlyValidated,
      });
      const link = document.createElement('a');
      link.href = reportDownloadUrl(result.download_url);
      link.download = 'Tabla_de_hallazgos.docx';
      link.click();
      setTableResult({
        rows: result.grouped_rows,
        findings: result.findings_count,
        jobId: result.job_id,
      });
      await loadReportHistory();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al generar tabla de hallazgos';
      if (msg.includes('No hay hallazgos')) {
        setError(
          onlyValidated
            ? `${msg} — Desmarca «Solo hallazgos validados» o valida los hallazgos en el paso 3.`
            : `${msg} — Guarda hallazgos en el paso 3 (deben estar en la base de datos).`
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
      setGenerateStatus(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplateId) return;
    if (!engagementId) {
      setError('Selecciona un proyecto en el paso 1 antes de generar el Word.');
      return;
    }
    setBusy('generate');
    setError(null);
    setLastResult(null);
    setGenerateStatus(null);
    try {
      setGenerateStatus('Sincronizando catálogo operativo con hallazgos…');
      await syncCatalogBeforeExport();
      setGenerateStatus('Iniciando generación Word…');
      const started = await generateDocxReport({
        template_id: selectedTemplateId,
        engagement_id: engagementId,
        finding_ids: selectedFindingIds?.length ? selectedFindingIds : undefined,
        only_validated: onlyValidated,
      });
      setGenerateStatus(
        `Agrupando ${started.findings_count} hallazgos y generando tablas Word… puede tardar varios minutos.`
      );
      const finishedJob = await waitForReportJob(started.job_id, {
        onStatus: (job) => {
          if (job.status === 'processing') {
            setGenerateStatus(
              `Agrupando ${job.findings_count} hallazgos en tablas Word…`
            );
          }
        },
      });
      const jobDetail = await getReportJob(started.job_id);
      const tableCount = jobDetail.individual_paths?.length ?? finishedJob.findings_count;
      const result: GenerateReportResult = {
        ...started,
        status: 'completed',
        individual_count: tableCount,
        message: `Reporte generado: ${tableCount} tabla${tableCount === 1 ? '' : 's'} Word (${started.findings_count} hallazgos agrupados)`,
      };
      setLastResult(result);
      setGenerateStatus(null);
      await loadFindingStats();
      await loadReportHistory();
    } catch (e) {
      setGenerateStatus(null);
      const msg = e instanceof Error ? e.message : 'Error al generar reporte';
      if (msg.includes('No hay hallazgos')) {
        setError(
          onlyValidated
            ? `${msg} — Desmarca «Solo hallazgos validados» o valida los hallazgos en el paso 3.`
            : `${msg} — Guarda hallazgos en el paso 3 (deben estar en la base de datos).`
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteJob = async (job: ReportJobHistoryItem) => {
    if (!window.confirm(`¿Eliminar el reporte del ${formatReportDate(job.created_at)}?`)) return;
    setBusy(`job-${job.id}`);
    setError(null);
    try {
      await deleteReportJob(job.id);
      if (lastResult?.job_id === job.id) setLastResult(null);
      await loadReportHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar reporte');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `¿Eliminar la plantilla «${name}»?\n\nTambién se borrarán los reportes Word generados con esta plantilla (historial y archivos).`
      )
    ) {
      return;
    }
    setBusy(`del-${id}`);
    setError(null);
    try {
      const result = await deleteDocxTemplate(id);
      await loadTemplates();
      if (engagementId) await loadReportHistory();
      if (result.jobs_removed && result.jobs_removed > 0) {
        setGenerateStatus(
          `Plantilla eliminada (${result.jobs_removed} reporte${result.jobs_removed === 1 ? '' : 's'} asociado${result.jobs_removed === 1 ? '' : 's'} borrado${result.jobs_removed === 1 ? '' : 's'}).`
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4 text-violet-600 dark:text-violet-300" />
            Guardar plantilla Word (.docx)
          </CardTitle>
          <CardDescription>
            Usa marcadores «Nombre de columna» como en CYB001. Al subir el .docx se detectan
            automáticamente. La sección <strong className="font-medium text-foreground">DETALLE DE
            PRUEBAS DE SEGURIDAD</strong> no es un marcador: el encabezado va fijo en la plantilla y
            el contenido se reemplaza con «Método de detección», «Salidas de herramienta» y
            «Explicación técnica».
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              placeholder="Nombre de la plantilla"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="text-sm"
            />
            <Input
              placeholder="Descripción (opcional)"
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              className="text-sm"
            />
          </div>
          <div
            {...getRootProps()}
            className={cn(
              'rounded-lg border border-dashed px-4 py-8 text-center text-xs cursor-pointer transition-colors',
              isDragActive
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50',
              busy === 'upload' && 'opacity-60 pointer-events-none'
            )}
          >
            <input {...getInputProps()} />
            {busy === 'upload' ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Subiendo plantilla…
              </span>
            ) : (
              <span className="text-muted-foreground">Arrastra tu .docx o haz clic para seleccionar</span>
            )}
          </div>
          <WordTemplatePlaceholdersGuide />
        </CardContent>
      </Card>

      <Card className="bg-card border-emerald-500/25 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4 text-emerald-600 dark:text-emerald-400" />
            Tabla de hallazgos
          </CardTitle>
          <CardDescription>
            Resumen CYB001 en Word: severidad (celda coloreada), nombre de vulnerabilidad y
            componentes afectados agrupados por título y severidad. Se guarda en el historial del
            proyecto. Antes de generar, se sincroniza el catálogo operativo con los hallazgos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!engagementId && (
            <p className="text-xs text-amber-700 dark:text-amber-400/90 flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0" />
              Selecciona un proyecto en el paso 1 para generar la tabla.
            </p>
          )}
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              {error}
            </p>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={onlyValidated}
              onChange={(e) => setOnlyValidated(e.target.checked)}
              className="accent-emerald-500"
            />
            Solo hallazgos validados
          </label>
          {engagementId && findingStats !== null && (
            <p className="text-xs text-muted-foreground">
              {findingStats.total} hallazgo{findingStats.total !== 1 ? 's' : ''} →{' '}
              {findingStats.grouped} fila{findingStats.grouped !== 1 ? 's' : ''} en la tabla
              {onlyValidated ? ` · ${findingStats.validated} validado${findingStats.validated !== 1 ? 's' : ''}` : ''}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-800 dark:hover:text-emerald-200"
            onClick={() => void handleGenerateFindingsTable()}
            disabled={busy === 'table' || !engagementId || apiOnline === false}
          >
            {busy === 'table' ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Download className="size-4 mr-2" />
            )}
            {busy === 'table' ? 'Generando tabla…' : 'Generar Tabla de hallazgos'}
          </Button>
          {tableResult && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300/90 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {tableResult.findings} hallazgo{tableResult.findings !== 1 ? 's' : ''} →{' '}
              {tableResult.rows} fila{tableResult.rows !== 1 ? 's' : ''} — guardado en historial
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-violet-600 dark:text-violet-300" />
            Generar reportes Word
          </CardTitle>
          <CardDescription>
            Genera un documento por hallazgo y fusiona en{' '}
            <code className="text-muted-foreground">Tablas_detalles_vulnerabilidades.docx</code> — igual que el macro VBA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border',
                apiOnline === null && 'text-muted-foreground border-border bg-muted/40',
                apiOnline === true &&
                  'text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5',
                apiOnline === false &&
                  'text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/5'
              )}
            >
              {apiOnline === null ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Comprobando API…
                </>
              ) : apiOnline ? (
                <>
                  <CheckCircle2 className="size-3" />
                  API conectado ({getApiBaseUrlLabel()})
                </>
              ) : (
                <>
                  <AlertCircle className="size-3" />
                  API no disponible — ejecuta ./start.sh
                </>
              )}
            </span>
            {engagementId && findingStats !== null && (
              <span className="text-muted-foreground">
                Proyecto: {findingStats.total} hallazgo{findingStats.total !== 1 ? 's' : ''} →{' '}
                {findingStats.grouped} tabla{findingStats.grouped !== 1 ? 's' : ''} Word
                {onlyValidated ? ` · ${findingStats.validated} validado${findingStats.validated !== 1 ? 's' : ''}` : ''}
              </span>
            )}
          </div>

          {!engagementId && (
            <p className="text-xs text-amber-700 dark:text-amber-400/90 flex items-center gap-1.5">
              <AlertCircle className="size-3.5 shrink-0" />
              Vuelve al paso 1 y selecciona o crea un proyecto. Los hallazgos del paso 3 deben guardarse antes de generar Word.
            </p>
          )}

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="size-4 animate-spin" />
              Cargando plantillas…
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sube una plantilla .docx para comenzar.</p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Plantilla</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full h-9 rounded-md bg-background border border-border text-sm text-foreground px-3"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.placeholders?.length ?? 0} marcadores)
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyValidated}
                  onChange={(e) => setOnlyValidated(e.target.checked)}
                  className="accent-violet-500"
                />
                Solo hallazgos validados
              </label>
              {onlyValidated && findingStats && findingStats.total > 0 && findingStats.validated < findingStats.total && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400/90">
                  Solo {findingStats.validated} de {findingStats.total} hallazgos están validados. Desmarca esta opción
                  para exportar todos los guardados en el proyecto.
                </p>
              )}

              <Button type="button" onClick={() => void handleGenerate()} disabled={busy === 'generate' || !selectedTemplateId || !engagementId || apiOnline === false}>
                {busy === 'generate' ? <Loader2 className="size-4 mr-2 animate-spin" /> : <FileText className="size-4 mr-2" />}
                {busy === 'generate' ? 'Generando…' : 'Generar documentos Word'}
              </Button>
              {generateStatus && (
                <p className="text-xs text-violet-700 dark:text-violet-300/90 flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                  {generateStatus}
                </p>
              )}
            </>
          )}

          {lastResult && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 p-4 space-y-2">
              <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                {lastResult.message} — {lastResult.findings_count} hallazgos, {lastResult.individual_count} archivos individuales
              </p>
              <a
                href={reportDownloadUrl(lastResult.consolidated_download_url)}
                download="Tablas_detalles_vulnerabilidades.docx"
                className="inline-flex items-center gap-1.5 text-sm text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200"
              >
                <Download className="size-4" />
                Descargar consolidado (.docx)
              </a>
            </div>
          )}

          {templates.length > 0 && (
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Plantillas guardadas</p>
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-xs text-foreground rounded border border-border px-3 py-2 bg-muted/40">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    {t.placeholders && t.placeholders.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-md">
                        {t.placeholders.slice(0, 6).join(', ')}
                        {t.placeholders.length > 6 ? '…' : ''}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                    onClick={() => void handleDelete(t.id, t.name)}
                    disabled={busy === `del-${t.id}`}
                  >
                    {busy === `del-${t.id}` ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {engagementId && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-violet-600 dark:text-violet-300" />
              Historial de reportes
            </CardTitle>
            <CardDescription>
              Reportes generados para este proyecto. Se guardan en el servidor y puedes descargarlos
              en cualquier momento sin volver a generarlos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="size-4 animate-spin" />
                Cargando historial…
              </div>
            ) : reportHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay reportes guardados para este proyecto. Genera uno arriba y aparecerá aquí.
              </p>
            ) : (
              <div className="space-y-2">
                {reportHistory.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border px-3 py-3 bg-muted/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {job.template_name}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border',
                            job.status === 'completed' &&
                              'text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5',
                            job.status === 'failed' &&
                              'text-rose-700 dark:text-rose-300 border-rose-500/30 bg-rose-500/10 dark:bg-rose-500/5',
                            job.status === 'processing' &&
                              'text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/5'
                          )}
                        >
                          {reportStatusLabel(job.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatReportDate(job.created_at)}
                        {' · '}
                        {job.findings_count} hallazgo{job.findings_count !== 1 ? 's' : ''}
                        {job.report_kind === 'findings_table'
                          ? ` · ${job.grouped_rows ?? 0} fila${(job.grouped_rows ?? 0) !== 1 ? 's' : ''} en tabla`
                          : job.individual_count > 0
                            ? ` · ${job.individual_count} archivo${job.individual_count !== 1 ? 's' : ''} individual${job.individual_count !== 1 ? 'es' : ''}`
                            : ''}
                      </p>
                      {job.status === 'failed' && job.error_message && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400/90 truncate">{job.error_message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {job.consolidated_download_url ? (
                        <a
                          href={reportDownloadUrl(job.consolidated_download_url)}
                          download={
                            job.report_kind === 'findings_table'
                              ? 'Tabla_de_hallazgos.docx'
                              : 'Tablas_detalles_vulnerabilidades.docx'
                          }
                          className="inline-flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200 border border-violet-500/30 rounded-md px-2.5 py-1.5"
                        >
                          <Download className="size-3.5" />
                          Descargar
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Sin archivo</span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                        onClick={() => void handleDeleteJob(job)}
                        disabled={busy === `job-${job.id}`}
                        title="Eliminar reporte"
                      >
                        {busy === `job-${job.id}` ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
