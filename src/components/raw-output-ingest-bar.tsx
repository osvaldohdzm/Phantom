'use client';

import { useEffect, useState } from 'react';
import {
  Sparkles,
  Loader2,
  Terminal,
  MessageSquareText,
  AlertCircle,
  CheckCircle2,
  FileSearch,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { suggestFindingFields } from '@/lib/secops-api';
import { buildGeminiContext } from '@/lib/gemini-context';
import { suggestionToFormValues } from '@/lib/finding-suggest';
import { loadReportsSession, saveReportsSession } from '@/lib/reports-session';
import { FindingFieldPreview } from '@/components/finding-field-preview';
import type { FindingFormValues } from '@/components/finding-form-editor';

export type RawIngestResult = {
  values: FindingFormValues;
  source: string;
  token: number;
  warning?: string | null;
  filledFields?: string[];
};

function RawIngestFields({
  engagementId,
  projectName,
  onFilled,
}: {
  engagementId?: string;
  projectName?: string;
  onFilled: (result: RawIngestResult) => void;
}) {
  const [rawOutput, setRawOutput] = useState('');
  const [context, setContext] = useState(() => loadReportsSession().analystContext || '');
  const [busy, setBusy] = useState<'gemini' | 'structured' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    values: FindingFormValues;
    source: string;
    warning?: string | null;
  } | null>(null);

  useEffect(() => {
    saveReportsSession({ analystContext: context });
  }, [context]);

  const runFill = async (mode: 'auto' | 'structured') => {
    if (!rawOutput.trim()) {
      setError('Pega la salida cruda antes de analizar.');
      return;
    }
    setBusy(mode === 'structured' ? 'structured' : 'gemini');
    setError(null);
    setLastResult(null);
    try {
      const fullContext = buildGeminiContext({
        projectName,
        engagementId,
        analystNotes: context,
      });

      const { suggestion, source, warning, filledFields } = await suggestFindingFields(rawOutput, fullContext, {
        mode: mode === 'structured' ? 'structured' : 'auto',
      });
      const values = suggestionToFormValues(suggestion, rawOutput);
      const result = { values, source, warning, filledFields };
      setLastResult(result);
      onFilled({ ...result, token: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar el análisis');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <MessageSquareText className="size-3.5 text-violet-400" />
            Contexto adicional (opcional)
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Ej: NO mencionar HAR — usar tráfico HTTP. Alcance, hosts, URL afectada…"
            rows={3}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 text-sm text-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Terminal className="size-3.5 text-emerald-400" />
            Raw output (Nessus, Nmap, consola, informe…)
          </label>
          <textarea
            value={rawOutput}
            onChange={(e) => setRawOutput(e.target.value)}
            placeholder="Pega plugin output, informe con secciones, log de explotación…"
            className="w-full min-h-[140px] rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-200 p-3 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="lg"
            disabled={!!busy || !rawOutput.trim()}
            onClick={() => void runFill('auto')}
            className="bg-violet-600 hover:bg-violet-500 text-white shadow-md"
          >
            {busy === 'gemini' ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="size-4 mr-2" />
            )}
            Analizar y llenar campos
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={!!busy || !rawOutput.trim()}
            onClick={() => void runFill('structured')}
            className="border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            {busy === 'structured' ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <FileSearch className="size-4 mr-2" />
            )}
            Solo texto estructurado
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

        {lastResult && !error && (
          <div className="space-y-2">
            <p className="text-xs text-emerald-400/90 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Formulario listo — revisa abajo y guarda.
            </p>
            <FindingFieldPreview
              values={lastResult.values}
              source={lastResult.source}
              warning={lastResult.warning}
            />
          </div>
        )}

        {!engagementId && (
          <p className="text-xs text-amber-400/80">
            Puedes llenar campos sin proyecto; para guardar, crea o selecciona uno en el paso 1.
          </p>
        )}
    </div>
  );
}

export function RawOutputIngestBar({
  engagementId,
  projectName,
  onFilled,
  embedded = false,
}: {
  engagementId?: string;
  projectName?: string;
  onFilled: (result: RawIngestResult) => void;
  /** Dentro de Hallazgos manuales (sin card duplicada). */
  embedded?: boolean;
}) {
  const fields = (
    <RawIngestFields engagementId={engagementId} projectName={projectName} onFilled={onFilled} />
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-2">
        <div>
          <p className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Terminal className="size-4 text-emerald-400" />
            Contexto y salida cruda
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Contexto arriba, raw abajo. Gemini rellena el formulario del hallazgo.
          </p>
        </div>
        {fields}
      </div>
    );
  }

  return (
    <Card className="border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-slate-900/90 to-slate-900/90 shadow-lg shadow-violet-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-50 flex items-center gap-2">
          <Terminal className="size-5 text-emerald-400" />
          Salida cruda y contexto
        </CardTitle>
        <CardDescription className="text-xs text-slate-400">
          Primero el contexto (alcance, hosts, cliente). Luego el raw output. Gemini aplica el contexto a todos
          los campos. Si el texto ya trae secciones DESCRIPCIÓN / AMENAZA / REMEDIACIÓN, se rellenan sin IA.
        </CardDescription>
      </CardHeader>
      <CardContent>{fields}</CardContent>
    </Card>
  );
}
