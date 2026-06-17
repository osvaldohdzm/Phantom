"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  RefreshCw,
  BookOpen,
  Download,
  Upload,
  Loader2,
  Columns3,
  Wrench,
  Settings2,
} from "lucide-react";
import { CatalogBulkReplacePanel } from "@/components/catalog-bulk-replace-panel";
import { CatalogRecordEditor, type CatalogRow } from "@/components/catalog-record-editor";
import { CatalogFieldConfigPanel } from "@/components/catalog-field-config-panel";
import {
  DEFAULT_CATALOG_FIELD_CONFIG,
  loadCatalogFieldConfig,
  type CatalogFieldConfig,
} from "@/lib/catalog-field-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS,
  VULNS_CATALOG_DISPLAY_STORAGE_KEY,
  catalogColumnLabel,
} from "@/lib/vulns-catalog-columns";
import type { CsvEncoding } from "@/lib/text-encoding";
import { EXPLICACION_TECNICA_MAX_PARAGRAPHS } from "@/lib/truncate-paragraphs";

type CatalogResponse = {
  rows: CatalogRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    severity: string[];
    availableColumns: string[];
  };
};

function loadDisplayColumns(): string[] {
  if (typeof window === "undefined") return [...VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS];
  try {
    const raw = localStorage.getItem(VULNS_CATALOG_DISPLAY_STORAGE_KEY);
    if (!raw) return [...VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) return [...VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS];
    const cols = parsed.filter((c): c is string => typeof c === "string" && c.trim() !== "");
    return cols.includes("Id") ? cols : ["Id", ...cols];
  } catch {
    return [...VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS];
  }
}

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  const str = String(value).trim();
  return str === "" ? "—" : str;
}

function catalogRowKey(row: CatalogRow, index: number): string {
  const id = row.Id;
  if (id !== null && id !== undefined && String(id).trim() !== "") {
    return String(id);
  }
  const name = String(row.StandardVulnerabilityName ?? row.NessusPluginId ?? "").trim();
  return `row-${index}-${name || "sin-id"}`;
}

export function VulnsCatalog() {
  const searchParams = useSearchParams();
  const editIdParam = searchParams.get("editId");
  const fromFindingParam = searchParams.get("fromFinding");
  const engagementIdParam = searchParams.get("engagementId");
  const [catalogSyncNotice, setCatalogSyncNotice] = useState<string | null>(null);

  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [severityOptions, setSeverityOptions] = useState<string[]>([]);

  // Dynamic filters
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [filterValueOptions, setFilterValueOptions] = useState<string[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);

  const [selectedRow, setSelectedRow] = useState<CatalogRow | null>(null);
  const [catalogVersion, setCatalogVersion] = useState("unknown");
  const [catalogRowCount, setCatalogRowCount] = useState(0);
  const [importBusy, setImportBusy] = useState(false);
  const [importVersion, setImportVersion] = useState("");
  const [replaceOnImport, setReplaceOnImport] = useState(false);
  const [importEncoding, setImportEncoding] = useState<CsvEncoding>("auto");
  const [repairBusy, setRepairBusy] = useState(false);
  const [displayColumns, setDisplayColumns] = useState<string[]>(() => loadDisplayColumns());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [fieldConfig, setFieldConfig] = useState<CatalogFieldConfig>(DEFAULT_CATALOG_FIELD_CONFIG);

  useEffect(() => {
    void loadCatalogFieldConfig().then(setFieldConfig);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(searchText.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchText]);

  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch("/api/vulns-catalog/meta", { cache: "no-store" });
      const data = (await res.json()) as {
        version?: string;
        row_count?: number;
      };
      if (res.ok) {
        setCatalogVersion(data.version ?? "unknown");
        setCatalogRowCount(data.row_count ?? 0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void fetchMeta();
  }, [fetchMeta]);

  const handleImportCsv = async (file: File) => {
    setImportBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (importVersion.trim()) fd.append("version", importVersion.trim());
      if (replaceOnImport) fd.append("replace", "true");
      fd.append("encoding", importEncoding);
      const res = await fetch("/api/vulns-catalog/import", { method: "POST", body: fd });
      const data = (await res.json()) as {
        error?: string;
        details?: string;
        version?: string;
        upserted?: number;
        total_rows?: number;
        hint?: string;
        cells_with_replacement_char?: number;
      };
      if (!res.ok) throw new Error(data.details || data.error || "Importación fallida");
      if (data.hint) setError(data.hint);
      setCatalogVersion(data.version ?? catalogVersion);
      setCatalogRowCount(data.total_rows ?? catalogRowCount);
      await fetchMeta();
      await fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar CSV");
    } finally {
      setImportBusy(false);
    }
  };

  const handleExportCsv = () => {
    window.location.href = "/api/vulns-catalog/export";
  };

  const handleTruncateExplicacion = async () => {
    setRepairBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vulns-catalog/truncate-explicacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_paragraphs: EXPLICACION_TECNICA_MAX_PARAGRAPHS }),
      });
      const data = (await res.json()) as {
        error?: string;
        details?: string;
        updated_rows?: number;
        hint?: string;
      };
      if (!res.ok) throw new Error(data.details || data.error || "Recorte fallido");
      if (data.hint && (data.updated_rows ?? 0) > 0) {
        setError(`${data.updated_rows} filas acotadas a ${EXPLICACION_TECNICA_MAX_PARAGRAPHS} párrafos. ${data.hint}`);
      }
      await fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al acotar explicación técnica");
    } finally {
      setRepairBusy(false);
    }
  };

  const handleRepairEncoding = async () => {
    setRepairBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/vulns-catalog/repair-encoding", { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        details?: string;
        repaired_rows?: number;
        rows_with_replacement_char?: number;
        hint?: string;
      };
      if (!res.ok) throw new Error(data.details || data.error || "Reparación fallida");
      if (data.hint && (data.rows_with_replacement_char ?? 0) > 0) {
        setError(
          `Reparadas ${data.repaired_rows ?? 0} filas. Aún quedan ${data.rows_with_replacement_char} con caracteres perdidos — reimporta el CSV con Windows-1252.`,
        );
      }
      await fetchRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reparar codificación");
    } finally {
      setRepairBusy(false);
    }
  };

  const toggleDisplayColumn = (column: string) => {
    if (column === "Id") return;
    setDisplayColumns((prev) => {
      const next = prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column];
      const withId = next.includes("Id") ? next : ["Id", ...next];
      localStorage.setItem(VULNS_CATALOG_DISPLAY_STORAGE_KEY, JSON.stringify(withId));
      return withId;
    });
  };

  const resetDisplayColumns = () => {
    const defaults = [...VULNS_CATALOG_DEFAULT_DISPLAY_COLUMNS];
    setDisplayColumns(defaults);
    localStorage.setItem(VULNS_CATALOG_DISPLAY_STORAGE_KEY, JSON.stringify(defaults));
  };

  // Fetch values for the selected filter column
  useEffect(() => {
    if (!filterColumn) {
      setFilterValueOptions([]);
      setFilterValue("");
      return;
    }

    const fetchValues = async () => {
      setLoadingValues(true);
      try {
        const response = await fetch(`/api/vulns-catalog?getDistinct=${filterColumn}`);
        const data = await response.json();
        setFilterValueOptions(data.values || []);
      } catch (err) {
        console.error("Error fetching distinct values:", err);
      } finally {
        setLoadingValues(false);
      }
    };

    void fetchValues();
  }, [filterColumn]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (query) params.set("query", query);
      if (severity) params.set("severity", severity);
      if (filterColumn && filterValue) {
        params.set("filterColumn", filterColumn);
        params.set("filterValue", filterValue);
      }

      const response = await fetch(`/api/vulns-catalog?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as CatalogResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible consultar el catálogo");
      }

      setRows(payload.rows);
      setTotal(payload.total);
      setSeverityOptions(payload.filters.severity);
      setAvailableColumns(payload.filters.availableColumns || []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Error desconocido";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, query, severity, filterColumn, filterValue]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const openEditor = useCallback((row: CatalogRow) => {
    setSelectedRow(row);
  }, []);

  const closeEditor = useCallback(() => {
    setSelectedRow(null);
  }, []);

  const handleEditorSaved = useCallback(
    (row: CatalogRow, sync?: { synced: number; total: number }) => {
      setRows((prevRows) => prevRows.map((r) => (r.Id === row.Id ? row : r)));
      if (sync && sync.synced > 0) {
        setCatalogSyncNotice(
          `Catálogo guardado · ${sync.synced} ocurrencia(s) de hallazgos actualizadas en el proyecto.`
        );
      } else if (sync) {
        setCatalogSyncNotice(
          'Catálogo guardado. No se encontraron hallazgos vinculados por Plugin Nessus en este proyecto.'
        );
      }
    },
    []
  );

  useEffect(() => {
    if (!editIdParam) return;
    let cancelled = false;

    const openById = async () => {
      try {
        const res = await fetch(`/api/vulns-catalog/${encodeURIComponent(editIdParam)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { row?: CatalogRow; error?: string };
        if (!cancelled && res.ok && data.row) {
          openEditor(data.row);
          requestAnimationFrame(() => {
            document.getElementById("catalog-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      } catch {
        /* ignore */
      }
    };

    void openById();
    return () => {
      cancelled = true;
    };
  }, [editIdParam, openEditor]);

  useEffect(() => {
    if (!selectedRow || !fromFindingParam) return;
    requestAnimationFrame(() => {
      document.getElementById("catalog-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [selectedRow?.Id, fromFindingParam]);

  const maxPage = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  return (
    <div className="space-y-6">
      {configOpen ? (
        <CatalogFieldConfigPanel
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          onSaved={(config) => setFieldConfig(config)}
        />
      ) : null}

      {selectedRow ? (
        <CatalogRecordEditor
          key={String(selectedRow.Id)}
          row={selectedRow}
          fieldConfig={fieldConfig}
          onFieldConfigUpdate={setFieldConfig}
          onClose={closeEditor}
          onSaved={handleEditorSaved}
          highlightFromFinding={Boolean(fromFindingParam)}
          engagementId={engagementIdParam ?? undefined}
          fromFindingId={fromFindingParam ?? undefined}
        />
      ) : null}

      {catalogSyncNotice ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 px-1">{catalogSyncNotice}</p>
      ) : null}

      {fromFindingParam && selectedRow ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400/90 px-1">
          Editando catálogo para el hallazgo vinculado — registro #{String(selectedRow.Id)}
          {selectedRow.StandardVulnerabilityName
            ? ` · ${String(selectedRow.StandardVulnerabilityName).slice(0, 80)}`
            : ""}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
             <BookOpen className="size-6 text-emerald-600 dark:text-emerald-400" />
             <CardTitle>Catálogo Operativo {catalogVersion}</CardTitle>
          </div>
          <CardDescription>
            Base unificada ({catalogRowCount.toLocaleString()} registros). Importa/exporta CSV CFR; la ingesta Nessus
            enriquece hallazgos por Plugin ID.
          </CardDescription>
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <label className="space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground">Codificación CSV</span>
              <select
                className="h-8 w-40 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                value={importEncoding}
                onChange={(e) => setImportEncoding(e.target.value as CsvEncoding)}
              >
                <option value="auto">Auto (UTF-8 / CP1252)</option>
                <option value="utf-8">UTF-8</option>
                <option value="cp1252">Windows-1252 (CP1252)</option>
                <option value="latin-1">ISO-8859-1 (Latin-1)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground">Versión al importar (opcional)</span>
              <Input
                className="h-8 w-36 text-xs"
                placeholder="v8.0.1"
                value={importVersion}
                onChange={(e) => setImportVersion(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground pb-1.5">
              <input
                type="checkbox"
                checked={replaceOnImport}
                onChange={(e) => setReplaceOnImport(e.target.checked)}
                className="rounded border-input"
              />
              Reemplazar catálogo completo
            </label>
            <div className="relative">
              <input
                id="catalog-csv-import"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={importBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImportCsv(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                disabled={importBusy}
                onClick={() => document.getElementById("catalog-csv-import")?.click()}
              >
                {importBusy ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="size-4 mr-2" />
                )}
                Importar CSV
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExportCsv}
            >
              <Download className="size-4 mr-2" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-amber-500/40 text-amber-700 dark:text-amber-300"
              disabled={repairBusy}
              onClick={() => void handleRepairEncoding()}
            >
              {repairBusy ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Wrench className="size-4 mr-2" />
              )}
              Reparar acentos
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={repairBusy}
              onClick={() => void handleTruncateExplicacion()}
              title={`Recorta EspExplicacionTecnica a ${EXPLICACION_TECNICA_MAX_PARAGRAPHS} párrafos en todo el catálogo`}
            >
              {repairBusy ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Wrench className="size-4 mr-2" />
              )}
              Acotar expl. técnica ({EXPLICACION_TECNICA_MAX_PARAGRAPHS} ¶)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_200px_200px_auto] items-end">
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Búsqueda Global</span>
              <div className="relative">
                <Search className="size-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  className="pl-8"
                  placeholder="Nombre, CVE, CWE, descripción..."
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Filtrar Campo</span>
              <select
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                value={filterColumn}
                onChange={(event) => {
                  setFilterColumn(event.target.value);
                  setFilterValue("");
                  setPage(1);
                }}
              >
                <option value="">(Ninguno)</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Valor del Campo</span>
              <select
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/40"
                value={filterValue}
                disabled={!filterColumn || loadingValues}
                onChange={(event) => {
                  setFilterValue(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">
                  {loadingValues ? "Cargando..." : filterColumn ? "Seleccionar valor..." : "Primero elige un campo"}
                </option>
                {filterValueOptions.map((val, i) => (
                  <option key={val ?? `fv-${i}`} value={val}>
                    {val.length > 40 ? val.substring(0, 40) + "..." : val}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="outline"
              onClick={() => {
                setSearchText("");
                setFilterColumn("");
                setFilterValue("");
                setSeverity("");
              }}
            >
              Limpiar
            </Button>

            <Button
              variant="outline"
              onClick={() => void fetchRows()}
            >
              <RefreshCw className="size-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              className="border-violet-500/40 text-violet-700 dark:text-violet-300"
              onClick={() => setConfigOpen(true)}
            >
              <Settings2 className="size-4 mr-2" />
              Campos obligatorios
            </Button>

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                onClick={() => setColumnsOpen((v) => !v)}
              >
                <Columns3 className="size-4 mr-2" />
                Columnas
              </Button>
              {columnsOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">Columnas visibles</span>
                    <button
                      type="button"
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                      onClick={resetDisplayColumns}
                    >
                      Restablecer
                    </button>
                  </div>
                  <div className="space-y-1">
                    {availableColumns.map((col) => (
                      <label
                        key={col}
                        className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:bg-muted rounded px-1 py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={displayColumns.includes(col)}
                          disabled={col === "Id"}
                          onChange={() => toggleDisplayColumn(col)}
                          className="rounded border-input"
                        />
                        <span className="truncate">{catalogColumnLabel(col)}</span>
                        <span className="text-[9px] text-muted-foreground ml-auto font-mono">{col}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <CatalogBulkReplacePanel
            availableColumns={availableColumns}
            scope={{
              query: searchText.trim() || undefined,
              severity: severity || undefined,
              filterColumn: filterColumn || undefined,
              filterValue: filterValue || undefined,
            }}
            scopedRowsHint={total}
            onApplied={() => void fetchRows()}
          />

          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {displayColumns.map((column) => (
                    <TableHead key={column} className="whitespace-nowrap">
                      {catalogColumnLabel(column)}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={displayColumns.length + 1}>
                      Cargando catálogo...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={displayColumns.length + 1}>
                      No se encontraron registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, rowIndex) => {
                    const rk = catalogRowKey(row, rowIndex);
                    return (
                    <TableRow key={rk}>
                      {displayColumns.map((column) => (
                        <TableCell key={`${rk}-${column}`} className="max-w-[300px] truncate">
                           {column === "EspSeveridadUnificada" || column === "Severity" ? (
                             (() => {
                               const val = stringifyCell(row[column]);
                               const lower = val.toLowerCase();
                               return (
                                 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    lower === 'crítica' || lower === 'critical' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/40' :
                                    lower === 'alta' || lower === 'high' ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/40' :
                                    lower === 'media' || lower === 'medium' ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/40' :
                                    lower === 'baja' || lower === 'low' ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/40' :
                                    'bg-muted text-muted-foreground border border-border'
                                 }`}>
                                    {val}
                                 </span>
                               );
                             })()
                           ) : stringifyCell(row[column])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-emerald-500/10 hover:border-emerald-500/50"
                          onClick={() => openEditor(row)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
            <span>
              Mostrando <span className="text-foreground font-medium">{rows.length}</span> de <span className="text-foreground font-medium">{total}</span> registros
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
              >
                Anterior
              </Button>
              <span className="font-mono text-foreground/80">
                {page} / {maxPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= maxPage}
                onClick={() => setPage((value) => Math.min(value + 1, maxPage))}
              >
                Siguiente
              </Button>
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

    </div>
  );
}
