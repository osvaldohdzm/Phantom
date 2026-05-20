"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Save, ShieldAlert, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  VULNS_CATALOG_EDITABLE_COLUMNS,
  type VulnsCatalogEditableColumn,
} from "@/lib/vulns-catalog-columns";

type Row = Record<string, unknown> & { Id: string };

type CatalogResponse = {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    severity: string[];
    availableColumns: string[];
  };
};

const DISPLAY_COLUMNS = [
  "Id",
  "StandardVulnerabilityName",
  "Severity",
  "CVE",
  "CWE",
  "CVSSOverallScore3_1",
] as const;

const prettyLabel: Record<string, string> = {
  StandardVulnerabilityName: "Nombre Estándar",
  Vulnerability: "Vulnerabilidad",
  Severity: "Severidad",
  SourceDetection: "Fuente",
  Description: "Descripción",
  Danger: "Peligro/Impacto",
  Solution: "Solución",
  CVE: "CVE",
  CWE: "CWE",
  EspNombreVulnerabilidadUnificado: "Nombre (ES)",
  EspSeveridadUnificada: "Severidad (ES)",
  EspDescripcionUnificada: "Descripción (ES)",
  EspAmenazaUnificadaGeneral: "Amenaza (ES)",
  EspPropuestaRemediacionUnificada: "Remediación (ES)",
};

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function VulnsCatalog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [formValues, setFormValues] = useState<Partial<Record<VulnsCatalogEditableColumn, string>>>({});

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(searchText.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchText]);

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

  const maxPage = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);

  const openEditor = (row: Row) => {
    setSelectedRow(row);
    const nextValues: Partial<Record<VulnsCatalogEditableColumn, string>> = {};
    for (const col of VULNS_CATALOG_EDITABLE_COLUMNS) {
      const raw = row[col];
      nextValues[col] = raw === null || raw === undefined ? "" : String(raw);
    }
    setFormValues(nextValues);
  };

  const closeEditor = () => {
    setSelectedRow(null);
    setFormValues({});
  };

  const onSave = async () => {
    if (!selectedRow) return;

    const updates: Partial<Record<VulnsCatalogEditableColumn, string | null>> = {};
    for (const col of VULNS_CATALOG_EDITABLE_COLUMNS) {
      const current = selectedRow[col];
      const next = (formValues[col] ?? "").trim();
      const currentNormalized = current === null || current === undefined ? "" : String(current).trim();
      if (next !== currentNormalized) {
        updates[col] = next === "" ? null : next;
      }
    }

    if (Object.keys(updates).length === 0) {
      closeEditor();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/vulns-catalog/${selectedRow.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const payload = (await response.json()) as { row?: Row; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible guardar los cambios");
      }

      if (payload.row) {
        setRows((prevRows) =>
          prevRows.map((row) => (row.Id === payload.row?.Id ? (payload.row as Row) : row)),
        );
      }
      closeEditor();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Error desconocido";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-3">
             <BookOpen className="size-6 text-emerald-400" />
             <CardTitle className="text-slate-100">Catálogo Operativo v7.0.12</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Base de datos unificada de vulnerabilidades con mapeo en español y severidades normalizadas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_200px_200px_200px_auto] items-end">
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-slate-500">Búsqueda Global</span>
              <div className="relative">
                <Search className="size-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  className="pl-8 bg-slate-950/70 border-slate-700 text-slate-100"
                  placeholder="Nombre, CVE, CWE, descripción..."
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wide text-slate-500">Filtrar Campo</span>
              <select
                className="h-8 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/50"
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
              <span className="text-xs uppercase tracking-wide text-slate-500">Valor del Campo</span>
              <select
                className="h-8 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/50"
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
                {filterValueOptions.map((val) => (
                  <option key={val} value={val}>
                    {val.length > 40 ? val.substring(0, 40) + "..." : val}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="outline"
              className="border-slate-700 bg-slate-950/70 text-slate-200"
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
              className="border-slate-700 bg-slate-950/70 text-slate-200"
              onClick={() => void fetchRows()}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/40">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  {DISPLAY_COLUMNS.map((column) => (
                    <TableHead key={column} className="text-slate-400">
                      {prettyLabel[column] ?? column}
                    </TableHead>
                  ))}
                  <TableHead className="text-right text-slate-400">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableCell className="text-slate-500" colSpan={DISPLAY_COLUMNS.length + 1}>
                      Cargando catálogo...
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableCell className="text-slate-500" colSpan={DISPLAY_COLUMNS.length + 1}>
                      No se encontraron registros.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.Id} className="border-slate-800 hover:bg-slate-900/70">
                      {DISPLAY_COLUMNS.map((column) => (
                        <TableCell key={`${row.Id}-${column}`} className="text-slate-200 max-w-[300px] truncate">
                           {column === "Severity" ? (
                             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                row[column]?.toString().toLowerCase() === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                                row[column]?.toString().toLowerCase() === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                                'bg-slate-800 text-slate-300'
                             }`}>
                                {stringifyCell(row[column])}
                             </span>
                           ) : stringifyCell(row[column])}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                          onClick={() => openEditor(row)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-400">
            <span>
              Mostrando <span className="text-slate-200 font-medium">{rows.length}</span> de <span className="text-slate-200 font-medium">{total}</span> registros
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-950/60 text-slate-200"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(value - 1, 1))}
              >
                Anterior
              </Button>
              <span className="font-mono text-slate-300">
                {page} / {maxPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-950/60 text-slate-200"
                disabled={page >= maxPage}
                onClick={() => setPage((value) => Math.min(value + 1, maxPage))}
              >
                Siguiente
              </Button>
            </div>
          </div>
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        </CardContent>
      </Card>

      {selectedRow ? (
        <Card className="bg-slate-900/90 border-slate-700 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <CardHeader className="border-b border-slate-800 mb-4">
            <CardTitle className="text-slate-100 flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-500" />
                Edición de Registro #{selectedRow.Id}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {VULNS_CATALOG_EDITABLE_COLUMNS.map((column) => (
                <label className="space-y-1.5" key={column}>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    {prettyLabel[column] ?? column}
                  </span>
                  {column.includes("Description") ||
                  column.includes("Solut") ||
                  column.includes("Amenaza") ||
                  column === "Danger" ||
                  column === "Solution" ? (
                    <textarea
                      className="min-h-[100px] w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                      value={formValues[column] ?? ""}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, [column]: event.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      className="bg-slate-950/70 border-slate-700 text-slate-200 focus:ring-emerald-500/50"
                      value={formValues[column] ?? ""}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, [column]: event.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/70 text-slate-400 hover:text-slate-200"
                onClick={closeEditor}
                disabled={saving}
              >
                Descartar
              </Button>
              <Button 
                onClick={() => void onSave()} 
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Save className="size-4" />
                {saving ? "Guardando..." : "Actualizar Catálogo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
