'use client';

import { useState } from 'react';
import { Cpu, Loader2, Sparkles } from 'lucide-react';
import type { UiMessageKey } from '@/lib/ui-locale';
import type { PentestMapSemanticDocument } from '@/lib/pentest-target-map-schema';

type Props = {
  diagramName: string;
  platform?: PentestMapSemanticDocument['meta']['platform'];
  targetIp?: string;
  attackerIp?: string;
  t: (key: UiMessageKey) => string;
  onApply: (result: {
    semantic: PentestMapSemanticDocument;
    source: string;
    warning?: string;
  }) => void;
};

export function MapGeminiGeneratePanel({
  diagramName,
  platform,
  targetIp,
  attackerIp,
  t,
  onApply,
}: Props) {
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const generate = async () => {
    const text = raw.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/ai/generate-target-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawOutput: text,
          diagramName,
          platform,
          targetIp: targetIp || undefined,
          attackerIp: attackerIp || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar mapa');
      onApply({ semantic: data.doc, source: data.source, warning: data.warning });
      setNotice(
        data.warning
          ? data.warning
          : data.source === 'gemini'
            ? t('phantomMapAiSuccess')
            : t('phantomMapAiLocalSuccess')
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-500" />
          <p className="text-xs font-semibold text-foreground">{t('phantomMapAiTitle')}</p>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">{t('phantomMapAiHint')}</p>
        <p className="mt-2 text-[9px] italic text-muted-foreground/80">{t('phantomMapDiagramNote')}</p>
      </div>

      <label className="block space-y-1">
        <span className="phantom-map-field-label">{t('phantomMapAiRawLabel')}</span>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={14}
          placeholder={t('phantomMapAiPlaceholder')}
          className="phantom-field min-h-[12rem] resize-y font-mono text-[10px] leading-relaxed"
        />
      </label>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {notice ? <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{notice}</p> : null}

      <button
        type="button"
        disabled={loading || !raw.trim()}
        onClick={() => void generate()}
        className="phantom-btn phantom-btn-primary w-full justify-center text-[11px] disabled:opacity-50"
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Cpu className="size-3.5" />}
        {loading ? t('phantomMapAiLoading') : t('phantomMapAiGenerate')}
      </button>
    </div>
  );
}
