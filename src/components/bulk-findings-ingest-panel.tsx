'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Terminal,
  MessageSquareText,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { splitFindingsFromRaw } from '@/lib/secops-api';
import { buildGeminiContext } from '@/lib/gemini-context';
import { suggestionToFormValues } from '@/lib/finding-suggest';
import { loadReportsSession, saveReportsSession } from '@/lib/reports-session';
import type { FindingFormValues } from '@/components/finding-form-editor';

export type DraftFinding = {
  id: string;
  values: FindingFormValues;
  source: string;
  selected: boolean;
  expanded: boolean;
};

type BulkFindingsIngestPanelProps = {
  engagementId?: string;
  projectName?: string;
  onDraftsReady: (drafts: DraftFinding[], meta: { source: string; warning?: string }) => void;
};

function newDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function BulkFindingsIngestPanel({
  engagementId,
  projectName,
  onDraftsReady,
  embedded = true,
}: BulkFindingsIngestPanelProps & { embedded?: boolean }) {
  const [rawOutput, setRawOutput] = useState('');
  const [context, setContext] = useState(() => loadReportsSession().analystContext || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  useEffect(() => {
    saveReportsSession({ analystContext: context });
  }, [context]);

  const handleSplit = async () => {
    if (!rawOutput.trim()) {
      setError('Pega la salida cruda larga antes de separar hallazgos.');
      return;
    }
    if (!engagementId) {
      setError('Selecciona o crea un proyecto en el paso 1 antes de separar hallazgos.');
      return;
    }
    setBusy(true);
    setError(null);
    setLastCount(null);
    try {
      const fullContext = buildGeminiContext({
        projectName,
        engagementId,
        analystNotes: context,
      });

      const { findings, source, count, warning } = await splitFindingsFromRaw(rawOutput, fullContext);

      const drafts: DraftFinding[] = findings.map((s, i) => ({
        id: newDraftId(),
        values: suggestionToFormValues(
          s,
          s.raw_snippet || rawOutput.slice(0, 4000),
          undefined
        ),
        source,
        selected: true,
        expanded: i === 0,
      }));

      if (!drafts.length) {
        setError('No se detectaron hallazgos en el texto. Prueba con más detalle o revisa el formato.');
        return;
      }

      setLastCount(count);
      onDraftsReady(drafts, { source, warning });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo separar hallazgos');
    } finally {
      setBusy(false);
    }
  };

  const fields = (
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <MessageSquareText className="size-3.5 text-sky-400" />
            Contexto adicional (opcional)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Ej: NO mencionar HAR — describir como tráfico HTTP. Alcance, hosts, cliente, notas…"
            rows={3}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 text-sm text-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Terminal className="size-3.5 text-sky-400" />
            Raw output largo (obligatorio)
          </label>
          <textarea
            value={rawOutput}
            onChange={(e) => setRawOutput(e.target.value)}
            placeholder="Pega aquí export Nessus completo, múltiples plugins, informe con varias secciones numeradas…"
            className="w-full min-h-[180px] rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-200 p-3 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="lg"
            disabled={busy || !rawOutput.trim()}
            onClick={() => void handleSplit()}
            className="bg-sky-600 hover:bg-sky-500 text-white shadow-md"
          >
            {busy ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            Separar hallazgos con Gemini
          </Button>
          {rawOutput.trim() && !busy && (
            <span className="text-[10px] text-slate-500">
              {rawOutput.length.toLocaleString()} caracteres
            </span>
          )}
        </div>

        {error && (
          <p className="text-xs text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {lastCount != null && !error && (
          <p className="text-xs text-emerald-400/90 flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            {lastCount} hallazgos detectados — se guardan automáticamente en la base de datos del proyecto.
          </p>
        )}
      </div>
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 space-y-2">
        <div>
          <p className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Layers className="size-4 text-sky-400" />
            Contexto y salida cruda (múltiples hallazgos)
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Dump largo de Nessus, Nmap o informe consolidado. Gemini separa cada vulnerabilidad en borradores.
          </p>
        </div>
        {fields}
      </div>
    );
  }

  return (
    <Card className="border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-slate-900/90 to-slate-900/90">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-50 flex items-center gap-2">
          <Layers className="size-5 text-sky-400" />
          Hallazgos múltiples (raw largo)
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Pega un dump largo de Nessus, Nmap, Acunetix o informe consolidado. Gemini separará cada
          vulnerabilidad en borradores listos para editar, eliminar o guardar en lote.
        </CardDescription>
      </CardHeader>
      <CardContent>{fields}</CardContent>
    </Card>
  );
}

export function createEmptyDraft(): DraftFinding {
  return {
    id: newDraftId(),
    values: {
      titulo: '',
      severidad: 'Medium',
      descripcion: '',
      amenaza_ampliada: '',
      propuesta_remediacion: '',
      referencias: '',
      componentes_afectados: [''],
      metodo_deteccion: '',
      explicacion_tecnica: '',
      raw_tool_output: '',
      cve: '',
      cwe: '',
      cvss_score: '',
    },
    source: 'manual',
    selected: true,
    expanded: true,
  };
}
