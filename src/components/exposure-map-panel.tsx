'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  buildExposureDataFromFiles,
  buildExposureDataFromRepository,
  loadExposureMapCache,
  type ExposureReportData,
} from '@/lib/exposure-report';
import { generateHTML, type ReportMetadata } from '@/app/(secops)/tools/exposure/html-template';
import { listAssets, listFindings } from '@/lib/secops-api';
import { useProjectSelection } from '@/lib/use-project-selection';

const VIS_JS_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/vis-network/9.1.2/standalone/umd/vis-network.min.js';

type DataSource = 'cache' | 'repository' | 'upload';

export function ExposureMapPanel() {
  const { engagementId, engagements } = useProjectSelection();
  const projectName =
    engagements.find((e) => e.id === engagementId)?.nombre_proyecto ||
    engagements.find((e) => e.id === engagementId)?.cliente ||
    '';
  const [source, setSource] = useState<DataSource>('cache');
  const [data, setData] = useState<ExposureReportData | null>(null);
  const [srcDoc, setSrcDoc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const renderMap = useCallback(async (reportData: ExposureReportData, title: string) => {
    const res = await fetch(VIS_JS_URL);
    if (!res.ok) throw new Error('No se pudo cargar vis.js para el mapa');
    const visJsSource = await res.text();
    const metadata: ReportMetadata = {
      title: title || projectName || 'Mapa de exposición',
      date: new Date().toISOString().split('T')[0],
    };
    setSrcDoc(generateHTML(reportData, metadata, visJsSource));
    setData(reportData);
  }, [projectName]);

  const loadFromCache = useCallback(async () => {
    const cache = loadExposureMapCache();
    if (!cache?.data?.vulnerabilities?.length) {
      setError('Sin datos Nessus en caché. Importa un CSV en Ingesta o sube un archivo abajo.');
      setData(null);
      setSrcDoc('');
      return;
    }
    setError(null);
    setSource('cache');
    await renderMap(cache.data, cache.title);
  }, [renderMap]);

  const loadFromRepository = useCallback(async () => {
    if (!engagementId) {
      setError('Selecciona un servicio activo para cargar inventario y hallazgos.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [findings, assets] = await Promise.all([
        listFindings({ engagement_id: engagementId, limit: 5000 }),
        listAssets({ engagement_id: engagementId, limit: 5000 }),
      ]);
      const reportData = buildExposureDataFromRepository(findings, assets);
      if (!reportData.vulnerabilities.length) {
        setError('No hay hallazgos para este servicio. Importa Nessus en Ingesta primero.');
        setData(null);
        setSrcDoc('');
        return;
      }
      setSource('repository');
      await renderMap(reportData, projectName || 'Repositorio AV');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos del repositorio');
    } finally {
      setLoading(false);
    }
  }, [engagementId, projectName, renderMap]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const cache = loadExposureMapCache();
      if (cache?.data?.vulnerabilities?.length) {
        await loadFromCache();
      } else if (engagementId) {
        await loadFromRepository();
      } else {
        setError('Importa un CSV Nessus o selecciona un servicio con hallazgos.');
      }
      setLoading(false);
    })();
  }, [engagementId, loadFromCache, loadFromRepository]);

  const onUpload = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const reportData = await buildExposureDataFromFiles(list);
      setSource('upload');
      await renderMap(reportData, list.map((f) => f.name).join(', '));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo Nessus');
    } finally {
      setUploading(false);
    }
  };

  const hostCount = data?.hosts.length ?? 0;
  const vulnCount = data?.vulnerabilities.length ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4 text-violet-600" />
            Mapa de exposición (Nessus)
          </CardTitle>
          <CardDescription>
            Vista interactiva integrada en la app — misma lógica que Network Exposure Live Report,
            actualizada con el último Nessus o con el repositorio del servicio activo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void loadFromCache()}>
            Último Nessus importado
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!engagementId}
            onClick={() => void loadFromRepository()}
          >
            <RefreshCw className="size-3.5 mr-1" />
            Inventario + hallazgos
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-input bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/80">
            <input
              type="file"
              accept=".csv,.nessus"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void onUpload(e.target.files)}
            />
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <UploadCloud className="size-3.5" />
            )}
            Subir CSV Nessus
          </label>
          {engagementId ? (
            <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
              Servicio: {projectName || engagementId.slice(0, 8)} · fuente: {source}
            </span>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
          {error}{' '}
          <Link href="/vul-mgmt/ingesta" className="underline font-medium">
            Ir a Ingesta
          </Link>
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          Generando mapa…
        </div>
      ) : srcDoc ? (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {hostCount} host(s) · {vulnCount} vulnerabilidad(es) en el mapa
          </p>
          <iframe
            title="Mapa de exposición Nessus"
            className="w-full h-[min(78vh,880px)] rounded-xl border border-border bg-background"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : null}
    </div>
  );
}
