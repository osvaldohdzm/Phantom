'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AI_FIELD_LABELS, type AiFormFieldKey } from '@/lib/ai-form-fields';

type AiFieldWrapperProps = {
  fieldKey: AiFormFieldKey;
  label?: string;
  children: React.ReactNode;
  isAnimating?: boolean;
  isSuggested?: boolean;
  onSuggestField?: (field: AiFormFieldKey) => void;
  suggestingField?: AiFormFieldKey | null;
  disabled?: boolean;
  className?: string;
};

export function AiFieldWrapper({
  fieldKey,
  label,
  children,
  isAnimating,
  isSuggested,
  onSuggestField,
  suggestingField,
  disabled,
  className,
}: AiFieldWrapperProps) {
  const isBusy = suggestingField === fieldKey;
  const fieldLabel = label || AI_FIELD_LABELS[fieldKey];

  return (
    <div
      data-ai-field={fieldKey}
      className={cn(
        'relative rounded-xl transition-all duration-500',
        isAnimating && 'ai-field-filling z-10',
        isSuggested && !isAnimating && 'ai-field-suggested',
        className
      )}
    >
      {isAnimating && (
        <>
          <div className="ai-scan-line pointer-events-none" aria-hidden />
          <div className="absolute -top-2 right-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-600/90 text-[10px] font-medium text-white shadow-lg shadow-violet-500/40 ai-badge-pop">
            <Sparkles className="size-3 animate-pulse" />
            Rellenando con IA…
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          {fieldLabel}
          {isSuggested && !isAnimating && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[10px] font-semibold border border-violet-500/30 ai-badge-pop">
              <Sparkles className="size-2.5" />
              IA
            </span>
          )}
        </label>
        {onSuggestField && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isBusy || isAnimating}
            onClick={() => onSuggestField(fieldKey)}
            className="h-6 px-2 text-[10px] text-violet-300 hover:text-violet-200 hover:bg-violet-500/10 shrink-0"
          >
            {isBusy ? (
              <Loader2 className="size-3 mr-1 animate-spin" />
            ) : (
              <Sparkles className="size-3 mr-1" />
            )}
            Gemini
          </Button>
        )}
      </div>

      <div className={cn('relative', isAnimating && 'ai-content-reveal')}>{children}</div>
    </div>
  );
}

export function AiFillProgressBar({
  progress,
  fieldLabel,
  source,
}: {
  progress: number;
  fieldLabel?: string | null;
  source?: string;
}) {
  const pct = Math.round(progress * 100);
  const sourceLabel =
    source === 'gemini' ? 'Gemini' : source === 'structured' ? 'Análisis estructurado' : 'IA';

  return (
    <div className="rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-950/80 via-slate-950 to-violet-950/80 p-4 overflow-hidden relative">
      <div className="ai-shimmer-bg pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div className="relative flex items-center gap-3 mb-3">
        <div className="relative size-10 shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/30" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 animate-spin"
            style={{ animationDuration: '0.8s' }}
          />
          <Sparkles className="absolute inset-0 m-auto size-4 text-violet-300 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-violet-100">Rellenando campos con {sourceLabel}</p>
          <p className="text-xs text-violet-300/70 truncate">
            {fieldLabel
              ? `→ ${AI_FIELD_LABELS[fieldLabel as AiFormFieldKey] || fieldLabel}`
              : 'Preparando análisis…'}
          </p>
        </div>
        <span className="text-lg font-bold text-violet-300 tabular-nums">{pct}%</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-400 transition-all duration-300 ease-out ai-progress-glow"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
