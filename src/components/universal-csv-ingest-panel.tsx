'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wand2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  Plus,
  X,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { postIngestMultipart } from '@/lib/ingest-upload';
import {
  CORE_FIELD_KEYS,
  OPTIONAL_FIELD_KEYS,
  FIELD_META,
  type StandardField,
  suggestColumnMap,
  parseUniversalCsvPreview,
  confidenceLabel,
  mapToApiPayload,
  buildFieldPreviewMap,
  type FieldPreviewEntry,
  csvDelimiterLabel,
  isSeguimientoExport,
  type CsvDelimiter,
} from '@/lib/universal-csv-map';
import {
  type OfficialFieldKey,
  type UserAliasMap,
  loadUserAliases,
  addUserAlias,
  removeUserAlias,
  getFieldDef,
} from '@/lib/universal-csv-field-catalog';
import { SEGUIMIENTO_FIELD_BRIDGE } from '@/lib/csv-field-bridge';
import { appendAssetScopeToFormData, type IngestAssetScope } from '@/components/ingest-asset-scope-fields';

type IngestResult = {
  source: string;
  created_count: number;
  finding_ids: string[];
  message?: string | null;
  column_map?: Record<string, string> | null;
};

type WizardStep = 'upload' | 'map' | 'done';

export function UniversalCsvIngestPanel({
  engagementId,
  importScope,
  onComplete,
}: {
  engagementId: string;
  importScope?: IngestAssetScope;
  onComplete?: (result: IngestResult) => void;
}) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(',');
  const [fieldMap, setFieldMap] = useState<Partial<Record<StandardField, string>>>({});
  const [scores, setScores] = useState<Partial<Record<StandardField, number>>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [resolvedMap, setResolvedMap] = useState<Record<string, string> | null>(null);
  const [userAliases, setUserAliases] = useState<UserAliasMap>({});

  useEffect(() => {
    setUserAliases(loadUserAliases());
  }, []);

  const applySuggestion = useCallback(
    (csvHeaders: string[], filename?: string) => {
      const suggested = suggestColumnMap(csvHeaders, userAliases, { filename });
      setFieldMap(suggested.map);
      setScores(suggested.scores);
    },
    [userAliases]
  );

  const reset = useCallback(() => {
    setStep('upload');
    setStatus('idle');
    setMsg(null);
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setDelimiter(',');
    setFieldMap({});
    setScores({});
    setResolvedMap(null);
  }, []);

  const loadFile = useCallback(
    async (f: File) => {
      const text = await f.text();
      const preview = parseUniversalCsvPreview(text);
      if (!preview.headers.length) {
        setStatus('error');
        setMsg('No se detectaron encabezados en el CSV.');
        return;
      }
      setFile(f);
      setHeaders(preview.headers);
      setPreviewRows(preview.rows);
      setTotalRows(preview.totalRows);
      setDelimiter(preview.delimiter);
      applySuggestion(preview.headers, f.name);
      setStatus('idle');
      setMsg(null);
      setStep('map');
    },
    [applySuggestion]
  );

  const onDrop = useCallback(
    (files: File[]) => {
      const f = files[0];
      if (f) void loadFile(f);
    },
    [loadFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    multiple: false,
    disabled: status === 'uploading' || step === 'map',
  });

  const fieldPreviews = useMemo(
    () => buildFieldPreviewMap(fieldMap, previewRows),
    [fieldMap, previewRows]
  );

  const unmappedCsvColumns = useMemo(() => {
    const used = new Set(Object.values(fieldMap).filter(Boolean));
    return headers.filter((h) => !used.has(h));
  }, [headers, fieldMap]);

  const looksLikeSeguimiento = useMemo(
    () => isSeguimientoExport(headers, file?.name),
    [headers, file?.name]
  );

  const showExtractionNote = useMemo(() => {
    if (!looksLikeSeguimiento) return false;
    const extractable: StandardField[] = ['cve', 'cwe', 'cvss', 'epss', 'kev', 'impact', 'evidence'];
    return extractable.some((k) => !fieldMap[k]);
  }, [looksLikeSeguimiento, fieldMap]);

  const importCsv = useCallback(async () => {
    if (!file) return;
    const eg = engagementId.trim();
    if (!eg) {
      setStatus('error');
      setMsg('Selecciona un proyecto antes de importar.');
      return;
    }
    if (!fieldMap.title?.trim()) {
      setStatus('error');
      setMsg('Debes mapear al menos la columna de Título.');
      return;
    }

    setStatus('uploading');
    setMsg(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('engagement_id', eg);
    fd.append('column_map', JSON.stringify(mapToApiPayload(fieldMap)));
    if (importScope) appendAssetScopeToFormData(fd, importScope);

    try {
      const res = await postIngestMultipart('/api/v1/ingest/universal-csv', fd);
      const data = (await res.json().catch(() => ({}))) as IngestResult & { detail?: unknown };
      if (!res.ok) {
        const detail =
          typeof data.detail === 'string'
            ? data.detail
            : Array.isArray(data.detail)
              ? data.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
              : res.statusText;
        setStatus('error');
        setMsg(detail || 'Error en ingesta');
        return;
      }

      setStatus('idle');
      setResolvedMap(data.column_map ?? mapToApiPayload(fieldMap));
      setMsg(data.message ?? `${data.created_count} hallazgo(s) importado(s).`);
      setStep('done');
      onComplete?.(data);
    } catch (e) {
      setStatus('error');
      setMsg(e instanceof Error ? e.message : 'No se pudo conectar al API');
    }
  }, [engagementId, fieldMap, file, onComplete]);

  const setFieldHeader = (field: StandardField, header: string) => {
    setFieldMap((prev) => {
      const next = { ...prev };
      if (!header) delete next[field];
      else next[field] = header;
      return next;
    });
    setScores((prev) => {
      const next = { ...prev };
      if (!header) delete next[field];
      else if (header !== fieldMap[field]) delete next[field];
      return next;
    });
    setStatus('idle');
    setMsg(null);
  };

  const rerunAutoMatch = () => {
    applySuggestion(headers, file?.name);
  };

  const handleAddAlias = (key: OfficialFieldKey, alias: string) => {
    const next = addUserAlias(key, alias);
    setUserAliases(next);
    if (headers.length) applySuggestion(headers, file?.name);
  };

  const handleRemoveAlias = (key: OfficialFieldKey, alias: string) => {
    const next = removeUserAlias(key, alias);
    setUserAliases(next);
    if (headers.length) applySuggestion(headers, file?.name);
  };

  return (
    <Card className="bg-card border-border overflow-hidden md:col-span-2 lg:col-span-4">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary shrink-0" />
              CSV universal
              <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                Asistente de importación
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Catálogo de campos oficiales (prioritarios + complementarios). Ajusta el match o agrega alias
              persistentes para tus exports recurrentes.
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => setShowCatalog((v) => !v)}
            >
              <BookOpen className="size-3.5 mr-1" />
              Catálogo
            </Button>
            {step !== 'upload' && (
              <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={reset}>
                Nuevo CSV
              </Button>
            )}
          </div>
        </div>

        <WizardSteps current={step} />
      </CardHeader>

      <CardContent className="space-y-4">
        {showCatalog && (
          <FieldCatalogPanel
            userAliases={userAliases}
            onAddAlias={handleAddAlias}
            onRemoveAlias={handleRemoveAlias}
          />
        )}

        {step === 'upload' && (
          <div
            {...getRootProps()}
            className={cn(
              'rounded-lg border border-dashed px-4 py-10 text-center text-xs cursor-pointer transition-colors',
              isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-muted/30'
            )}
          >
            <input {...getInputProps()} />
            <Wand2 className="size-8 mx-auto mb-2 text-primary/70" />
            <p className="text-sm font-medium text-foreground">Arrastra un CSV o haz clic para elegir</p>
            <p className="text-muted-foreground mt-1 max-w-lg mx-auto">
              Seguimiento de vulnerabilidades, Nessus, Qualys u otro export. Las claves oficiales no cambian;
              puedes ampliar alias en el catálogo.
            </p>
          </div>
        )}

        {step === 'map' && file && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-muted-foreground">
                <span className="font-medium text-foreground">{file.name}</span>
                {' · '}
                {headers.length} columnas · {totalRows} fila(s) de datos · separador:{' '}
                {csvDelimiterLabel(delimiter)}
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={rerunAutoMatch}>
                <Sparkles className="size-3.5 mr-1" />
                Re-detectar automático
              </Button>
            </div>

            <FieldMappingTable
              title="Campos prioritarios"
              fields={CORE_FIELD_KEYS}
              headers={headers}
              fieldMap={fieldMap}
              scores={scores}
              previews={fieldPreviews}
              onChange={setFieldHeader}
            />

            <FieldMappingTable
              title="Campos complementarios (opcionales)"
              fields={OPTIONAL_FIELD_KEYS}
              headers={headers}
              fieldMap={fieldMap}
              scores={scores}
              previews={fieldPreviews}
              onChange={setFieldHeader}
              collapsedDefault={false}
            />

            {showExtractionNote && (
              <p className="text-[11px] rounded border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
                Este export de Seguimiento no incluye columnas dedicadas para algunos campos prioritarios.
                CVE, CWE y CVSS se extraen automáticamente de Descripción (o Título) al importar cuando
                aplica.
              </p>
            )}

            {looksLikeSeguimiento && (
              <details className="text-[11px] rounded border border-border bg-muted/20">
                <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">
                  Relación Seguimiento → matriz CYB001 → inventario
                </summary>
                <div className="overflow-x-auto px-3 pb-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-muted-foreground border-b border-border">
                        <th className="py-1 pr-2 font-medium">Campo oficial</th>
                        <th className="py-1 pr-2 font-medium">CSV Seguimiento</th>
                        <th className="py-1 pr-2 font-medium">Matriz</th>
                        <th className="py-1 pr-2 font-medium">Inventario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SEGUIMIENTO_FIELD_BRIDGE.map((row) => (
                        <tr key={row.officialField} className="border-b border-border/50">
                          <td className="py-1 pr-2 text-foreground">{row.officialField}</td>
                          <td className="py-1 pr-2 font-mono">{row.seguimientoColumn ?? '—'}</td>
                          <td className="py-1 pr-2">{row.matrixColumn}</td>
                          <td className="py-1 pr-2 text-muted-foreground">{row.inventoryColumn ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-muted-foreground">
                    Grupo y subgrupo admiten varios valores separados por ; , o |. Si el host/IP del CSV
                    coincide con un activo del inventario, se fusionan automáticamente.
                  </p>
                </div>
              </details>
            )}

            {unmappedCsvColumns.length > 0 && (
              <div className="text-[11px] rounded border border-dashed border-border px-3 py-2 text-muted-foreground">
                Columnas CSV sin mapear:{' '}
                <span className="font-mono text-foreground">{unmappedCsvColumns.join(' · ')}</span>
              </div>
            )}

            {previewRows.length > 0 && (
              <FieldPreviewSummary previews={fieldPreviews} />
            )}

            {!fieldMap.title && (
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                Se requiere mapear la columna <strong className="font-medium">Título</strong> para importar.
              </p>
            )}

            <details
              className="text-xs"
              open={showAdvanced}
              onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Mapeo avanzado (JSON)
              </summary>
              <pre className="mt-2 p-2 rounded border border-border bg-muted/40 font-mono text-[10px] overflow-x-auto">
                {JSON.stringify(mapToApiPayload(fieldMap), null, 2)}
              </pre>
            </details>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep('upload')}>
                <ChevronLeft className="size-4 mr-1" />
                Cambiar archivo
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!fieldMap.title || status === 'uploading'}
                onClick={() => void importCsv()}
              >
                {status === 'uploading' ? (
                  <>
                    <Loader2 className="size-4 mr-1 animate-spin" />
                    Importando…
                  </>
                ) : (
                  <>
                    Importar {totalRows > 0 ? `${totalRows} fila(s)` : ''}
                    <ChevronRight className="size-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3">
            {msg && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400/90 flex items-start gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
                {msg}
              </p>
            )}
            {resolvedMap && Object.keys(resolvedMap).length > 0 && (
              <div className="text-[11px] rounded border border-border bg-muted/40 p-2 space-y-1">
                <p className="font-medium text-muted-foreground">Mapeo aplicado:</p>
                <ul className="font-mono space-y-0.5">
                  {Object.entries(resolvedMap).map(([field, header]) => (
                    <li key={field}>
                      {FIELD_META[field as StandardField]?.label ?? field} → {header}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              Importar otro CSV
            </Button>
          </div>
        )}

        {status === 'error' && msg && step !== 'done' && (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-start gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
            {msg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FieldMappingTable({
  title,
  fields,
  headers,
  fieldMap,
  scores,
  previews,
  onChange,
  collapsedDefault,
}: {
  title: string;
  fields: StandardField[];
  headers: string[];
  fieldMap: Partial<Record<StandardField, string>>;
  scores: Partial<Record<StandardField, number>>;
  previews: Partial<Record<StandardField, FieldPreviewEntry>>;
  onChange: (field: StandardField, header: string) => void;
  collapsedDefault?: boolean;
}) {
  return (
    <details className="rounded-lg border border-border overflow-hidden" open={!collapsedDefault}>
      <summary className="cursor-pointer px-3 py-2 bg-muted/50 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </summary>
      <div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto_minmax(0,1.1fr)] gap-2 px-3 py-2 border-b border-border text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Campo oficial</span>
          <span>Columna en tu CSV</span>
          <span>Match</span>
          <span>Primer valor</span>
        </div>
        <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
          {fields.map((field) => (
            <MappingRow
              key={field}
              field={field}
              headers={headers}
              value={fieldMap[field] ?? ''}
              score={scores[field]}
              preview={previews[field]}
              onChange={(h) => onChange(field, h)}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

function FieldCatalogPanel({
  userAliases,
  onAddAlias,
  onRemoveAlias,
}: {
  userAliases: UserAliasMap;
  onAddAlias: (key: OfficialFieldKey, alias: string) => void;
  onRemoveAlias: (key: OfficialFieldKey, alias: string) => void;
}) {
  const [selectedField, setSelectedField] = useState<OfficialFieldKey>('title');
  const [newAlias, setNewAlias] = useState('');
  const def = getFieldDef(selectedField);
  const custom = userAliases[selectedField] ?? [];

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3 text-xs">
      <p className="text-muted-foreground leading-relaxed">
        Las <span className="text-foreground font-medium">claves oficiales</span> son fijas (prioritarias).
        Agrega alias con el nombre exacto de columnas de tus CSV recurrentes; se guardan en este navegador.
      </p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 min-w-[200px]">
          <span className="text-[10px] text-muted-foreground uppercase">Campo oficial</span>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value as OfficialFieldKey)}
            className="rounded-md border border-input bg-background px-2 py-1.5"
          >
            {[...CORE_FIELD_KEYS, ...OPTIONAL_FIELD_KEYS].map((k) => (
              <option key={k} value={k}>
                {FIELD_META[k]?.label ?? k}
                {FIELD_META[k]?.tier === 'core' ? ' *' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[10px] text-muted-foreground uppercase">Nuevo alias (encabezado CSV)</span>
          <input
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder={def ? `Ej. ${def.aliases[0]}` : ''}
            className="rounded-md border border-input bg-background px-2 py-1.5"
          />
        </label>
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={!newAlias.trim()}
          onClick={() => {
            onAddAlias(selectedField, newAlias);
            setNewAlias('');
          }}
        >
          <Plus className="size-3.5 mr-1" />
          Agregar alias
        </Button>
      </div>
      {custom.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {custom.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono"
            >
              {a}
              <button type="button" onClick={() => onRemoveAlias(selectedField, a)} aria-label={`Quitar ${a}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function WizardSteps({ current }: { current: WizardStep }) {
  const steps: { id: WizardStep; label: string }[] = [
    { id: 'upload', label: '1. Subir' },
    { id: 'map', label: '2. Mapear' },
    { id: 'done', label: '3. Listo' },
  ];
  const idx = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex flex-wrap gap-1 mt-3">
      {steps.map((s, i) => (
        <span
          key={s.id}
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full border',
            i <= idx
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground'
          )}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function MappingRow({
  field,
  headers,
  value,
  score,
  preview,
  onChange,
}: {
  field: StandardField;
  headers: string[];
  value: string;
  score?: number;
  preview?: FieldPreviewEntry;
  onChange: (header: string) => void;
}) {
  const meta = FIELD_META[field];
  const label = meta?.label ?? field;
  const hint = meta?.hint ?? '';
  const conf = confidenceLabel(score);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto_minmax(0,1.1fr)] gap-2 items-start px-3 py-2 text-xs">
      <div>
        <p className="font-medium text-foreground">
          {label}
          {meta?.required ? <span className="text-rose-500 ml-0.5">*</span> : null}
        </p>
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
      >
        <option value="">— Sin mapear —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <ConfidenceBadge conf={conf} />
      <FieldPreviewCell preview={preview} mapped={Boolean(value)} />
    </div>
  );
}

function FieldPreviewCell({
  preview,
  mapped,
}: {
  preview?: FieldPreviewEntry;
  mapped: boolean;
}) {
  if (!preview?.value) {
    if (mapped && preview?.source === 'empty') {
      return <span className="text-[10px] text-muted-foreground italic">(vacío)</span>;
    }
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-foreground font-mono break-words leading-snug" title={preview.value}>
        {preview.value}
      </p>
      {preview.source === 'extracted' && (
        <span className="text-[9px] text-primary/80">auto desde Descripción/Título</span>
      )}
    </div>
  );
}

function FieldPreviewSummary({
  previews,
}: {
  previews: Partial<Record<StandardField, FieldPreviewEntry>>;
}) {
  const allFields = [...CORE_FIELD_KEYS, ...OPTIONAL_FIELD_KEYS];
  const withValue = allFields.filter((f) => previews[f]?.value);
  if (!withValue.length) return null;

  return (
    <details className="text-xs rounded-md border border-border bg-muted/30" open>
      <summary className="cursor-pointer px-3 py-2 font-medium text-foreground">
        Vista previa — primera fila con datos ({withValue.length} campos)
      </summary>
      <div className="px-3 pb-3 grid gap-1.5 sm:grid-cols-2">
        {allFields.map((field) => {
          const entry = previews[field];
          if (!entry?.value) return null;
          const label = FIELD_META[field]?.label ?? field;
          return (
            <div key={field} className="min-w-0 rounded border border-border/60 bg-background/50 px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-[11px] font-mono text-foreground break-words leading-snug" title={entry.value}>
                {entry.value}
              </p>
              {entry.source === 'extracted' && (
                <span className="text-[9px] text-primary/80">extraído al importar</span>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

function ConfidenceBadge({ conf }: { conf: 'alta' | 'media' | 'baja' | null }) {
  if (!conf) return <span className="text-[10px] text-muted-foreground w-12 text-center">—</span>;
  const styles = {
    alta: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
    media: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    baja: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
  };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium w-12 text-center', styles[conf])}>
      {conf}
    </span>
  );
}
