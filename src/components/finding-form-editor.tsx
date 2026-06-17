'use client';

import { useState } from 'react';
import {
  Shield,
  FileText,
  Wrench,
  Link2,
  Server,
  FlaskConical,
  Camera,
  Save,
  Send,
  Sparkles,
  Loader2,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { AiFieldWrapper, AiFillProgressBar } from '@/components/ai-field-wrapper';
import { RichMarkdownEditor } from '@/components/rich-markdown-editor';
import type { AiFormFieldKey } from '@/lib/ai-form-fields';
import type { Severity } from '@/lib/secops-api';

export type FindingFormValues = {
  titulo: string;
  severidad: Severity;
  descripcion: string;
  amenaza_ampliada: string;
  propuesta_remediacion: string;
  referencias: string;
  componentes_afectados: string[];
  metodo_deteccion: string;
  explicacion_tecnica: string;
  raw_tool_output: string;
  cve: string;
  cwe: string;
  cvss_score: string;
};

export const EMPTY_FINDING_FORM: FindingFormValues = {
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
};

const SEVERITY_CHIPS: { value: Severity; label: string; className: string; activeClass: string }[] = [
  { value: 'Info', label: 'Info', className: 'bg-muted text-muted-foreground border-border', activeClass: 'ring-2 ring-muted-foreground border-muted-foreground' },
  { value: 'Low', label: 'Baja', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30', activeClass: 'ring-2 ring-sky-400 border-sky-400' },
  { value: 'Medium', label: 'Media', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30', activeClass: 'ring-2 ring-amber-400 border-amber-400' },
  { value: 'High', label: 'Alta', className: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30', activeClass: 'ring-2 ring-orange-400 border-orange-400' },
  { value: 'Critical', label: 'Crítica', className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30', activeClass: 'ring-2 ring-rose-400 border-rose-400' },
];

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Icon className="size-4 text-violet-500 dark:text-violet-400 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle ? (
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function FormTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  mono = false,
  aiGlow,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
  aiGlow?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        'w-full rounded-lg border bg-background text-sm text-foreground px-3 py-2.5',
        'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 resize-y',
        mono && 'font-mono text-xs leading-relaxed',
        aiGlow ? 'border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.2)]' : 'border-border'
      )}
    />
  );
}

export function findingToFormValues(f: {
  titulo: string;
  severidad: Severity;
  descripcion?: string | null;
  amenaza_ampliada?: string | null;
  propuesta_remediacion?: string | null;
  referencias?: string | null;
  componente_afectado?: string | null;
  metodo_deteccion?: string | null;
  explicacion_tecnica?: string | null;
  raw_tool_output?: string | null;
  cve?: string | null;
  cwe?: string | null;
  cvss_score?: number | null;
}): FindingFormValues {
  const componentes = (f.componente_afectado || '')
    .split(/\n/)
    .flatMap((line) => line.split(/●|•/))
    .map((s) => s.replace(/^[\s\-*,;]+/, '').trim())
    .filter(Boolean);
  return {
    titulo: f.titulo,
    severidad: f.severidad,
    descripcion: f.descripcion || '',
    amenaza_ampliada: f.amenaza_ampliada || '',
    propuesta_remediacion: f.propuesta_remediacion || '',
    referencias: f.referencias || '',
    componentes_afectados: componentes.length ? componentes : [''],
    metodo_deteccion: f.metodo_deteccion || '',
    explicacion_tecnica: f.explicacion_tecnica || '',
    raw_tool_output: f.raw_tool_output || '',
    cve: f.cve || '',
    cwe: f.cwe || '',
    cvss_score: f.cvss_score != null ? String(f.cvss_score) : '',
  };
}

export function formValuesToPayload(values: FindingFormValues, engagementId?: string) {
  const componente_afectado = values.componentes_afectados.filter((s) => s.trim()).join(', ');
  return {
    titulo: values.titulo,
    severidad: values.severidad,
    descripcion: values.descripcion || undefined,
    amenaza_ampliada: values.amenaza_ampliada || undefined,
    propuesta_remediacion: values.propuesta_remediacion || undefined,
    referencias: values.referencias || undefined,
    componente_afectado: componente_afectado || undefined,
    metodo_deteccion: values.metodo_deteccion || undefined,
    explicacion_tecnica: values.explicacion_tecnica || undefined,
    raw_tool_output: values.raw_tool_output || undefined,
    cve: values.cve || undefined,
    cwe: values.cwe || undefined,
    cvss_score: values.cvss_score ? parseFloat(values.cvss_score) : undefined,
    engagement_id: engagementId,
  };
}

type FindingFormEditorProps = {
  values: FindingFormValues;
  onChange: (values: FindingFormValues) => void;
  onSave: () => void;
  onPublish?: () => void;
  onSuggest?: () => void;
  onSuggestField?: (field: AiFormFieldKey) => void;
  saving?: boolean;
  suggesting?: boolean;
  suggestingField?: AiFormFieldKey | null;
  animatingField?: AiFormFieldKey | null;
  aiSuggestedFields?: Set<AiFormFieldKey>;
  isAiFilling?: boolean;
  aiFillProgress?: number;
  aiFillSource?: string;
  publishLabel?: string;
  saveLabel?: string;
  compact?: boolean;
  hideActions?: boolean;
  evidenceSection?: React.ReactNode;
  onCancel?: () => void;
};

export function FindingFormEditor({
  values,
  onChange,
  onSave,
  onPublish,
  onSuggest,
  onSuggestField,
  saving,
  suggesting,
  suggestingField,
  animatingField,
  aiSuggestedFields,
  isAiFilling,
  aiFillProgress = 0,
  aiFillSource,
  publishLabel = 'Validar y publicar',
  saveLabel = 'Guardar',
  compact,
  hideActions,
  evidenceSection,
  onCancel,
}: FindingFormEditorProps) {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const hasAiAssist = Boolean(onSuggest || onSuggestField);

  const ai = (key: AiFormFieldKey) => ({
    fieldKey: key,
    isAnimating: animatingField === key,
    isSuggested: aiSuggestedFields?.has(key),
    onSuggestField: hasAiAssist ? onSuggestField : undefined,
    suggestingField,
    disabled: isAiFilling,
  });

  const set = <K extends keyof FindingFormValues>(key: K, val: FindingFormValues[K]) => {
    onChange({ ...values, [key]: val });
  };

  const addComponente = () => {
    set('componentes_afectados', [...values.componentes_afectados, '']);
  };

  const updateComponente = (idx: number, val: string) => {
    const next = [...values.componentes_afectados];
    next[idx] = val;
    set('componentes_afectados', next);
  };

  const removeComponente = (idx: number) => {
    if (values.componentes_afectados.length <= 1) {
      set('componentes_afectados', ['']);
      return;
    }
    set(
      'componentes_afectados',
      values.componentes_afectados.filter((_, i) => i !== idx)
    );
  };

  const inputClass = cn(
    'bg-background h-10 border-border',
    animatingField === 'titulo' && 'border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
  );

  return (
    <div className={cn('space-y-4', compact && 'text-sm')}>
      {onCancel && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border text-muted-foreground hover:text-foreground"
            onClick={onCancel}
            disabled={isAiFilling}
          >
            <X className="size-4 mr-1.5" />
            Cancelar
          </Button>
        </div>
      )}

      {isAiFilling && (
        <AiFillProgressBar
          progress={aiFillProgress}
          fieldLabel={animatingField}
          source={aiFillSource}
        />
      )}

      <Section icon={Shield} title="Información General">
        <AiFieldWrapper {...ai('titulo')}>
          <Input
            value={values.titulo}
            onChange={(e) => set('titulo', e.target.value)}
            placeholder="Ej. Inyección SQL en endpoint /login"
            className={inputClass}
          />
        </AiFieldWrapper>

        <AiFieldWrapper {...ai('severidad')}>
          <div className="flex flex-wrap gap-2">
            {SEVERITY_CHIPS.map(({ value, label, className, activeClass }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('severidad', value)}
                disabled={isAiFilling}
                className={cn(
                  'px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                  className,
                  values.severidad === value && activeClass,
                  animatingField === 'severidad' && values.severidad === value && 'scale-105 shadow-lg'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </AiFieldWrapper>

        <div className="grid sm:grid-cols-3 gap-3">
          <AiFieldWrapper {...ai('cve')}>
            <Input
              value={values.cve}
              onChange={(e) => set('cve', e.target.value)}
              className="bg-background border-border h-9 text-sm"
              placeholder="CVE-2024-…"
            />
          </AiFieldWrapper>
          <AiFieldWrapper {...ai('cwe')}>
            <Input
              value={values.cwe}
              onChange={(e) => set('cwe', e.target.value)}
              className="bg-background border-border h-9 text-sm"
              placeholder="CWE-89"
            />
          </AiFieldWrapper>
          <AiFieldWrapper {...ai('cvss_score')}>
            <Input
              value={values.cvss_score}
              onChange={(e) => set('cvss_score', e.target.value)}
              className="bg-background border-border h-9 text-sm"
              placeholder="7.5"
            />
          </AiFieldWrapper>
        </div>
      </Section>

      <Section icon={FileText} title="Análisis Técnico">
        <AiFieldWrapper {...ai('descripcion')}>
          <FormTextarea
            value={values.descripcion}
            onChange={(v) => set('descripcion', v)}
            placeholder="Describe detalladamente el vector de ataque y la condición vulnerable…"
            rows={4}
            aiGlow={animatingField === 'descripcion'}
          />
        </AiFieldWrapper>
        <AiFieldWrapper {...ai('amenaza_ampliada')}>
          <FormTextarea
            value={values.amenaza_ampliada}
            onChange={(v) => set('amenaza_ampliada', v)}
            placeholder="¿Qué podría lograr un atacante si explota esta vulnerabilidad?"
            rows={3}
            aiGlow={animatingField === 'amenaza_ampliada'}
          />
        </AiFieldWrapper>
      </Section>

      <Section icon={Wrench} title="Remediación">
        <AiFieldWrapper {...ai('propuesta_remediacion')}>
          <FormTextarea
            value={values.propuesta_remediacion}
            onChange={(v) => set('propuesta_remediacion', v)}
            placeholder={'Pasos recomendados:\n1. Editar archivo de configuración\n2. Cambiar directivas de seguridad\n3. Reiniciar el servicio'}
            rows={5}
            aiGlow={animatingField === 'propuesta_remediacion'}
          />
        </AiFieldWrapper>
      </Section>

      <Section icon={Link2} title="Validación y Referencias">
        <AiFieldWrapper {...ai('referencias')}>
          <FormTextarea
            value={values.referencias}
            onChange={(v) => set('referencias', v)}
            placeholder="Ej. CWE-89, CIS 5.1.2, OWASP…"
            rows={2}
            aiGlow={animatingField === 'referencias'}
          />
        </AiFieldWrapper>
      </Section>

      <Section icon={Server} title="Activos">
        <AiFieldWrapper {...ai('componentes_afectados')}>
          <div className="space-y-2">
            {values.componentes_afectados.map((c, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={c}
                  onChange={(e) => updateComponente(idx, e.target.value)}
                  placeholder="10.10.9.x o /api/v1/users"
                  className="bg-background border-border h-10 flex-1"
                />
                {values.componentes_afectados.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="h-10 w-10 p-0 text-muted-foreground" onClick={() => removeComponente(idx)}>
                    <X className="size-4" />
                  </Button>
                )}
                {idx === values.componentes_afectados.length - 1 && (
                  <Button type="button" size="sm" className="h-10 w-10 p-0 bg-muted shrink-0" onClick={addComponente}>
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </AiFieldWrapper>
      </Section>

      {evidenceSection && (
        <Section
          icon={Camera}
          title="Evidencia (capturas)"
          subtitle="Solo almacenamiento interno — no se incluye en el Word"
        >
          {evidenceSection}
        </Section>
      )}

      <Section icon={FlaskConical} title="Detalle de Pruebas de Seguridad">
        {hasAiAssist && (
          <div className="rounded-lg border border-border bg-muted/20 overflow-hidden -mt-1 mb-1">
            <button
              type="button"
              onClick={() => setAiPanelOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              {aiPanelOpen ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
              <Sparkles className="size-3.5 text-violet-500 shrink-0" />
              <span>Asistencia IA <span className="text-muted-foreground/70">(opcional)</span></span>
            </button>
            {aiPanelOpen && (
              <div className="px-3 pb-3 space-y-2 border-t border-border">
                {onSuggest && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-violet-500/30 text-violet-600 dark:text-violet-300"
                    onClick={onSuggest}
                    disabled={suggesting || isAiFilling}
                  >
                    {suggesting ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}
                    Rellenar todo con Gemini
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Pega salida cruda arriba o usa el panel IA del listado. Cada campo tiene su botón Gemini individual.
                </p>
              </div>
            )}
          </div>
        )}
        <AiFieldWrapper {...ai('metodo_deteccion')}>
          <p className="text-[10px] text-muted-foreground mb-1.5">
            Negritas (**texto**) e imágenes (Ctrl+V) — se exporta a Word en «Método de detección».
          </p>
          <RichMarkdownEditor
            value={values.metodo_deteccion}
            onChange={(v) => set('metodo_deteccion', v)}
            placeholder="Ej. Análisis Nessus, prueba manual, escaneo Nmap…"
            rows={4}
            disabled={isAiFilling}
            aiGlow={animatingField === 'metodo_deteccion'}
            variant="minimal"
            defaultImageCaption={values.titulo.trim() || undefined}
          />
        </AiFieldWrapper>
        <AiFieldWrapper {...ai('raw_tool_output')}>
          <p className="text-[10px] text-muted-foreground mb-1.5">
            Negritas (**texto**) e imágenes (Ctrl+V) — se exporta a Word en «Salidas de herramienta».
          </p>
          <RichMarkdownEditor
            value={values.raw_tool_output}
            onChange={(v) => set('raw_tool_output', v)}
            placeholder="Plugin output Nessus, salida de consola, evidencia de explotación…"
            rows={8}
            disabled={isAiFilling}
            aiGlow={animatingField === 'raw_tool_output'}
            variant="minimal"
            defaultImageCaption={values.titulo.trim() || undefined}
          />
        </AiFieldWrapper>
        <AiFieldWrapper {...ai('explicacion_tecnica')}>
          <p className="text-[10px] text-muted-foreground mb-1.5">
            Negritas (**texto**) e imágenes (Ctrl+V) — se exporta a Word en «Explicación técnica».
          </p>
          <RichMarkdownEditor
            value={values.explicacion_tecnica}
            onChange={(v) => set('explicacion_tecnica', v)}
            placeholder="Explicación técnica del hallazgo, pasos de reproducción, contexto…"
            rows={6}
            disabled={isAiFilling}
            aiGlow={animatingField === 'explicacion_tecnica'}
            variant="minimal"
            defaultImageCaption={values.titulo.trim() || undefined}
          />
        </AiFieldWrapper>
      </Section>

      {!hideActions && (
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 pt-2 pb-1 bg-gradient-to-t from-background via-background/95 to-transparent">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-rose-500/40 text-rose-600 dark:text-rose-300 hover:bg-rose-500/10 mr-auto"
            onClick={onCancel}
            disabled={isAiFilling}
          >
            <X className="size-4 mr-2" />
            Cancelar
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="border-border" onClick={onSave} disabled={saving || isAiFilling || !values.titulo.trim()}>
          {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
          {saveLabel}
        </Button>
        {onPublish && (
          <Button type="button" size="sm" className="bg-violet-600 hover:bg-violet-500" onClick={onPublish} disabled={saving || isAiFilling}>
            <Send className="size-4 mr-2" />
            {publishLabel}
          </Button>
        )}
      </div>
      )}
    </div>
  );
}
