'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEngagementLoadGuard } from '@/lib/engagement-load-guard';
import {
  FindingFormEditor,
  findingToFormValues,
  formValuesToPayload,
} from '@/components/finding-form-editor';
import {
  bulkDeleteFindingsBatched,
  bulkDeleteFindingsByQuery,
  countFindings,
  deduplicateFindingsEngagement,
  fetchProjectSummary,
  loadFindingsPageSize,
  resolveFindingsListPaging,
  saveFindingsPageSize,
  type FindingsOrderBy,
  type FindingsUiPageSize,
  listAllFindingsForEngagement,
  listAllFindingsInRepository,
  listFindings,
  repairFindingsText,
  updateFinding,
  type Finding,
  type ProjectSummary,
  type Severity,
} from '@/lib/secops-api';
import {
  fillCatalogSpanishAndPropagate,
  truncateCatalogExplicacionAndPropagate,
} from '@/lib/catalog-gemini-batch';
import { EXPLICACION_TECNICA_MAX_PARAGRAPHS } from '@/lib/truncate-paragraphs';
import { SPREADSHEET_COLUMNS } from '@/lib/finding-spreadsheet-columns';
import { getCatalogFieldConfigSync, loadCatalogFieldConfig } from '@/lib/catalog-field-config';
import {
  findingCompleteness,
  matchesReviewFilter,
  REVIEW_FIELDS,
  type ReviewFilter,
} from '@/lib/finding-completeness';
import { sortBySeverity } from '@/lib/severity-sort';
import { groupFindingsForDisplay, groupFindingsByAiGroup, countAiGroups, resolveFindingComponente } from '@/lib/finding-grouping';
import { GroupedFindingsView } from '@/components/grouped-findings-view';
import { FindingDetailExtras } from '@/components/finding-detail-extras';
import { FindingHistoryTimeline } from '@/components/finding-history-timeline';
import { FindingMasterCatalogMeta } from '@/components/finding-master-catalog-meta';
import { OpenCatalogButton } from '@/components/open-catalog-button';
import { SyncCatalogButton } from '@/components/sync-catalog-button';
import {
  buildMissingFieldFilters,
  FindingsSpreadsheetTable,
} from '@/components/findings-spreadsheet-table';
import { FindingsReviewToolbar } from '@/components/findings-review-toolbar';
import {
  loadTableDensity,
  saveTableDensity,
  type TableDensity,
} from '@/lib/data-table-pagination';
import { syncFindingsFromCatalog } from '@/lib/catalog-from-finding';
import {
  assignAiGroupsEngagement,
  consolidateMasterCatalogApi,
  syncFindingsFromCatalogApi,
} from '@/lib/secops-api';
import {
  toolSourceFilterApiValue,
  type ToolSourceFilterId,
} from '@/lib/finding-source-filters';
import { SeverityBadge } from '@/components/severity-badge';
import { CompletenessIndicator } from '@/components/completeness-indicator';

const ALL_SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Info'];

const SEVERITY_SELECT_LABEL: Record<Severity, string> = {
  Critical: 'Críticas',
  High: 'Altas',
  Medium: 'Medias',
  Low: 'Bajas',
  Info: 'Info',
};

const PRIMARY_FILTER_OPTIONS: { id: ReviewFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'incomplete', label: 'Pendientes' },
  { id: 'gemini-ready', label: 'Listos' },
];

const ADVANCED_FILTER_OPTIONS: { id: ReviewFilter; label: string }[] = [
  { id: 'complete', label: 'Completos' },
  { id: 'missing-descripcion', label: 'Sin descripción' },
  { id: 'missing-amenaza', label: 'Sin amenaza' },
];

type AutomatedFindingsReviewPanelProps = {
  engagementId?: string;
  projectName?: string;
  refreshToken?: number;
  /** `repository` = repositorio global (vul-mgmt) sin proyecto. */
  scope?: 'engagement' | 'repository';
  /** Oculta el selector de modo fila cuando está embebido en panel unificado. */
  embedded?: boolean;
};

export function AutomatedFindingsReviewPanel({
  engagementId,
  projectName,
  refreshToken,
  scope = 'engagement',
  embedded = false,
}: AutomatedFindingsReviewPanelProps) {
  const isRepository = scope === 'repository';
  const canLoad = isRepository || Boolean(engagementId);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [searchQ, setSearchQ] = useState('');
  const deferredSearch = useDeferredValue(searchQ);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** Toda la consulta actual (severidad + búsqueda), no solo la página visible. */
  const [selectAllInQuery, setSelectAllInQuery] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, ReturnType<typeof findingToFormValues>>>({});
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [severidadesMulti, setSeveridadesMulti] = useState<Severity[] | undefined>();
  const [pageSize, setPageSize] = useState<FindingsUiPageSize>(50);
  const [severitySort, setSeveritySort] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState<
    'gemini' | 'save' | 'delete' | 'sync' | 'consolidate' | 'assign-groups' | null
  >(null);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [geminiProgress, setGeminiProgress] = useState<{ done: number; total: number } | null>(null);
  const [correctiveProgress, setCorrectiveProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteDuplicates, setConfirmDeleteDuplicates] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'list' | 'spreadsheet'>('spreadsheet');
  const [aiGroupedView, setAiGroupedView] = useState(false);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [repairNotice, setRepairNotice] = useState<string | null>(null);
  const [fieldConfigTick, setFieldConfigTick] = useState(0);
  const [tableMissingField, setTableMissingField] = useState('any');
  const [tableShowAllFields, setTableShowAllFields] = useState(true);
  const [tableDensity, setTableDensity] = useState<TableDensity>('compact');
  const [missingFieldOptions, setMissingFieldOptions] = useState(() => buildMissingFieldFilters());
  const [columnFilterMeta, setColumnFilterMeta] = useState<{ count: number; clear: () => void }>({
    count: 0,
    clear: () => {},
  });
  const [tableDetailView, setTableDetailView] = useState(false);
  const [detailPreset, setDetailPreset] = useState<
    import('@/components/findings-spreadsheet-table').FindingsSpreadsheetTableProps['detailPreset']
  >(undefined);
  const [toolSourceFilter, setToolSourceFilter] = useState<ToolSourceFilterId>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPageSize(loadFindingsPageSize());
    setTableDensity(loadTableDensity());
  }, []);

  useEffect(() => {
    void loadCatalogFieldConfig().then(() => setMissingFieldOptions(buildMissingFieldFilters()));
  }, [fieldConfigTick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    void loadCatalogFieldConfig().then(() => setFieldConfigTick((n) => n + 1));
  }, [engagementId, refreshToken]);

  const loadSummary = useCallback(async () => {
    if (!engagementId) {
      setSummary(null);
      return;
    }
    const data = await fetchProjectSummary(engagementId);
    setSummary(data);
  }, [engagementId]);

  const { beginLoad, invalidate, isStale } = useEngagementLoadGuard();

  const loadPage = useCallback(async (opts?: { replaceForms?: boolean }) => {
    if (!canLoad) {
      setFindings([]);
      setFilteredTotal(0);
      setLoading(false);
      return;
    }
    const generation = beginLoad();
    setPageLoading(true);
    setError(null);
    try {
      const severidad =
        !severidadesMulti?.length && severityFilter !== 'all' ? severityFilter : undefined;
      const orderBy: FindingsOrderBy = severitySort ? 'severidad_asc' : 'created_at_desc';
      const tool_source = toolSourceFilterApiValue(toolSourceFilter);
      const countParams = {
        ...(isRepository ? {} : { engagement_id: engagementId }),
        q: deferredSearch,
        severidad,
        severidades: severidadesMulti,
        tool_source,
      };
      const total = await countFindings(countParams);
      const { skip, limit } = resolveFindingsListPaging(page, pageSize, total);
      const rows = await listFindings({
        ...countParams,
        limit,
        skip,
        order_by: orderBy,
      });
      if (isStale(generation)) return;
      setFindings(rows);
      setFilteredTotal(total);
      setEditForms((prev) => {
        const base = opts?.replaceForms ? {} : { ...prev };
        const next = { ...base };
        for (const f of rows) {
          if (opts?.replaceForms || !next[f.id]) {
            next[f.id] = findingToFormValues(f);
          }
        }
        return next;
      });
    } catch (e) {
      if (!isStale(generation)) {
        setError(e instanceof Error ? e.message : 'Error al cargar hallazgos');
      }
    } finally {
      if (!isStale(generation)) {
        setPageLoading(false);
        setLoading(false);
      }
    }
  }, [
    canLoad,
    isRepository,
    engagementId,
    page,
    pageSize,
    deferredSearch,
    severityFilter,
    severidadesMulti,
    severitySort,
    toolSourceFilter,
    beginLoad,
    isStale,
  ]);

  const reloadSummary = useCallback(async () => {
    if (!engagementId) return;
    try {
      await loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen');
    }
  }, [engagementId, loadSummary]);

  useEffect(() => {
    invalidate();
    if (!canLoad) {
      setFindings([]);
      setEditForms({});
      setSummary(null);
      setLoading(false);
      setFilteredTotal(0);
      return;
    }
    setFindings([]);
    setEditForms({});
    setFilteredTotal(0);
    setLoading(true);
    if (!isRepository) void reloadSummary();
  }, [engagementId, refreshToken, reloadSummary, invalidate, canLoad, isRepository]);

  useEffect(() => {
    if (!canLoad) return;
    setPageLoading(true);
    void loadPage();
  }, [
    canLoad,
    engagementId,
    page,
    pageSize,
    deferredSearch,
    severityFilter,
    severidadesMulti,
    severitySort,
    toolSourceFilter,
    refreshToken,
    loadPage,
  ]);

  useEffect(() => {
    setPage(1);
    setSelectAllInQuery(false);
    setSelected(new Set());
  }, [deferredSearch, severityFilter, severidadesMulti, filter, engagementId, refreshToken, pageSize]);

  const filtered = useMemo(() => {
    let list = findings.filter((f) => {
      if (severityFilter !== 'all' && f.severidad !== severityFilter) return false;
      return matchesReviewFilter(f, filter);
    });
    if (severitySort) list = sortBySeverity(list, (f) => f.severidad);
    return list;
  }, [findings, filter, severityFilter, severitySort]);

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Info: 0,
    };
    const src = summary?.by_severity;
    if (src) {
      for (const sev of ALL_SEVERITIES) counts[sev] = src[sev] ?? 0;
    }
    return counts;
  }, [summary]);

  const groupedFiltered = useMemo(
    () => groupFindingsForDisplay(filtered),
    [filtered]
  );

  const aiGrouped = useMemo(() => groupFindingsByAiGroup(filtered), [filtered]);

  const aiGroupCount = useMemo(() => countAiGroups(findings), [findings]);

  const displayGroups = aiGroupedView ? aiGrouped : groupedFiltered;

  const stats = useMemo(() => {
    const incomplete = findings.filter((f) => findingCompleteness(f).missing.length > 0).length;
    const geminiReady = findings.filter((f) => findingCompleteness(f).geminiReady).length;
    void fieldConfigTick;
    return {
      total: summary?.total_findings ?? 0,
      incomplete,
      geminiReady,
      groupedTotal: summary?.grouped_vulnerability_count ?? 0,
      duplicateGroups: summary?.duplicates.group_count ?? 0,
      duplicateRemove: summary?.duplicates.remove_count ?? 0,
      aiGroupCount: aiGroupedView ? aiGrouped.length : aiGroupCount,
    };
  }, [summary, findings, fieldConfigTick, aiGroupedView, aiGrouped.length, aiGroupCount]);

  const duplicatePreview = summary?.duplicates;

  const selectionCount = useMemo(() => {
    if (!selectAllInQuery) return selected.size;
    if (severidadesMulti?.length) {
      return severidadesMulti.reduce((sum, s) => sum + (severityCounts[s] ?? 0), 0);
    }
    if (severityFilter !== 'all') return severityCounts[severityFilter] ?? 0;
    return filteredTotal;
  }, [
    selectAllInQuery,
    selected.size,
    severidadesMulti,
    severityFilter,
    severityCounts,
    filteredTotal,
  ]);
  const hasSelection = selectionCount > 0;

  const effectiveSelected = useMemo(() => {
    if (selectAllInQuery) return new Set(filtered.map((f) => f.id));
    return selected;
  }, [selectAllInQuery, selected, filtered]);

  const toggleSelect = (id: string) => {
    setSelectAllInQuery(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    setSelectAllInQuery(false);
    setSelected(new Set(filtered.map((f) => f.id)));
  };

  const selectAllInCurrentQuery = async () => {
    if (!engagementId || filteredTotal === 0) return;
    setSelectingAll(true);
    setError(null);
    try {
      if (filter === 'all') {
        setSelectAllInQuery(true);
        setSelected(new Set());
        return;
      }
      const severidad =
        !severidadesMulti?.length && severityFilter !== 'all' ? severityFilter : undefined;
      const { findings: all } = await listAllFindingsForEngagement(engagementId, {
        severidad,
        severidades: severidadesMulti,
        q: deferredSearch || undefined,
      });
      const ids = all.filter((f) => matchesReviewFilter(f, filter)).map((f) => f.id);
      setSelectAllInQuery(false);
      setSelected(new Set(ids));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo seleccionar todos los filtrados');
    } finally {
      setSelectingAll(false);
    }
  };

  const selectAllBySeverity = (sev: Severity) => {
    setFilter('all');
    setSeveridadesMulti([sev]);
    setSeverityFilter('all');
    setSelectAllInQuery(true);
    setSelected(new Set());
  };

  const clearSelection = () => {
    setSelectAllInQuery(false);
    setSelected(new Set());
  };

  const runRepairText = async () => {
    if (!engagementId) return;
    setBusy('save');
    setError(null);
    setRepairNotice(null);
    try {
      const result = await repairFindingsText(engagementId);
      setRepairNotice(
        result.repaired_count > 0
          ? `Acentos reparados en ${result.repaired_count} de ${result.total} hallazgos.`
          : 'No hubo cambios — los textos ya están correctos o reimporta catálogo/Nessus.'
      );
      await reloadSummary();
      await loadPage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reparar textos');
    } finally {
      setBusy(null);
    }
  };

  const runTruncateExplicacion = async () => {
    if (!engagementId || geminiTargetFindings.length === 0) {
      setError('Selecciona hallazgos o aplica un filtro con resultados en la página actual.');
      return;
    }
    setBusy('save');
    setError(null);
    setRepairNotice(null);
    setCorrectiveProgress({ done: 0, total: 1 });
    try {
      const result = await truncateCatalogExplicacionAndPropagate(
        geminiTargetFindings,
        engagementId,
        {
          maxParagraphs: EXPLICACION_TECNICA_MAX_PARAGRAPHS,
          onProgress: (done, total) => setCorrectiveProgress({ done, total }),
        }
      );
      setEditForms({});
      await loadPage({ replaceForms: true });
      await reloadSummary();
      setRepairNotice(
        result.fieldsFilled > 0
          ? `Explicación técnica acotada en ${result.fieldsFilled} tipo${result.fieldsFilled === 1 ? '' : 's'} de catálogo · ${result.findingsPropagated} hallazgo${result.findingsPropagated === 1 ? '' : 's'} actualizado${result.findingsPropagated === 1 ? '' : 's'}.`
          : `Ningún catálogo requirió recorte (ya ≤ ${EXPLICACION_TECNICA_MAX_PARAGRAPHS} párrafos).`
      );
      if (result.errors.length) {
        setError(result.errors.slice(0, 2).join(' · '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al acotar explicación técnica');
    } finally {
      setBusy(null);
      setCorrectiveProgress(null);
    }
  };

  const handleFindingSynced = (updated: Finding) => {
    setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditForms((prev) => ({ ...prev, [updated.id]: findingToFormValues(updated) }));
  };

  const syncEngagementFromCatalog = async () => {
    if (!engagementId) return;
    setBusy('sync');
    setError(null);
    setSyncProgress(null);
    try {
      const result = await syncFindingsFromCatalogApi({ engagement_id: engagementId });
      setEditForms({});
      await loadPage({ replaceForms: true });
      await reloadSummary();
      setRepairNotice(
        `Proyecto completo: ${result.synced} hallazgos actualizados desde catálogo operativo` +
          (result.skipped > 0 ? ` · ${result.skipped} sin entrada en catálogo` : '') +
          '.'
      );
      if (result.errors.length) {
        setError(`${result.errors.length} error(es) al sincronizar (ver consola).`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sincronizar catálogo');
    } finally {
      setBusy(null);
    }
  };

  const syncFromCatalog = async (targets: Finding[], label: string) => {
    if (!targets.length) return;
    setBusy('sync');
    setError(null);
    setSyncProgress({ done: 0, total: targets.length });
    try {
      const { synced, skipped, errors } = await syncFindingsFromCatalog(targets, (done, total) =>
        setSyncProgress({ done, total })
      );
      for (const t of targets) {
        setEditForms((prev) => {
          const next = { ...prev };
          delete next[t.id];
          return next;
        });
      }
      await loadPage({ replaceForms: true });
      await reloadSummary();
      if (errors.length && synced > 0) {
        setRepairNotice(
          `${label}: ${synced} actualizados, ${skipped} sin catálogo, ${errors.length} con error.`
        );
      } else if (errors.length && synced === 0) {
        setError(errors[0] ?? 'No se pudo actualizar desde el catálogo');
      } else {
        setRepairNotice(
          `${label}: ${synced} hallazgo(s) actualizados desde catálogo operativo` +
            (skipped > 0 ? ` · ${skipped} sin entrada en catálogo` : '') +
            '.'
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sincronizar catálogo');
    } finally {
      setBusy(null);
      setSyncProgress(null);
    }
  };

  const assignAiGroups = async () => {
    if (!engagementId) return;
    setBusy('assign-groups');
    setError(null);
    try {
      const result = await assignAiGroupsEngagement(engagementId);
      await loadPage({ replaceForms: true });
      await reloadSummary();
      setRepairNotice(
        `Grupos IA: ${result.assigned} hallazgo(s) en ${result.groups_created} grupo(s) nuevos.`
      );
      if (result.assigned > 0) {
        setAiGroupedView(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al asignar grupos IA');
    } finally {
      setBusy(null);
    }
  };

  const consolidateTargets = async (targets: Finding[], label: string) => {
    if (!targets.length && !engagementId) return;
    setBusy('consolidate');
    setError(null);
    try {
      const result = await consolidateMasterCatalogApi(
        targets.length
          ? { finding_ids: targets.map((f) => f.id) }
          : { engagement_id: engagementId }
      );
      await loadPage({ replaceForms: true });
      await reloadSummary();
      setRepairNotice(
        `${label}: ${result.synced} consolidado(s) en catálogo maestro · ${result.groups} grupo(s) deduplicados` +
          (result.skipped > 0 ? ` · ${result.skipped} omitidos` : '') +
          '.'
      );
      if (result.errors.length) {
        setError(`${result.errors.length} error(es) al consolidar.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consolidar en catálogo maestro');
    } finally {
      setBusy(null);
    }
  };

  const saveFinding = async (id: string) => {
    const form = editForms[id];
    if (!form) return;
    setBusy('save');
    setError(null);
    try {
      const updated = await updateFinding(id, formValuesToPayload(form));
      setFindings((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setEditForms((prev) => ({ ...prev, [id]: findingToFormValues(updated) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setBusy(null);
    }
  };

  const deleteDuplicates = async () => {
    if (!engagementId || !stats.duplicateRemove) return;
    setBusy('delete');
    setError(null);
    try {
      const result = await deduplicateFindingsEngagement(engagementId);
      clearSelection();
      setConfirmDeleteDuplicates(false);
      setExpandedId(null);
      setRepairNotice(
        `Eliminados ${result.deleted_count} duplicados en ${result.group_count} grupos.`
      );
      await reloadSummary();
      await loadPage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar duplicados');
    } finally {
      setBusy(null);
    }
  };

  const deleteSelected = async () => {
    if (!hasSelection || (!engagementId && !isRepository)) return;
    setBusy('delete');
    setError(null);
    try {
      let deleted = 0;
      if (selectAllInQuery) {
        if (isRepository) {
          const { findings: all } = await listAllFindingsInRepository({
            severidad:
              !severidadesMulti?.length && severityFilter !== 'all' ? severityFilter : undefined,
            severidades: severidadesMulti,
            q: deferredSearch || undefined,
            tool_source: toolSourceFilterApiValue(toolSourceFilter),
          });
          deleted = await bulkDeleteFindingsBatched(all.map((f) => f.id));
        } else {
          const result = await bulkDeleteFindingsByQuery({
            engagement_id: engagementId!,
            severidad:
              !severidadesMulti?.length && severityFilter !== 'all' ? severityFilter : undefined,
            severidades: severidadesMulti,
            q: deferredSearch || undefined,
          });
          deleted = result.deleted_count;
        }
      } else {
        deleted = await bulkDeleteFindingsBatched([...selected]);
      }
      clearSelection();
      setConfirmDelete(false);
      setExpandedId(null);
      setRepairNotice(`Eliminados ${deleted.toLocaleString()} hallazgos.`);
      await reloadSummary();
      await loadPage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar hallazgos');
    } finally {
      setBusy(null);
    }
  };

  const geminiTargetFindings = useMemo(() => {
    if (selected.size > 0 && !selectAllInQuery) {
      return findings.filter((f) => selected.has(f.id));
    }
    return filtered;
  }, [findings, selected, selectAllInQuery, filtered]);

  const runGeminiOnSelected = async () => {
    if (!engagementId || geminiTargetFindings.length === 0) {
      setError('Selecciona hallazgos o aplica un filtro con resultados en la página actual.');
      return;
    }
    setBusy('gemini');
    setError(null);
    setRepairNotice(null);
    setGeminiProgress({ done: 0, total: 1 });

    try {
      await loadCatalogFieldConfig();
      const result = await fillCatalogSpanishAndPropagate(geminiTargetFindings, engagementId, {
        fieldConfig: getCatalogFieldConfigSync(),
        onProgress: (done, total) => setGeminiProgress({ done, total }),
      });
      setEditForms({});
      await loadPage({ replaceForms: true });
      await reloadSummary();
      setRepairNotice(
        `Catálogo: ${result.catalogGroups} tipo${result.catalogGroups === 1 ? '' : 's'} · ${result.fieldsFilled} campos Español mejorados · ${result.findingsPropagated} hallazgo${result.findingsPropagated === 1 ? '' : 's'} sincronizado${result.findingsPropagated === 1 ? '' : 's'}`
      );
      if (result.errors.length) {
        setError(result.errors.slice(0, 2).join(' · '));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error con Gemini en catálogo');
    } finally {
      setBusy(null);
      setGeminiProgress(null);
    }
  };

  if (!canLoad) {
    return (
      <p className="text-sm text-amber-400/90">
        Selecciona un proyecto en el paso 1 para revisar hallazgos importados.
      </p>
    );
  }

  const isAdvancedFilter = ADVANCED_FILTER_OPTIONS.some((o) => o.id === filter);

  const toggleSeverityFilter = (sev: Severity) => {
    const active = severidadesMulti?.length === 1 && severidadesMulti[0] === sev;
    setSeveridadesMulti(active ? undefined : [sev]);
    setSeverityFilter('all');
    setPage(1);
  };

  return (
    <div className="space-y-2">
      {stats.total > 0 && !loading && (
        <FindingsReviewToolbar
          searchQuery={searchQ}
          onSearchQueryChange={setSearchQ}
          searchInputRef={searchRef}
          showSearch={viewMode === 'spreadsheet'}
          stats={stats}
          filteredTotal={filteredTotal}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          severitySort={severitySort}
          onSeveritySortToggle={() => setSeveritySort((s) => !s)}
          severityCounts={severityCounts}
          severidadesMulti={severidadesMulti}
          onToggleSeverityFilter={toggleSeverityFilter}
          onClearSeverityFilter={() => {
            setSeveridadesMulti(undefined);
            setPage(1);
          }}
          filter={filter}
          onFilterChange={setFilter}
          advancedOpen={advancedOpen}
          onAdvancedOpenChange={setAdvancedOpen}
          isAdvancedFilter={isAdvancedFilter}
          filteredPageCount={filtered.length}
          selectionCount={selectionCount}
          hasSelection={hasSelection}
          selectAllInQuery={selectAllInQuery}
          selectingAll={selectingAll}
          onSelectAllInQuery={() => void selectAllInCurrentQuery()}
          onSelectAllOnPage={selectAllOnPage}
          onClearSelection={clearSelection}
          busy={busy}
          geminiTargetCount={geminiTargetFindings.length}
          geminiProgress={geminiProgress}
          onGeminiCatalog={() => void runGeminiOnSelected()}
          onConsolidateEngagement={() => void consolidateTargets([], 'Proyecto')}
          onConsolidatePage={() => void consolidateTargets(filtered, 'Página')}
          onConsolidateSelection={() =>
            void consolidateTargets(findings.filter((f) => selected.has(f.id)), 'Selección')
          }
          onSyncEngagement={() => void syncEngagementFromCatalog()}
          onSyncPage={() => void syncFromCatalog(filtered, 'Página')}
          onSyncSelection={() =>
            void syncFromCatalog(findings.filter((f) => selected.has(f.id)), 'Selección')
          }
          onDeleteDuplicates={() => setConfirmDeleteDuplicates(true)}
          onRepairText={() => void runRepairText()}
          onTruncateExplicacion={() => void runTruncateExplicacion()}
          explicacionMaxParagraphs={EXPLICACION_TECNICA_MAX_PARAGRAPHS}
          onDeleteSelected={() => setConfirmDelete(true)}
          engagementId={engagementId}
          showSpreadsheetActions={viewMode === 'spreadsheet'}
          showTableOptions={viewMode === 'spreadsheet'}
          missingField={tableMissingField}
          onMissingFieldChange={setTableMissingField}
          missingFieldOptions={missingFieldOptions}
          showAllFields={tableShowAllFields}
          onShowAllFieldsChange={setTableShowAllFields}
          density={tableDensity}
          onDensityChange={(next) => {
            saveTableDensity(next);
            setTableDensity(next);
          }}
          columnFilterCount={columnFilterMeta.count}
          onClearColumnFilters={columnFilterMeta.clear}
          detailView={tableDetailView}
          onDetailViewChange={setTableDetailView}
          onDetailPreset={(preset) => {
            if (preset.enableDetailView) setTableDetailView(true);
            setDetailPreset({
              key: Date.now(),
              enableDetailView: preset.enableDetailView,
              filter: preset.filter as NonNullable<typeof detailPreset>['filter'],
              sort: preset.sort as NonNullable<typeof detailPreset>['sort'],
            });
          }}
          aiGroupedView={aiGroupedView}
          onAiGroupedViewToggle={() => {
            setAiGroupedView((v) => {
              const next = !v;
              if (next) setViewMode('grouped');
              return next;
            });
          }}
          onAssignAiGroups={isRepository ? undefined : () => void assignAiGroups()}
          showToolSourceFilter={isRepository}
          toolSourceFilter={toolSourceFilter}
          onToolSourceFilterChange={(id) => {
            setToolSourceFilter(id);
            setPage(1);
          }}
        />
      )}

      {aiGroupedView && viewMode === 'grouped' ? (
        <p className="text-[10px] text-indigo-400/90">
          Vista «Agrupados IA»: {aiGrouped.length} grupo{aiGrouped.length === 1 ? '' : 's'} en esta
          página ({filtered.length} hallazgos).
        </p>
      ) : null}

      {filter !== 'all' && viewMode === 'spreadsheet' ? (
        <p className="text-[10px] text-amber-400/90">
          Filtro «
          {[...PRIMARY_FILTER_OPTIONS, ...ADVANCED_FILTER_OPTIONS].find((o) => o.id === filter)?.label ??
            filter}
          » aplicado en la página actual ({filtered.length} de {findings.length} cargados).
        </p>
      ) : null}

      {viewMode !== 'spreadsheet' && filteredTotal > findings.length ? (
        <p className="text-xs text-amber-400">
          Vista {viewMode === 'grouped' ? 'agrupada' : 'lista'}: solo la página actual (
          {findings.length} de {filteredTotal.toLocaleString()}). Usa Tabla para navegar.
        </p>
      ) : null}

      {repairNotice && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{repairNotice}</p>
      )}

      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1.5">
          <AlertTriangle className="size-3.5" />
          {error}
        </p>
      )}

      {confirmDeleteDuplicates && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-2 space-y-2 text-xs">
          <p className="text-orange-100">
            Eliminar <strong>{stats.duplicateRemove}</strong> duplicados en{' '}
            <strong>{stats.duplicateGroups}</strong> grupos.
          </p>
          <div className="flex gap-2 justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setConfirmDeleteDuplicates(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="h-6 text-[11px] bg-orange-600" disabled={busy === 'delete'} onClick={() => void deleteDuplicates()}>
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="text-rose-200">
            ¿Eliminar {selectionCount.toLocaleString()} hallazgo{selectionCount === 1 ? '' : 's'}
            {selectAllInQuery && severidadesMulti?.length === 1
              ? ` (${SEVERITY_SELECT_LABEL[severidadesMulti[0]]})`
              : ''}
            ?
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="h-6 text-[11px] bg-rose-600" disabled={busy === 'delete'} onClick={() => void deleteSelected()}>
              Confirmar
            </Button>
          </div>
        </div>
      )}

      {selectAllInQuery && (
        <p className="text-xs text-violet-300 border border-violet-500/30 bg-violet-500/5 rounded-lg px-3 py-1.5">
          Seleccionados <strong>{selectionCount.toLocaleString()}</strong> hallazgos
          {severidadesMulti?.length === 1
            ? ` (${SEVERITY_SELECT_LABEL[severidadesMulti[0]]})`
            : ' de la consulta actual'}
          . Pulsa <strong>Eliminar</strong> para borrarlos (incluye páginas no visibles).
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Cargando hallazgos…
        </p>
      ) : stats.total === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          No hay hallazgos en este proyecto. Importa Nessus/Acunetix en el paso anterior.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          Ningún hallazgo coincide con el filtro en esta página.
        </p>
      ) : viewMode === 'spreadsheet' ? (
        <FindingsSpreadsheetTable
          findings={filtered}
          selected={effectiveSelected}
          onToggleSelect={toggleSelect}
          onSelectAll={(ids) => {
            setSelectAllInQuery(false);
            setSelected(new Set(ids));
          }}
          expandedId={expandedId}
          onRowClick={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          severityFilter="all"
          searchQuery={searchQ}
          onSearchQueryChange={setSearchQ}
          serverSearch
          externalToolbar
          completenessFilter={filter}
          onCompletenessFilterChange={setFilter}
          missingField={tableMissingField}
          onMissingFieldChange={setTableMissingField}
          showAllFields={tableShowAllFields}
          onShowAllFieldsChange={setTableShowAllFields}
          density={tableDensity}
          onDensityChange={(next) => {
            saveTableDensity(next);
            setTableDensity(next);
          }}
          onColumnFilterMetaChange={setColumnFilterMeta}
          detailView={tableDetailView}
          onDetailViewChange={setTableDetailView}
          detailPreset={detailPreset}
          onServerSeverityFilter={(severities) => {
            setSeveridadesMulti(severities);
            setSeverityFilter('all');
          }}
          pagination={{
            total: filteredTotal,
            page,
            pageSize,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              saveFindingsPageSize(size);
              setPageSize(size);
              setPage(1);
            },
            loading: pageLoading,
          }}
          hideFooterSelection
          engagementId={engagementId}
          onCatalogColumnGeminiDone={async (columnId, result) => {
            setEditForms({});
            await loadPage({ replaceForms: true });
            await reloadSummary();
            const label = SPREADSHEET_COLUMNS.find((c) => c.id === columnId)?.label ?? columnId;
            setRepairNotice(
              `Columna ${label}: ${result.catalogGroups} tipo${result.catalogGroups === 1 ? '' : 's'} en catálogo · ${result.findingsPropagated} hallazgo${result.findingsPropagated === 1 ? '' : 's'} propagado${result.findingsPropagated === 1 ? '' : 's'}`
            );
            if (result.errors.length) {
              setError(result.errors.slice(0, 2).join(' · '));
            }
          }}
          renderExpandedRow={(f) => {
            const form = editForms[f.id] ?? findingToFormValues(f);
            return (
              <div className="space-y-3">
                <FindingFormEditor
                  values={form}
                  onChange={(v) => setEditForms((prev) => ({ ...prev, [f.id]: v }))}
                  onSave={() => void saveFinding(f.id)}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <OpenCatalogButton
                    finding={f}
                    className="h-8 text-xs border-emerald-700/50 text-emerald-300"
                  />
                  <SyncCatalogButton
                    finding={f}
                    label="Actualizar desde catálogo"
                    className="h-8 text-xs border-sky-700/50 text-sky-300"
                    onSynced={handleFindingSynced}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500"
                    disabled={busy !== null}
                    onClick={() => void saveFinding(f.id)}
                  >
                    {busy === 'save' ? (
                      <Loader2 className="size-4 mr-1 animate-spin" />
                    ) : (
                      <Save className="size-4 mr-1" />
                    )}
                    Guardar cambios
                  </Button>
                </div>
                <FindingDetailExtras finding={f} />
              </div>
            );
          }}
        />
      ) : viewMode === 'grouped' ? (
        <GroupedFindingsView
          groups={displayGroups}
          expandedGroupKey={expandedGroupKey}
          onToggleGroup={(key) => setExpandedGroupKey((k) => (k === key ? null : key))}
          selectedIds={effectiveSelected}
          onToggleMember={toggleSelect}
          emptyMessage={
            aiGroupedView
              ? 'Ningún grupo IA con 2+ hallazgos en esta página.'
              : 'Ningún hallazgo para agrupar.'
          }
          renderMember={(f) => {
            const c = findingCompleteness(f);
            const isOpen = expandedId === f.id;
            const isSelected = effectiveSelected.has(f.id);
            const form = editForms[f.id] ?? findingToFormValues(f);
            const host = resolveFindingComponente(f);
            return (
              <div key={f.id} className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => toggleSelect(f.id)} className="mt-1 text-slate-400">
                    {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0"
                    onClick={() => setExpandedId(isOpen ? null : f.id)}
                  >
                    <span className="text-xs text-slate-200 font-mono">{host || 'Sin componente'}</span>
                    <span className="text-[10px] text-slate-500 ml-2">{c.percent}%</span>
                  </button>
                </div>
                {isOpen && (
                  <div className="mt-2 pl-6 border-t border-slate-800/60 pt-2 space-y-2">
                    <FindingMasterCatalogMeta finding={f} />
                    <FindingFormEditor
                      values={form}
                      onChange={(v) => setEditForms((prev) => ({ ...prev, [f.id]: v }))}
                      onSave={() => void saveFinding(f.id)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500"
                        disabled={busy !== null}
                        onClick={() => void saveFinding(f.id)}
                      >
                        Guardar
                      </Button>
                      <OpenCatalogButton
                        finding={f}
                        className="h-8 text-xs border-emerald-700/50 text-emerald-300"
                      />
                    </div>
                    <FindingHistoryTimeline finding={f} />
                  </div>
                )}
              </div>
            );
          }}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => {
            const c = findingCompleteness(f);
            const isOpen = expandedId === f.id;
            const isSelected = effectiveSelected.has(f.id);
            const form = editForms[f.id] ?? findingToFormValues(f);

            return (
              <Card
                key={f.id}
                className={cn(
                  'border-slate-800 bg-slate-950/50 overflow-hidden transition-colors',
                  isSelected && 'border-violet-500/40 ring-1 ring-violet-500/20'
                )}
              >
                <div className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggleSelect(f.id)}
                    className="mt-1 shrink-0 text-slate-400 hover:text-violet-300"
                  >
                    {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                  </button>
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0"
                    onClick={() => setExpandedId(isOpen ? null : f.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="size-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-slate-500 shrink-0" />
                      )}
                      <span className="text-sm font-medium text-slate-100 truncate max-w-[280px] sm:max-w-md">
                        {f.titulo}
                      </span>
                      <SeverityBadge severity={f.severidad} compact />
                      <CompletenessIndicator percent={c.percent} />
                      {c.geminiReady && (
                        <span className="text-[10px] text-violet-400 flex items-center gap-0.5">
                          <Sparkles className="size-3" />
                          Gemini
                        </span>
                      )}
                    </div>
                    {!isOpen && c.missing.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-1 pl-6 line-clamp-1">
                        Falta: {c.missing.join(' · ')}
                      </p>
                    )}
                  </button>
                </div>

                {!isOpen && (
                  <div className="px-3 pb-3 pl-11 flex flex-wrap gap-1">
                    {REVIEW_FIELDS.map(({ key, label }) => {
                      const ok = !c.missingKeys.includes(key);
                      return (
                        <span
                          key={key}
                          className={cn(
                            'text-[9px] px-1.5 py-0.5 rounded border',
                            ok
                              ? 'border-emerald-500/30 text-emerald-400/80 bg-emerald-500/5'
                              : 'border-rose-500/30 text-rose-400/90 bg-rose-500/5'
                          )}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {isOpen && (
                  <CardContent className="pt-0 border-t border-slate-800/80 space-y-3">
                    <FindingMasterCatalogMeta finding={f} />
                    <FindingFormEditor
                      values={form}
                      onChange={(v) => setEditForms((prev) => ({ ...prev, [f.id]: v }))}
                      onSave={() => void saveFinding(f.id)}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <OpenCatalogButton
                        finding={f}
                        className="h-8 text-xs border-emerald-700/50 text-emerald-300"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-500"
                        disabled={busy !== null}
                        onClick={() => void saveFinding(f.id)}
                      >
                        {busy === 'save' ? (
                          <Loader2 className="size-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="size-4 mr-1" />
                        )}
                        Guardar cambios
                      </Button>
                    </div>
                    <FindingHistoryTimeline finding={f} />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {stats.total > 0 && (
        <p className="text-[10px] text-slate-600 text-center">
          {filteredTotal.toLocaleString()} en consulta · página {page}
        </p>
      )}
    </div>
  );
}
