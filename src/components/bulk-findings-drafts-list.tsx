'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Save,
  Loader2,
  CheckSquare,
  Square,
  Sparkles,
  ArrowDownWideNarrow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  FindingFormEditor,
  formValuesToPayload,
  type FindingFormValues,
} from '@/components/finding-form-editor';
import { createEmptyDraft, type DraftFinding } from '@/components/bulk-findings-ingest-panel';
import { toPlainReportText } from '@/lib/plain-report-text';
import { sortBySeverity as sortItemsBySeverity } from '@/lib/severity-sort';

const SEVERITY_LABEL: Record<string, string> = {
  Critical: 'Crítica',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Info: 'Info',
};

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  High: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  Medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  Low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  Info: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

type BulkFindingsDraftsListProps = {
  drafts: DraftFinding[];
  onChange: (drafts: DraftFinding[]) => void;
  onSaveAll: (selected: DraftFinding[]) => Promise<void>;
  onSuggestDraft?: (draftId: string) => Promise<void>;
  suggestingDraftId?: string | null;
  saving?: boolean;
  source?: string;
  warning?: string;
};

export function BulkFindingsDraftsList({
  drafts,
  onChange,
  onSaveAll,
  onSuggestDraft,
  suggestingDraftId,
  saving,
  source,
  warning,
}: BulkFindingsDraftsListProps) {
  const [severitySorted, setSeveritySorted] = useState(false);
  const selectedCount = drafts.filter((d) => d.selected).length;
  const displayedDrafts = severitySorted
    ? sortItemsBySeverity(drafts, (d) => d.values.severidad)
    : drafts;

  const updateDraft = (id: string, patch: Partial<DraftFinding> | ((d: DraftFinding) => DraftFinding)) => {
    onChange(
      drafts.map((d) => {
        if (d.id !== id) return d;
        return typeof patch === 'function' ? patch(d) : { ...d, ...patch };
      })
    );
  };

  const removeDraft = (id: string) => {
    onChange(drafts.filter((d) => d.id !== id));
  };

  const toggleAll = (selected: boolean) => {
    onChange(drafts.map((d) => ({ ...d, selected })));
  };

  const addManual = () => {
    onChange([createEmptyDraft(), ...drafts]);
  };

  if (!drafts.length) return null;

  const sourceLabel =
    source === 'gemini' ? 'Gemini' : source === 'structured' ? 'Parser estructurado' : source || 'IA';

  return (
    <Card className="bg-slate-900/80 border-sky-500/25 shadow-lg">
      <CardHeader className="pb-2 border-b border-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-slate-50 flex items-center gap-2">
              <Sparkles className="size-4 text-sky-400" />
              Borradores ({drafts.length})
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Generados con {sourceLabel} · expande para editar · usa Gemini por hallazgo
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleAll(true)}>
              <CheckSquare className="size-3.5 mr-1" />
              Todos
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => toggleAll(false)}>
              <Square className="size-3.5 mr-1" />
              Ninguno
            </Button>
            <Button
              type="button"
              variant={severitySorted ? 'secondary' : 'outline'}
              size="sm"
              className="h-8 text-xs border-slate-700"
              onClick={() => setSeveritySorted((v) => !v)}
            >
              <ArrowDownWideNarrow className="size-3.5 mr-1" />
              {severitySorted ? 'Orden original' : 'Crítica → Baja'}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs border-slate-700" onClick={addManual}>
              <Plus className="size-3.5 mr-1" />
              Añadir manual
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-500"
              disabled={saving || selectedCount === 0}
              onClick={() => void onSaveAll(drafts.filter((d) => d.selected && d.values.titulo.trim()))}
            >
              {saving ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="size-3.5 mr-1" />
              )}
              Guardar {selectedCount} seleccionados
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-emerald-600/50 text-emerald-300 hover:bg-emerald-500/10"
              disabled={saving || !drafts.some((d) => d.values.titulo.trim())}
              onClick={() => void onSaveAll(drafts.filter((d) => d.values.titulo.trim()))}
            >
              {saving ? (
                <Loader2 className="size-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="size-3.5 mr-1" />
              )}
              Guardar todos en BD ({drafts.filter((d) => d.values.titulo.trim()).length})
            </Button>
          </div>
        </div>
        {warning && <p className="text-[11px] text-amber-400/90 mt-2">{warning}</p>}
      </CardHeader>
      <CardContent className="pt-3 space-y-2">
        {displayedDrafts.map((draft, idx) => (
          <DraftRow
            key={draft.id}
            draft={draft}
            index={idx}
            saving={saving}
            suggesting={suggestingDraftId === draft.id}
            onSuggest={() => onSuggestDraft?.(draft.id)}
            onUpdate={(patch) => updateDraft(draft.id, patch)}
            onRemove={() => removeDraft(draft.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function DraftRow({
  draft,
  index,
  saving,
  suggesting,
  onSuggest,
  onUpdate,
  onRemove,
}: {
  draft: DraftFinding;
  index: number;
  saving?: boolean;
  suggesting?: boolean;
  onSuggest?: () => void;
  onUpdate: (patch: Partial<DraftFinding> | ((d: DraftFinding) => DraftFinding)) => void;
  onRemove: () => void;
}) {
  const v = draft.values;
  const isOpen = draft.expanded;
  const displayTitle = toPlainReportText(v.titulo.trim()) || `Borrador ${index + 1} (sin título)`;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all',
        isOpen ? 'border-sky-500/40 bg-slate-950/60' : 'border-slate-800 bg-slate-950/30',
        !draft.selected && 'opacity-60',
        suggesting && 'border-violet-500/50 shadow-[0_0_16px_rgba(139,92,246,0.15)]'
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        <input
          type="checkbox"
          checked={draft.selected}
          onChange={(e) => onUpdate({ selected: e.target.checked })}
          className="mt-1 accent-sky-500 shrink-0"
          aria-label={`Seleccionar borrador ${index + 1}`}
        />
        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => onUpdate({ expanded: !isOpen })}
        >
          <div className="flex flex-wrap items-center gap-2">
            {isOpen ? (
              <ChevronDown className="size-4 text-sky-400 shrink-0" />
            ) : (
              <ChevronRight className="size-4 text-slate-500 shrink-0" />
            )}
            <span className="text-sm text-slate-100 font-medium truncate">{displayTitle}</span>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border font-medium',
                SEVERITY_COLORS[v.severidad]
              )}
            >
              {SEVERITY_LABEL[v.severidad] || v.severidad}
            </span>
            <span className="text-[10px] text-slate-600 border border-slate-800 rounded-full px-2 py-0.5">
              {draft.source}
            </span>
          </div>
          {!isOpen && v.descripcion && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1 pl-6">{toPlainReportText(v.descripcion)}</p>
          )}
        </button>
        {onSuggest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-[10px] shrink-0 border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
            disabled={saving || suggesting || !v.raw_tool_output.trim()}
            onClick={(e) => {
              e.stopPropagation();
              void onSuggest();
            }}
            title="Completar campos de este hallazgo con Gemini"
          >
            {suggesting ? (
              <Loader2 className="size-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="size-3 mr-1" />
            )}
            Gemini
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-rose-400 shrink-0"
          onClick={onRemove}
          disabled={saving}
          title="Eliminar borrador"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {isOpen && (
        <div className="px-3 pb-4 border-t border-slate-800/80 pt-3">
          {onSuggest && (
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                className="h-8 bg-violet-600 hover:bg-violet-500 text-white"
                disabled={saving || suggesting || !v.raw_tool_output.trim()}
                onClick={() => void onSuggest()}
              >
                {suggesting ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5 mr-1.5" />
                )}
                Completar campos con Gemini
              </Button>
            </div>
          )}
          <FindingFormEditor
            values={v}
            onChange={(values: FindingFormValues) => onUpdate({ values })}
            onSave={() => {}}
            hideActions
            compact
          />
          <p className="text-[10px] text-slate-600 mt-2">
            Solo «Explicación técnica» admite markdown e imágenes. Resto de campos: texto plano.
          </p>
        </div>
      )}
    </div>
  );
}

export { formValuesToPayload };
