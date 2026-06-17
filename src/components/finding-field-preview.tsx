'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { FindingFormValues } from '@/components/finding-form-editor';
import { AI_FIELD_LABELS } from '@/lib/ai-form-fields';
import { SEVERITY_LABELS } from '@/lib/parse-structured-finding';

function previewValue(key: keyof FindingFormValues, values: FindingFormValues): string {
  if (key === 'severidad') return SEVERITY_LABELS[values.severidad] || values.severidad;
  if (key === 'componentes_afectados') {
    const list = values.componentes_afectados.filter(Boolean);
    return list.length ? list.join(' · ') : '';
  }
  const v = values[key];
  return typeof v === 'string' ? v.trim() : '';
}

const PREVIEW_KEYS: (keyof FindingFormValues)[] = [
  'titulo',
  'severidad',
  'descripcion',
  'amenaza_ampliada',
  'propuesta_remediacion',
  'referencias',
  'metodo_deteccion',
  'componentes_afectados',
  'explicacion_tecnica',
  'cwe',
  'cve',
];

export function FindingFieldPreview({
  values,
  source,
  warning,
}: {
  values: FindingFormValues;
  source: string;
  warning?: string | null;
}) {
  const [open, setOpen] = useState(true);

  const rows = PREVIEW_KEYS.map((key) => ({
    key,
    label: AI_FIELD_LABELS[key] || String(key),
    value: previewValue(key, values),
  })).filter((r) => r.value);

  if (!rows.length) return null;

  const sourceLabel =
    source === 'gemini'
      ? 'Gemini IA'
      : source === 'structured'
        ? 'Texto estructurado'
        : source === 'heuristic'
          ? 'Heurística'
          : source;

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-emerald-300 hover:bg-emerald-500/10"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        Vista previa — {rows.length} campos rellenados ({sourceLabel})
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-emerald-500/20">
          {warning && <p className="text-[11px] text-amber-400/90 pt-2">{warning}</p>}
          <dl className="space-y-1.5 pt-1">
            {rows.map(({ key, label, value }) => (
              <div key={key} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-0.5 sm:gap-2 text-[11px]">
                <dt className="text-slate-500 shrink-0">{label}</dt>
                <dd className="text-slate-200 line-clamp-3 whitespace-pre-wrap break-words">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[10px] text-slate-500 pt-1">
            El raw output completo va en «Salidas de herramienta». Revisa el formulario abajo antes de guardar.
          </p>
        </div>
      )}
    </div>
  );
}
