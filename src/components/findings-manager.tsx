'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Terminal,
  ChevronDown,
  ChevronRight,
  Pencil,
  Layers,
  User,
  ArrowDownWideNarrow,
  Table2,
  Copy,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEngagementLoadGuard } from '@/lib/engagement-load-guard';
import {
  FindingFormEditor,
  EMPTY_FINDING_FORM,
  findingToFormValues,
  formValuesToPayload,
  type FindingFormValues,
} from '@/components/finding-form-editor';
import {
  bulkDeleteFindings,
  bulkValidateFindings,
  countFindings,
  createFinding,
  deduplicateFindingsEngagement,
  enrichFinding,
  fetchProjectSummary,
  loadFindingsPageSize,
  resolveFindingsListPaging,
  saveFindingsPageSize,
  type FindingsOrderBy,
  type FindingsUiPageSize,
  listFindings,
  suggestFindingFields,
  suggestFindingField,
  updateFinding,
  updateFindingStatus,
  uploadEvidence,
  type Finding,
  type ProjectSummary,
  type Severity,
} from '@/lib/secops-api';
import {
  FindingEvidencePanel,
  type PendingImage,
} from '@/components/finding-evidence-panel';
import { suggestionToFormValues } from '@/lib/finding-suggest';
import { RawOutputIngestBar, type RawIngestResult } from '@/components/raw-output-ingest-bar';
import { useAiFormFill } from '@/hooks/use-ai-form-fill';
import type { AiFormFieldKey } from '@/lib/ai-form-fields';
import {
  BulkFindingsIngestPanel,
  type DraftFinding,
} from '@/components/bulk-findings-ingest-panel';
import { BulkFindingsDraftsList } from '@/components/bulk-findings-drafts-list';
import {
  loadDraftFindings,
  saveDraftFindings,
} from '@/lib/reports-session';
import { sortBySeverity as sortItemsBySeverity } from '@/lib/severity-sort';
import { buildGeminiContext } from '@/lib/gemini-context';
import { groupFindingsForDisplay, resolveFindingComponente } from '@/lib/finding-grouping';
import { GroupedFindingsView } from '@/components/grouped-findings-view';
import { OpenCatalogButton } from '@/components/open-catalog-button';
import { FindingsSpreadsheetTable } from '@/components/findings-spreadsheet-table';
import { formatDuplicatePreviewLabel } from '@/lib/finding-duplicates';
import { syncFindingsFromCatalog } from '@/lib/catalog-from-finding';

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  High: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  Info: 'text-muted-foreground bg-muted border-border',
};

function findingFormHasContent(form: FindingFormValues, pendingImages: PendingImage[] = []): boolean {
  if (pendingImages.length > 0) return true;
  if (form.titulo.trim()) return true;
  const textFields: (keyof FindingFormValues)[] = [
    'descripcion',
    'amenaza_ampliada',
    'propuesta_remediacion',
    'referencias',
    'metodo_deteccion',
    'explicacion_tecnica',
    'raw_tool_output',
    'cve',
    'cwe',
    'cvss_score',
  ];
  if (textFields.some((k) => String(form[k]).trim())) return true;
  return form.componentes_afectados.some((c) => c.trim());
}

const SEVERITY_LABEL: Record<string, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Info',
};

export function FindingsManager({
  engagementId,
  projectName,
  refreshToken,
}: {
  engagementId?: string;
  projectName?: string;
  /** Incrementar tras ingesta automática para recargar la lista. */
  refreshToken?: number;
}) {
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
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<FindingFormValues>(EMPTY_FINDING_FORM);
  const [editForms, setEditForms] = useState<Record<string, FindingFormValues>>({});
  const [newPendingImages, setNewPendingImages] = useState<PendingImage[]>([]);
  const [suggestingField, setSuggestingField] = useState<AiFormFieldKey | null>(null);
  const [aiFillSource, setAiFillSource] = useState<string>('structured');
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single');
  const [draftFindings, setDraftFindings] = useState<DraftFinding[]>([]);
  const [draftMeta, setDraftMeta] = useState<{ source: string; warning?: string } | null>(null);
  const [savingDrafts, setSavingDrafts] = useState(false);
  const [suggestingDraftId, setSuggestingDraftId] = useState<string | null>(null);
  const [draftSaveNotice, setDraftSaveNotice] = useState<string | null>(null);
  const [severitySorted, setSeveritySorted] = useState(true);
  const [severidadesMulti, setSeveridadesMulti] = useState<import('@/lib/secops-api').Severity[] | undefined>();
  const [pageSize, setPageSize] = useState<FindingsUiPageSize>(50);
  const [viewMode, setViewMode] = useState<'grouped' | 'list' | 'spreadsheet'>('spreadsheet');
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [confirmDeleteDuplicates, setConfirmDeleteDuplicates] = useState(false);
  const [aiIngestOpen, setAiIngestOpen] = useState(false);
  const displayedFindings = useMemo(() => {
    if (!severitySorted) return findings;
    return sortItemsBySeverity(findings, (f) => f.severidad);
  }, [findings, severitySorted]);

  const groupedFindings = useMemo(
    () => groupFindingsForDisplay(displayedFindings),
    [displayedFindings]
  );

  const duplicateInfo = summary?.duplicates;

  const {
    displayForm: aiDisplayForm,
    setDisplayForm: setAiDisplayForm,
    animatingField,
    aiSuggested,
    isFilling,
    fillProgress,
    animateFill,
    animateSingleField,
    markFieldSuggested,
    resetAiState,
  } = useAiFormFill();

  const newFormVisible = isFilling || animatingField || suggestingField ? aiDisplayForm : newForm;
  const newFormAiSuggested = aiSuggested;

  const uploadPendingForFinding = async (findingId: string, images: PendingImage[]) => {
    for (const p of images) {
      await uploadEvidence(findingId, p.file, 'screenshot');
      URL.revokeObjectURL(p.preview);
    }
  };

  useEffect(() => {
    setPageSize(loadFindingsPageSize());
  }, []);

  const loadSummary = useCallback(async () => {
    if (!engagementId) {
      setSummary(null);
      return;
    }
    const data = await fetchProjectSummary(engagementId);
    setSummary(data);
  }, [engagementId]);

  const { beginLoad, invalidate, isStale } = useEngagementLoadGuard();

  const loadPage = useCallback(async () => {
    if (!engagementId) {
      setFindings([]);
      setFilteredTotal(0);
      setLoading(false);
      return;
    }
    const generation = beginLoad();
    setPageLoading(true);
    setError(null);
    try {
      const orderBy: FindingsOrderBy = severitySorted ? 'severidad_asc' : 'created_at_desc';
      const countParams = {
        engagement_id: engagementId,
        q: deferredSearch,
        severidades: severidadesMulti,
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
      setEditForms(() => {
        const next: Record<string, FindingFormValues> = {};
        for (const f of rows) {
          next[f.id] = findingToFormValues(f);
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
    engagementId,
    page,
    pageSize,
    deferredSearch,
    severidadesMulti,
    severitySorted,
    beginLoad,
    isStale,
  ]);

  const reloadAll = useCallback(async () => {
    if (!engagementId) return;
    await Promise.all([loadSummary(), loadPage()]);
  }, [engagementId, loadSummary, loadPage]);

  useEffect(() => {
    invalidate();
    if (!engagementId) {
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
    void loadSummary().catch((e) => {
      setError(e instanceof Error ? e.message : 'Error al cargar resumen');
      setLoading(false);
    });
  }, [engagementId, refreshToken, loadSummary, invalidate]);

  useEffect(() => {
    if (!engagementId) return;
    void loadPage();
  }, [engagementId, page, pageSize, deferredSearch, severidadesMulti, severitySorted, refreshToken, loadPage]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, engagementId, refreshToken, pageSize, severidadesMulti]);

  useEffect(() => {
    if (!engagementId) {
      setDraftFindings([]);
      return;
    }
    setDraftFindings(loadDraftFindings(engagementId));
  }, [engagementId]);

  useEffect(() => {
    if (engagementId) saveDraftFindings(engagementId, draftFindings);
  }, [draftFindings, engagementId]);

  useEffect(() => {
    if (!animatingField) return;
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-ai-field="${animatingField}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [animatingField]);

  const handleRawIngestFilled = useCallback(
    (result: RawIngestResult) => {
      setEntryMode('single');
      setShowNew(true);
      setExpandedId(null);
      setError(null);
      setAiFillSource(result.source);
      void (async () => {
        const filled = await animateFill(result.values, result.filledFields);
        setNewForm(filled);
      })();
    },
    [animateFill]
  );

  const openNewEmptyFinding = () => {
    setEntryMode('single');
    setShowNew(true);
    setExpandedId(null);
    setError(null);
    resetAiState();
    setNewForm(EMPTY_FINDING_FORM);
    setNewPendingImages([]);
  };

  const cancelNewFinding = () => {
    const current = isFilling || animatingField || suggestingField ? aiDisplayForm : newForm;
    if (findingFormHasContent(current, newPendingImages)) {
      if (!confirm('¿Descartar el reporte en curso? Los datos no guardados se perderán.')) return;
    }
    for (const p of newPendingImages) URL.revokeObjectURL(p.preview);
    setShowNew(false);
    resetAiState();
    setNewForm(EMPTY_FINDING_FORM);
    setNewPendingImages([]);
    setError(null);
  };

  const handleDeleteFinding = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar el hallazgo «${titulo}»? Esta acción no se puede deshacer.`)) return;
    setBusy(`delete-${id}`);
    setError(null);
    try {
      await bulkDeleteFindings([id]);
      setExpandedId((cur) => (cur === id ? null : cur));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar hallazgo');
    } finally {
      setBusy(null);
    }
  };

  const handleNewFormChange = (values: FindingFormValues) => {
    if (isFilling) setAiDisplayForm(values);
    else setNewForm(values);
  };

  const geminiContext = useMemo(
    () => buildGeminiContext({ projectName, engagementId }),
    [projectName, engagementId]
  );

  const suggestSingleField = (field: AiFormFieldKey) => {
    return async () => {
      const base = isFilling ? aiDisplayForm : newForm;
      const raw = base.raw_tool_output;
      if (!raw.trim()) {
        setError('Pega salida cruda en «Salidas de herramienta» o arriba antes de sugerir.');
        return;
      }
      setSuggestingField(field);
      setError(null);
      setAiDisplayForm(base);
      try {
        const { value, source } = await suggestFindingField(
          field,
          raw,
          geminiContext,
          base as unknown as Record<string, unknown>
        );
        if (field === 'severidad') {
          await animateSingleField(field, value as Severity);
          setNewForm((prev) => ({ ...prev, severidad: value as Severity }));
        } else if (field === 'componentes_afectados') {
          const arr = Array.isArray(value) ? value : [String(value)];
          const list = arr.length ? arr : [''];
          await animateSingleField(field, list);
          setNewForm((prev) => ({ ...prev, componentes_afectados: list }));
        } else {
          const str = Array.isArray(value) ? value.join('\n') : String(value ?? '');
          await animateSingleField(field, str);
          setNewForm((prev) => ({ ...prev, [field]: str }));
        }
        markFieldSuggested(field);
        setAiFillSource(source);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al sugerir campo');
      } finally {
        setSuggestingField(null);
      }
    };
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (f: Finding) => {
    setEditForms((prev) => ({ ...prev, [f.id]: findingToFormValues(f) }));
    setExpandedId((cur) => (cur === f.id ? null : f.id));
  };

  const handleFindingSynced = (updated: Finding) => {
    setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditForms((prev) => ({ ...prev, [updated.id]: findingToFormValues(updated) }));
  };

  const syncFromCatalog = async (targets: Finding[], label: string) => {
    if (!targets.length) return;
    setBusy('sync-catalog');
    setError(null);
    try {
      const { synced, skipped, errors } = await syncFindingsFromCatalog(targets);
      await loadPage();
      await reloadAll();
      if (errors.length && synced > 0) {
        setError(`${label}: ${synced} ok, ${skipped} sin catálogo, ${errors.length} fallos`);
      } else if (errors.length && synced === 0) {
        setError(errors[0] ?? 'No se pudo actualizar desde catálogo');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sincronizar catálogo');
    } finally {
      setBusy(null);
    }
  };

  const deleteDuplicates = async () => {
    if (!engagementId || !duplicateInfo?.remove_count) return;
    setBusy('delete-dupes');
    setError(null);
    try {
      await deduplicateFindingsEngagement(engagementId);
      setConfirmDeleteDuplicates(false);
      setExpandedId(null);
      await reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar duplicados');
    } finally {
      setBusy(null);
    }
  };

  const applySuggestion = (target: 'new' | string, raw: string) => {
    return async () => {
      if (!raw.trim()) {
        setError('Pega salida cruda antes de sugerir.');
        return;
      }
      setBusy(target === 'new' ? 'suggest-new' : `suggest-${target}`);
      setError(null);
      try {
        const { suggestion } = await suggestFindingFields(raw, geminiContext);
        const merged = suggestionToFormValues(
          suggestion,
          raw,
          target === 'new' ? newForm : editForms[target] || EMPTY_FINDING_FORM
        );
        if (target === 'new') setNewForm(merged);
        else setEditForms((prev) => ({ ...prev, [target]: merged }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al sugerir con Gemini');
      } finally {
        setBusy(null);
      }
    };
  };

  const persistDraftsToDb = async (toSave: DraftFinding[], opts?: { auto?: boolean }) => {
    if (!toSave.length) return 0;
    if (!engagementId) {
      setError('Selecciona un proyecto en el paso 1 para guardar hallazgos en la base de datos.');
      return 0;
    }
    setSavingDrafts(true);
    setError(null);
    setDraftSaveNotice(null);
    let saved = 0;
    const savedIds: string[] = [];
    try {
      for (const draft of toSave) {
        if (!draft.values.titulo.trim()) continue;
        await createFinding(formValuesToPayload(draft.values, engagementId));
        saved += 1;
        savedIds.push(draft.id);
      }
      if (saved > 0) {
        const idSet = new Set(savedIds);
        setDraftFindings((prev) => prev.filter((d) => !idSet.has(d.id)));
        await reloadAll();
        const msg = opts?.auto
          ? `${saved} hallazgo${saved !== 1 ? 's' : ''} guardado${saved !== 1 ? 's' : ''} automáticamente en la base de datos.`
          : `${saved} hallazgo${saved !== 1 ? 's' : ''} guardado${saved !== 1 ? 's' : ''} en la base de datos.`;
        setDraftSaveNotice(msg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar hallazgos');
    } finally {
      setSavingDrafts(false);
    }
    return saved;
  };

  const handleCreate = async () => {
    if (!newForm.titulo.trim()) return;
    if (!engagementId) {
      setError('Selecciona un proyecto en el paso 1 antes de guardar.');
      return;
    }
    setBusy('create');
    try {
      const created = await createFinding(formValuesToPayload(newForm, engagementId));
      if (newPendingImages.length) {
        await uploadPendingForFinding(created.id, newPendingImages);
        setNewPendingImages([]);
      }
      setNewForm(EMPTY_FINDING_FORM);
      setShowNew(false);
      await reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear hallazgo');
    } finally {
      setBusy(null);
    }
  };

  const handleCreateAndValidate = async () => {
    if (!newForm.titulo.trim()) return;
    if (!engagementId) {
      setError('Selecciona un proyecto en el paso 1 antes de guardar.');
      return;
    }
    setBusy('create');
    try {
      const created = await createFinding(formValuesToPayload(newForm, engagementId));
      if (newPendingImages.length) {
        await uploadPendingForFinding(created.id, newPendingImages);
        setNewPendingImages([]);
      }
      await updateFindingStatus(created.id, 'Validado', 'Validado al publicar');
      setNewForm(EMPTY_FINDING_FORM);
      setShowNew(false);
      await reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al publicar hallazgo');
    } finally {
      setBusy(null);
    }
  };

  const handleSaveEdit = async (id: string) => {
    const form = editForms[id];
    if (!form?.titulo.trim()) return;
    setBusy(`save-${id}`);
    try {
      const { engagement_id: _, ...payload } = formValuesToPayload(form, engagementId);
      await updateFinding(id, payload);
      await reloadAll();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setBusy(null);
    }
  };

  const handlePublishEdit = async (id: string) => {
    const form = editForms[id];
    if (!form?.titulo.trim()) return;
    setBusy(`pub-${id}`);
    try {
      const { engagement_id: _, ...payload } = formValuesToPayload(form, engagementId);
      await updateFinding(id, payload);
      await updateFindingStatus(id, 'Validado', 'Validado y publicado');
      await reloadAll();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al publicar');
    } finally {
      setBusy(null);
    }
  };

  const handleBulkValidate = async () => {
    if (selected.size === 0) return;
    setBusy('bulk');
    try {
      await bulkValidateFindings([...selected], 'Validación masiva');
      setSelected(new Set());
      await reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en validación masiva');
    } finally {
      setBusy(null);
    }
  };

  const handleSuggestDraft = async (draftId: string) => {
    const draft = draftFindings.find((d) => d.id === draftId);
    if (!draft?.values.raw_tool_output.trim()) {
      setError('Este borrador no tiene salida cruda — pega texto en «Salidas de herramienta».');
      return;
    }
    setSuggestingDraftId(draftId);
    setError(null);
    try {
      const { suggestion, source, warning } = await suggestFindingFields(
        draft.values.raw_tool_output,
        geminiContext
      );
      const merged = suggestionToFormValues(suggestion, draft.values.raw_tool_output, draft.values);
      setDraftFindings((prev) =>
        prev.map((d) =>
          d.id === draftId
            ? { ...d, values: merged, source, expanded: true }
            : d
        )
      );
      if (warning) setDraftMeta((m) => ({ source, warning }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al sugerir con Gemini');
    } finally {
      setSuggestingDraftId(null);
    }
  };

  const handleSaveDrafts = async (selected: DraftFinding[]) => {
    if (!selected.length) return;
    await persistDraftsToDb(selected);
  };

  const handleDraftsReady = async (
    drafts: DraftFinding[],
    meta: { source: string; warning?: string }
  ) => {
    setDraftFindings((prev) => [...drafts, ...prev]);
    setDraftMeta(meta);
    setEntryMode('bulk');
    if (!engagementId) {
      setError('Selecciona un proyecto en el paso 1. Los borradores quedan en el navegador hasta que guardes.');
      return;
    }
    await persistDraftsToDb(drafts, { auto: true });
  };

  return (
    <div className="space-y-4">
      {/* Modo: un hallazgo vs múltiples */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/80 border border-border w-fit">
        <button
          type="button"
          onClick={() => setEntryMode('single')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            entryMode === 'single'
              ? 'bg-violet-600 text-white'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <User className="size-3.5" />
          Un hallazgo
        </button>
        <button
          type="button"
          onClick={() => setEntryMode('bulk')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
            entryMode === 'bulk'
              ? 'bg-sky-600 text-white'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Layers className="size-3.5" />
          Múltiples hallazgos
        </button>
      </div>

      {entryMode === 'single' && !showNew && (
        <button
          type="button"
          onClick={openNewEmptyFinding}
          className="w-full rounded-2xl border-2 border-dashed border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-card p-8 text-center hover:border-violet-400/60 hover:from-violet-500/15 transition-all group"
        >
          <Plus className="size-10 text-violet-500 dark:text-violet-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <span className="text-lg font-semibold text-foreground block">Nuevo Reporte de Vulnerabilidad</span>
          <span className="text-sm text-muted-foreground mt-1 block">
            Crear hallazgo vacío y completar manualmente — la IA es opcional
          </span>
        </button>
      )}

      {entryMode === 'single' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setAiIngestOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
          >
            {aiIngestOpen ? (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            )}
            <Sparkles className="size-4 text-violet-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Asistencia IA con salida cruda</p>
              <p className="text-xs text-muted-foreground">Opcional — pega Nessus/Nmap y Gemini rellena el formulario</p>
            </div>
          </button>
          {aiIngestOpen && (
            <div className="px-4 pb-4 border-t border-border">
              <RawOutputIngestBar
                embedded
                engagementId={engagementId}
                projectName={projectName}
                onFilled={handleRawIngestFilled}
              />
            </div>
          )}
        </div>
      )}

      {entryMode === 'bulk' && (
        <>
          <BulkFindingsIngestPanel
            embedded
            engagementId={engagementId}
            projectName={projectName}
            onDraftsReady={(drafts, meta) => void handleDraftsReady(drafts, meta)}
          />
          <BulkFindingsDraftsList
            drafts={draftFindings}
            onChange={setDraftFindings}
            onSaveAll={handleSaveDrafts}
            onSuggestDraft={handleSuggestDraft}
            suggestingDraftId={suggestingDraftId}
            saving={savingDrafts}
            source={draftMeta?.source}
            warning={draftMeta?.warning}
          />
          {!draftFindings.length && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Pega un raw largo arriba y pulsa &quot;Separar hallazgos con Gemini&quot;, o genera borradores y
              usa &quot;Añadir manual&quot; en la lista.
            </p>
          )}
        </>
      )}

      {entryMode === 'single' && (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => void reloadAll()} disabled={loading}>
          <RefreshCw className={cn('size-3.5 mr-1.5', loading && 'animate-spin')} />
          Actualizar
        </Button>
        {selected.size > 0 && (
          <Button type="button" size="sm" onClick={() => void handleBulkValidate()} disabled={busy === 'bulk'}>
            {busy === 'bulk' ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1.5" />}
            Validar ({selected.size})
          </Button>
        )}
      </div>
      )}

      {entryMode === 'single' && error && (
        <p className="text-xs text-rose-400 flex items-center gap-1.5">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {entryMode === 'bulk' && draftSaveNotice && (
        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 shrink-0" />
          {draftSaveNotice}
        </p>
      )}

      {entryMode === 'bulk' && draftFindings.length > 0 && (
        <p className="text-xs text-amber-400/90 flex items-center gap-1.5">
          <AlertCircle className="size-3.5 shrink-0" />
          {draftFindings.length} borrador{draftFindings.length !== 1 ? 'es' : ''} sin guardar en BD — usa
          &quot;Guardar todos en BD&quot; para exportarlos en Word.
        </p>
      )}

      {entryMode === 'bulk' && error && (
        <p className="text-xs text-rose-400 flex items-center gap-1.5">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {entryMode === 'single' && showNew && (
        <Card className="border-violet-500/30 shadow-lg shadow-violet-500/5">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-base">Nuevo Reporte</CardTitle>
            <CardDescription className="text-xs">Completa las secciones del informe de vulnerabilidad.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <FindingFormEditor
              values={newFormVisible}
              onChange={handleNewFormChange}
              onSave={() => void handleCreate()}
              onPublish={() => void handleCreateAndValidate()}
              onCancel={cancelNewFinding}
              onSuggest={() => void applySuggestion('new', newForm.raw_tool_output)()}
              onSuggestField={(field) => void suggestSingleField(field)()}
              saving={busy === 'create'}
              suggesting={busy === 'suggest-new'}
              suggestingField={suggestingField}
              animatingField={animatingField}
              aiSuggestedFields={newFormAiSuggested}
              isAiFilling={isFilling}
              aiFillProgress={fillProgress}
              aiFillSource={aiFillSource}
              saveLabel="Guardar"
              publishLabel="Validar"
              evidenceSection={
                <FindingEvidencePanel
                  pendingImages={newPendingImages}
                  onPendingChange={setNewPendingImages}
                />
              }
            />
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="size-4 animate-spin" />
          Cargando hallazgos…
        </div>
      ) : (summary?.total_findings ?? 0) === 0 && !loading ? (
        <Card className="bg-muted/40 border-border border-dashed">
          <CardContent className="py-10 text-center space-y-3">
            <Terminal className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No hay hallazgos{engagementId ? ' en este proyecto' : ''}.</p>
            <Button type="button" size="sm" onClick={openNewEmptyFinding}>
              <Plus className="size-3.5 mr-1.5" />
              Crear primer reporte
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {viewMode !== 'spreadsheet' && filteredTotal > findings.length ? (
            <p className="text-xs text-amber-400">
              Vista {viewMode === 'grouped' ? 'agrupada' : 'lista'}: solo página actual (
              {findings.length} de {filteredTotal.toLocaleString()}). Usa Tabla Excel para navegar.
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            {(summary?.total_findings ?? 0).toLocaleString()} en BD ·{' '}
            {summary?.grouped_vulnerability_count ?? groupedFindings.length} grupos Word
            {duplicateInfo && duplicateInfo.remove_count > 0
              ? ` · ${duplicateInfo.remove_count} duplicados`
              : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted border border-border">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs',
                  viewMode === 'grouped' ? 'bg-violet-600 text-white' : 'text-muted-foreground'
                )}
              >
                <Layers className="size-3.5 inline mr-1" />
                Agrupados
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs',
                  viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                Lista completa
              </button>
              <button
                type="button"
                onClick={() => setViewMode('spreadsheet')}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1',
                  viewMode === 'spreadsheet' ? 'bg-sky-600 text-white' : 'text-muted-foreground'
                )}
              >
                <Table2 className="size-3.5" />
                Tabla Excel
              </button>
            </div>
            <Button
              type="button"
              variant={severitySorted ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSeveritySorted((v) => !v)}
            >
              <ArrowDownWideNarrow className="size-3.5 mr-1.5" />
              {severitySorted ? 'Orden original' : 'Ordenar: Crítica → Baja'}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => void reloadAll()} disabled={loading}>
              <RefreshCw className={cn('size-3.5 mr-1.5', loading && 'animate-spin')} />
              Actualizar
            </Button>
            {viewMode === 'spreadsheet' ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-sky-500/40 text-sky-300"
                  disabled={busy !== null || displayedFindings.length === 0}
                  onClick={() => void syncFromCatalog(displayedFindings, 'Página')}
                >
                  {busy === 'sync-catalog' ? (
                    <Loader2 className="size-3.5 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5 mr-1" />
                  )}
                  Actualizar tabla ({displayedFindings.length})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-sky-500/30 text-sky-400"
                  disabled={busy !== null || selected.size === 0}
                  onClick={() => {
                    const targets = findings.filter((f) => selected.has(f.id));
                    void syncFromCatalog(targets, 'Selección');
                  }}
                >
                  <RefreshCw className="size-3.5 mr-1" />
                  Actualizar selección ({selected.size})
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-orange-500/40 text-orange-300"
              disabled={busy !== null || !duplicateInfo?.remove_count}
              onClick={() => setConfirmDeleteDuplicates(true)}
            >
              <Copy className="size-3.5 mr-1.5" />
              Eliminar duplicados ({duplicateInfo?.remove_count ?? 0})
            </Button>
            {selected.size > 0 && (
              <Button type="button" size="sm" className="h-8 text-xs" onClick={() => void handleBulkValidate()} disabled={busy === 'bulk'}>
                {busy === 'bulk' ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1.5" />}
                Validar ({selected.size})
              </Button>
            )}
          </div>
          {confirmDeleteDuplicates && (
            <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-3 space-y-2">
              <p className="text-xs text-orange-100">
                ¿Eliminar {duplicateInfo?.remove_count} copias repetidas en {duplicateInfo?.group_count}{' '}
                grupos?
                Cada grupo es el <strong>mismo título en el mismo IP/puerto</strong> (hosts distintos no se
                fusionan). Se conserva el más completo.
              </p>
              <ul className="text-[10px] text-orange-200/90 max-h-20 overflow-y-auto space-y-0.5">
                {duplicateInfo?.groups_preview.slice(0, 5).map((g) => (
                  <li key={g.key}>{formatDuplicatePreviewLabel(g)}</li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDeleteDuplicates(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-orange-600 hover:bg-orange-500"
                  disabled={busy === 'delete-dupes'}
                  onClick={() => void deleteDuplicates()}
                >
                  {busy === 'delete-dupes' ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
          {viewMode === 'spreadsheet' ? (
            <FindingsSpreadsheetTable
              findings={displayedFindings}
              selected={selected}
              onToggleSelect={toggleSelect}
              onSelectAll={(ids) => setSelected(new Set(ids))}
              expandedId={expandedId}
              searchQuery={searchQ}
              onSearchQueryChange={setSearchQ}
              serverSearch
              onServerSeverityFilter={setSeveridadesMulti}
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
              onRowClick={(id) => {
                const f = displayedFindings.find((x) => x.id === id);
                if (f) openEdit(f);
              }}
              renderExpandedRow={(f) => {
                const form = editForms[f.id] ?? findingToFormValues(f);
                return (
                  <div className="space-y-3">
                    <FindingFormEditor
                      values={form}
                      onChange={(v) => setEditForms((prev) => ({ ...prev, [f.id]: v }))}
                      onSave={() => void handleSaveEdit(f.id)}
                      onPublish={() => void handlePublishEdit(f.id)}
                      onCancel={() => setExpandedId(null)}
                      onSuggest={() => void applySuggestion(f.id, form.raw_tool_output)()}
                      saving={busy === `save-${f.id}` || busy === `pub-${f.id}`}
                      suggesting={busy === `suggest-${f.id}`}
                      saveLabel="Guardar cambios"
                      publishLabel="Validar"
                      compact
                      evidenceSection={<FindingEvidencePanel findingId={f.id} />}
                    />
                    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                      <OpenCatalogButton
                        finding={f}
                        className="h-8 text-xs border-emerald-700/50 text-emerald-300"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                        disabled={busy === `delete-${f.id}`}
                        onClick={() => void handleDeleteFinding(f.id, f.titulo)}
                      >
                        {busy === `delete-${f.id}` ? (
                          <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5 mr-1.5" />
                        )}
                        Eliminar hallazgo
                      </Button>
                    </div>
                  </div>
                );
              }}
            />
          ) : null}
          {viewMode === 'grouped' ? (
            <GroupedFindingsView
              groups={groupedFindings}
              expandedGroupKey={expandedGroupKey}
              onToggleGroup={(key) => setExpandedGroupKey((k) => (k === key ? null : key))}
              selectedIds={selected}
              onToggleMember={toggleSelect}
              renderMember={(f) => {
                const isOpen = expandedId === f.id;
                const form = editForms[f.id] ?? findingToFormValues(f);
                return (
                  <div key={f.id} className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onChange={() => toggleSelect(f.id)}
                        className="mt-1 accent-violet-500 shrink-0"
                      />
                      <button
                        type="button"
                        className="flex-1 text-left min-w-0"
                        onClick={() => openEdit(f)}
                      >
                        <span className="text-xs text-foreground">{resolveFindingComponente(f) || f.titulo}</span>
                        {!isOpen && f.descripcion && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{f.descripcion}</p>
                        )}
                      </button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(f)}>
                        <Pencil className="size-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                    {isOpen && (
                      <div className="mt-2 pl-6 border-t border-border/60 pt-2 space-y-2">
                        <FindingFormEditor
                          values={form}
                          onChange={(v) => setEditForms((prev) => ({ ...prev, [f.id]: v }))}
                          onSave={() => void handleSaveEdit(f.id)}
                          onPublish={() => void handlePublishEdit(f.id)}
                          onCancel={() => setExpandedId(null)}
                          onSuggest={() => void applySuggestion(f.id, form.raw_tool_output)()}
                          saving={busy === `save-${f.id}` || busy === `pub-${f.id}`}
                          suggesting={busy === `suggest-${f.id}`}
                          saveLabel="Guardar"
                          publishLabel="Validar"
                          compact
                          evidenceSection={<FindingEvidencePanel findingId={f.id} />}
                        />
                        <div className="flex flex-wrap gap-2 border-t border-border pt-2">
                          <OpenCatalogButton
                            finding={f}
                            className="h-8 text-xs border-emerald-700/50 text-emerald-300"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                            disabled={busy === `delete-${f.id}`}
                            onClick={() => void handleDeleteFinding(f.id, f.titulo)}
                          >
                            {busy === `delete-${f.id}` ? (
                              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5 mr-1.5" />
                            )}
                            Eliminar hallazgo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
            />
          ) : null}
          {viewMode === 'list' && displayedFindings.map((f) => {
            const isOpen = expandedId === f.id;
            const form = editForms[f.id] ?? findingToFormValues(f);
            return (
              <div
                key={f.id}
                className={cn(
                  'rounded-xl border overflow-hidden transition-all',
                  isOpen ? 'border-violet-500/40 bg-card shadow-lg' : 'border-border bg-muted/50',
                  selected.has(f.id) && !isOpen && 'border-violet-500/25'
                )}
              >
                {/* Fila resumen — clic para expandir editor */}
                <div className="flex items-start gap-2 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggleSelect(f.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 accent-violet-500 shrink-0"
                    aria-label={`Seleccionar ${f.titulo}`}
                  />
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => openEdit(f)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {isOpen ? (
                        <ChevronDown className="size-4 text-violet-400 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm text-foreground font-medium">{f.titulo}</span>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', SEVERITY_COLORS[f.severidad])}>
                        {SEVERITY_LABEL[f.severidad] || f.severidad}
                      </span>
                      <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">
                        {f.status}
                      </span>
                    </div>
                    {!isOpen && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 pl-6">
                        {f.descripcion || 'Sin descripción — clic para editar'}
                      </p>
                    )}
                  </button>
                  {!isOpen && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs shrink-0" onClick={() => openEdit(f)}>
                      <Pencil className="size-3.5 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>

                {/* Editor expandido — misma vista que Nuevo Reporte */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/80 pt-4">
                    <FindingFormEditor
                      values={form}
                      onChange={(v) => setEditForms((prev) => ({ ...prev, [f.id]: v }))}
                      onSave={() => void handleSaveEdit(f.id)}
                      onPublish={() => void handlePublishEdit(f.id)}
                      onCancel={() => setExpandedId(null)}
                      onSuggest={() => void applySuggestion(f.id, form.raw_tool_output)()}
                      saving={busy === `save-${f.id}` || busy === `pub-${f.id}`}
                      suggesting={busy === `suggest-${f.id}`}
                      saveLabel="Guardar cambios"
                      publishLabel="Validar"
                      compact
                      evidenceSection={<FindingEvidencePanel findingId={f.id} />}
                    />
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                      <OpenCatalogButton
                        finding={f}
                        className="h-8 text-xs border-emerald-700/50 text-emerald-300"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => void enrichFinding(f.id).then(reloadAll)}
                      >
                        <Sparkles className="size-3 mr-1" />
                        Enriquecer (Gemini)
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                        disabled={busy === `delete-${f.id}`}
                        onClick={() => void handleDeleteFinding(f.id, f.titulo)}
                      >
                        {busy === `delete-${f.id}` ? (
                          <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5 mr-1.5" />
                        )}
                        Eliminar hallazgo
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
