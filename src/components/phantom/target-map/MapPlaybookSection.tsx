'use client';

import { useMemo } from 'react';
import { Copy, ExternalLink, Sparkles } from 'lucide-react';
import {
  MAP_PLAYBOOK_STATUSES,
  type PentestMapNode,
} from '@/lib/pentest-target-map-schema';
import type { UiMessageKey } from '@/lib/ui-locale';
import {
  MITRE_TACTICS,
  getMitreTactic,
  getMitreTechnique,
  mitreTechniqueUrl,
  mitreTacticUrl,
  searchMitreTechniques,
  suggestTechniqueForTool,
  tacticLabel,
  techniqueLabel,
  techniquesForTactic,
} from '@/lib/pentest-map-mitre';

type Props = {
  node: PentestMapNode;
  uiLanguage: 'es' | 'en';
  t: (key: UiMessageKey) => string;
  copiedField: 'command' | 'output' | 'playbook' | 'schema' | 'schema-notes' | null;
  onPatch: (patch: Partial<Omit<PentestMapNode, 'id'>>) => void;
  onCopy: (text: string, field: 'command' | 'output' | 'playbook' | 'schema') => void;
};

const STATUS_LABELS: Record<string, { es: string; en: string }> = {
  pending: { es: 'Pendiente', en: 'Pending' },
  in_progress: { es: 'En progreso', en: 'In progress' },
  done: { es: 'Completado', en: 'Done' },
  partial: { es: 'Parcial', en: 'Partial' },
  exploited: { es: 'Explotado', en: 'Exploited' },
  pivot: { es: 'Pivot', en: 'Pivot' },
};

export function MapPlaybookSection({
  node,
  uiLanguage,
  t,
  copiedField,
  onPatch,
  onCopy,
}: Props) {
  const lang = uiLanguage === 'es' ? 'es' : 'en';
  const techniques = useMemo(
    () =>
      node.mitreTactic
        ? techniquesForTactic(node.mitreTactic)
        : searchMitreTechniques('', undefined),
    [node.mitreTactic]
  );

  const applySuggestedMitre = () => {
    if (node.kind !== 'command' || !node.tool) return;
    const tech = suggestTechniqueForTool(node.tool);
    if (!tech) return;
    const tac = getMitreTactic(tech.tacticIds[0]);
    onPatch({
      mitreTechnique: tech.id,
      mitreTechniqueName: techniqueLabel(tech, lang),
      mitreTactic: tac?.id,
      mitreTacticName: tac ? tacticLabel(tac, lang) : undefined,
    });
  };

  return (
    <div className="phantom-map-playbook-section space-y-3 border-t border-border pt-3">
      <p className="phantom-map-field-label">{t('phantomMapPlaybook')}</p>

      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{t('phantomMapStepStatus')}</span>
        <select
          value={node.status ?? ''}
          onChange={(e) =>
            onPatch({
              status: (e.target.value || undefined) as PentestMapNode['status'],
            })
          }
          className="phantom-field text-xs"
        >
          <option value="">{lang === 'es' ? '— sin estado —' : '— no status —'}</option>
          {MAP_PLAYBOOK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]?.[lang] ?? s}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{t('phantomMapMitreTactic')}</span>
        <select
          value={node.mitreTactic ?? ''}
          onChange={(e) => {
            const id = e.target.value || undefined;
            const tac = getMitreTactic(id);
            onPatch({
              mitreTactic: id,
              mitreTacticName: tac ? tacticLabel(tac, lang) : undefined,
              mitreTechnique: undefined,
              mitreTechniqueName: undefined,
            });
          }}
          className="phantom-field text-xs"
        >
          <option value="">—</option>
          {MITRE_TACTICS.map((tac) => (
            <option key={tac.id} value={tac.id}>
              {tac.id} — {tacticLabel(tac, lang)}
            </option>
          ))}
        </select>
        {node.mitreTactic ? (
          <a
            href={mitreTacticUrl(node.mitreTactic)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[9px] text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            MITRE
          </a>
        ) : null}
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{t('phantomMapMitreTechnique')}</span>
        <select
          value={node.mitreTechnique ?? ''}
          onChange={(e) => {
            const id = e.target.value || undefined;
            const tech = getMitreTechnique(id);
            const tac = tech ? getMitreTactic(tech.tacticIds[0]) : undefined;
            onPatch({
              mitreTechnique: id,
              mitreTechniqueName: tech ? techniqueLabel(tech, lang) : undefined,
              ...(tac && !node.mitreTactic
                ? { mitreTactic: tac.id, mitreTacticName: tacticLabel(tac, lang) }
                : {}),
            });
          }}
          className="phantom-field text-xs"
        >
          <option value="">—</option>
          {techniques.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.id} — {techniqueLabel(tech, lang)}
            </option>
          ))}
        </select>
        {node.mitreTechnique ? (
          <a
            href={mitreTechniqueUrl(node.mitreTechnique)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[9px] text-primary hover:underline"
          >
            <ExternalLink className="size-3" />
            attack.mitre.org
          </a>
        ) : null}
      </label>

      {node.kind === 'command' && node.tool ? (
        <button type="button" onClick={applySuggestedMitre} className="phantom-btn w-full justify-center text-[10px]">
          <Sparkles className="size-3" />
          {t('phantomMapSuggestMitre')}
        </button>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{t('phantomMapStepNotes')}</span>
        <textarea
          value={node.notes ?? ''}
          onChange={(e) => onPatch({ notes: e.target.value || undefined })}
          rows={4}
          className="phantom-field text-xs leading-relaxed"
          placeholder={t('phantomMapStepNotesHint')}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[10px] text-muted-foreground">{t('phantomMapOutput')}</span>
        <textarea
          value={node.output ?? ''}
          onChange={(e) => onPatch({ output: e.target.value || undefined })}
          rows={5}
          className="phantom-field font-mono text-[10px] leading-relaxed"
          placeholder={t('phantomMapOutputHint')}
        />
        {node.output ? (
          <button
            type="button"
            onClick={() => onCopy(node.output!, 'output')}
            className="phantom-btn w-full justify-center text-[10px]"
          >
            <Copy className="size-3" />
            {copiedField === 'output' ? t('phantomMapCopied') : t('phantomMapCopyOutput')}
          </button>
        ) : null}
      </label>
    </div>
  );
}
