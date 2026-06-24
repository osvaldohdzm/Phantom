'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Upload, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CatalogBulkReplacePanel } from '@/components/catalog-bulk-replace-panel';
import { EXPLICACION_TECNICA_MAX_PARAGRAPHS } from '@/lib/truncate-paragraphs';
import type { CsvEncoding } from '@/lib/text-encoding';

export function VulnMgmtCatalogMaintenancePanel() {
  const [catalogVersion, setCatalogVersion] = useState('unknown');
  const [catalogRowCount, setCatalogRowCount] = useState(0);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const [importVersion, setImportVersion] = useState('');
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [importEncoding, setImportEncoding] = useState<CsvEncoding>('auto');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch('/api/vulns-catalog/meta', { cache: 'no-store' });
      const data = (await res.json()) as { version?: string; row_count?: number };
      if (res.ok) {
        setCatalogVersion(data.version ?? 'unknown');
        setCatalogRowCount(data.row_count ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchColumns = useCallback(async () => {
    try {
      const res = await fetch('/api/vulns-catalog?page=1&pageSize=1', { cache: 'no-store' });
      const data = (await res.json()) as { filters?: { availableColumns?: string[] } };
      if (res.ok && data.filters?.availableColumns) {
        setAvailableColumns(data.filters.availableColumns);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchMeta();
    void fetchColumns();
  }, [fetchMeta, fetchColumns]);

  const handleImportCsv = async (file: File) => {
    setImportBusy(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (importVersion.trim()) fd.append('version', importVersion.trim());
      if (replaceOnImport) fd.append('replace', 'true');
      fd.append('encoding', importEncoding);
      const res = await fetch('/api/vulns-catalog/import', { method: 'POST', body: fd });
      const data = (await res.json()) as {
        error?: string;
        details?: string;
        version?: string;
        total_rows?: number;
        hint?: string;
      };
      if (!res.ok) throw new Error(data.details || data.error || 'Importación fallida');
      setNotice(`Importado. ${data.total_rows?.toLocaleString() ?? '?'} filas.`);
      if (data.hint) setError(data.hint);
      await fetchMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar CSV');
    } finally {
      setImportBusy(false);
    }
  };

  const handleRepairEncoding = async () => {
    setRepairBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/vulns-catalog/repair-encoding', { method: 'POST' });
      const data = (await res.json()) as {
        error?: string;
        details?: string;
        repaired_rows?: number;
      };
      if (!res.ok) throw new Error(data.details || data.error || 'Reparación fallida');
      setNotice(`Codificación reparada en ${data.repaired_rows ?? 0} fila(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reparar codificación');
    } finally {
      setRepairBusy(false);
    }
  };

  const handleTruncateExplicacion = async () => {
    setRepairBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/vulns-catalog/truncate-explicacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_paragraphs: EXPLICACION_TECNICA_MAX_PARAGRAPHS }),
      });
      const data = (await res.json()) as {
        error?: string;
        details?: string;
        updated_rows?: number;
      };
      if (!res.ok) throw new Error(data.details || data.error || 'Recorte fallido');
      setNotice(`Explicación técnica acotada en ${data.updated_rows ?? 0} fila(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al acotar explicación');
    } finally {
      setRepairBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo operativo</CardTitle>
          <CardDescription className="text-xs">
            Tabla <code className="rounded bg-muted px-1">core.vulns_catalog</code> — versión{' '}
            <span className="font-mono">{catalogVersion}</span> ·{' '}
            {catalogRowCount.toLocaleString()} registros
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = '/api/vulns-catalog/export';
            }}
          >
            <Download className="size-3.5 mr-1" />
            Exportar CSV
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={importBusy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportCsv(f);
                e.target.value = '';
              }}
            />
            <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs hover:bg-muted">
              {importBusy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
              Importar CSV
            </span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opciones de importación</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Versión (opcional)</span>
            <Input
              className="h-8 text-xs"
              value={importVersion}
              onChange={(e) => setImportVersion(e.target.value)}
              placeholder="v2024.1"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Codificación CSV</span>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              value={importEncoding}
              onChange={(e) => setImportEncoding(e.target.value as CsvEncoding)}
            >
              <option value="auto">Auto</option>
              <option value="utf-8">UTF-8</option>
              <option value="latin-1">Latin-1</option>
              <option value="windows-1252">Windows-1252</option>
            </select>
          </label>
          <label className="flex items-end gap-2 text-xs pb-1">
            <input
              type="checkbox"
              checked={replaceOnImport}
              onChange={(e) => setReplaceOnImport(e.target.checked)}
              className="rounded"
            />
            Reemplazar catálogo completo
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="size-4" />
            Mantenimiento masivo
          </CardTitle>
          <CardDescription className="text-xs">
            Reparar mojibake, acotar explicación técnica y reemplazo de texto en todo el catálogo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={repairBusy}
              onClick={() => void handleRepairEncoding()}
            >
              {repairBusy ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              Reparar codificación
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={repairBusy}
              onClick={() => void handleTruncateExplicacion()}
            >
              Acotar EspExplicacionTecnica
            </Button>
          </div>
          {availableColumns.length > 0 ? (
            <CatalogBulkReplacePanel
              availableColumns={availableColumns}
              scope={{}}
              scopedRowsHint={catalogRowCount}
              onApplied={() => void fetchMeta()}
            />
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 border border-amber-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-lg px-3 py-2">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
