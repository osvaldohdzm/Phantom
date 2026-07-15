'use client';

import { Copy } from 'lucide-react';
import type { UiMessageKey } from '@/lib/ui-locale';
import {
  MAP_COMMAND_VARIABLES,
  getSelectedTargetsForCommand,
  listMapTargetNodes,
  resolveCommandTemplate,
  toggleTargetRef,
  type MapCommandVarKey,
} from '@/lib/pentest-map-command-vars';
import type { PentestMapNode, PentestTargetMapDocument } from '@/lib/pentest-target-map-schema';
import { PENTEST_MAP_TOOLS } from '@/lib/pentest-target-map-schema';

type Props = {
  node: PentestMapNode;
  doc: PentestTargetMapDocument;
  t: (key: UiMessageKey) => string;
  copiedField: 'command' | 'output' | 'playbook' | 'schema' | 'schema-notes' | null;
  onPatch: (patch: Partial<Omit<PentestMapNode, 'id'>>) => void;
  onCopy: (text: string, field: 'command' | 'output' | 'playbook' | 'schema') => void;
  mode?: 'hotzone' | 'config';
};

export function MapCommandVariablesSection({
  node,
  doc,
  t,
  copiedField,
  onPatch,
  onCopy,
  mode = 'config',
}: Props) {
  const targets = listMapTargetNodes(doc);
  const selected = getSelectedTargetsForCommand(doc, node);
  const template = node.command ?? '';
  const resolved = template ? resolveCommandTemplate(template, doc, node) : '';
  const hasVars = /\{\{|\<target\>/i.test(template);

  const insertVar = (key: MapCommandVarKey) => {
    onPatch({ command: `${template}${template.endsWith(' ') || !template ? '' : ' '}${key}` });
  };

  const toggleTarget = (targetId: string, checked: boolean) => {
    onPatch({ targetRefs: toggleTargetRef(node.targetRefs, targetId, checked) });
  };

  if (mode === 'hotzone') {
    if (!template) return null;
    return (
      <div className="space-y-2 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <div className="space-y-1">
          <span className="phantom-map-field-label text-emerald-600 dark:text-emerald-400 font-mono text-[9px] uppercase tracking-wider">
            {t('phantomMapCmdResolved')}
          </span>
          <pre className="max-h-24 overflow-auto rounded-md border border-emerald-500/25 bg-emerald-500/10 p-2.5 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap break-all select-all">
            {hasVars ? resolved : template}
          </pre>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onCopy(hasVars ? resolved : template, 'command')}
            className="phantom-btn flex-1 justify-center py-2.5 text-xs font-bold bg-cyan-600 dark:bg-cyan-500 hover:bg-cyan-700 dark:hover:bg-cyan-400 text-white dark:text-black border-none shadow-md transition-all active:scale-[0.98]"
          >
            <Copy className="size-3.5 mr-1" />
            {copiedField === 'command' ? t('phantomMapCopied') : t('phantomMapCopyResolved')}
          </button>
          {hasVars ? (
            <button
              type="button"
              onClick={() => onCopy(template, 'command')}
              className="phantom-btn justify-center py-2.5 px-3 text-[11px] bg-muted/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all"
              title={t('phantomMapCopyTemplate')}
            >
              <Copy className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-2.5">
      {targets.length > 0 ? (
        <div className="space-y-1.5">
          <p className="phantom-map-field-label">{t('phantomMapCmdTargets')}</p>
          <p className="text-[9px] leading-relaxed text-muted-foreground">{t('phantomMapCmdTargetsHint')}</p>
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {targets.map((tgt) => {
              const checked = (node.targetRefs?.length ? node.targetRefs : selected.map((s) => s.id)).includes(
                tgt.id
              );
              return (
                <li key={tgt.id} className="flex items-start gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleTarget(tgt.id, e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{tgt.label}</span>
                    {tgt.ip ? (
                      <span className="ml-1 font-mono text-[10px] text-muted-foreground">{tgt.ip}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">{t('phantomMapCmdNoTargets')}</p>
      )}

      {(() => {
        const domains = doc.nodes.filter((n) => n.kind === 'domain');
        if (domains.length === 0) return null;
        return (
          <label className="block space-y-1">
            <span className="phantom-map-field-label">Active Domain ({"{{domain}}"})</span>
            <select
              value={node.domainRef ?? (domains.length === 1 ? domains[0].id : '')}
              onChange={(e) => onPatch({ domainRef: e.target.value || undefined })}
              className="phantom-field text-xs font-mono"
            >
              {domains.length > 1 && <option value="">— Select Domain —</option>}
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        );
      })()}

      <div className="space-y-1">
        <p className="phantom-map-field-label">{t('phantomMapCmdVariables')}</p>
        <div className="flex flex-wrap gap-1">
          {MAP_COMMAND_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              title={v.desc}
              onClick={() => insertVar(v.key)}
              className="rounded border border-primary/30 bg-primary/8 px-1.5 py-0.5 font-mono text-[9px] text-primary hover:bg-primary/15"
            >
              {v.key}
            </button>
          ))}
        </div>
      </div>

      {node.kind === 'command' && (
        <label className="block space-y-1">
          <span className="phantom-map-field-label">{t('phantomMapTool')}</span>
          <select
            value={node.tool ?? 'nmap'}
            onChange={(e) => onPatch({ tool: e.target.value })}
            className="phantom-field text-xs"
          >
            {PENTEST_MAP_TOOLS.map((tool) => (
              <option key={tool} value={tool}>
                {tool}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block space-y-1">
        <span className="phantom-map-field-label">{t('phantomMapCmdTemplate')}</span>
        <textarea
          value={template}
          onChange={(e) => onPatch({ command: e.target.value || undefined })}
          rows={4}
          placeholder="nmap -sV -sC -T4 {{target}}"
          className="phantom-field font-mono text-[11px] leading-relaxed"
        />
      </label>
    </div>
  );
}
