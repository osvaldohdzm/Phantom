'use client';

import { useState, useMemo } from 'react';
import { Copy, FileJson, GitBranch, Trash2, ArrowUp, ArrowDown, Pin, ArrowDownAZ, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UiMessageKey } from '@/lib/ui-locale';
import {
  MAP_EDGE_RELATIONS,
  MAP_ATTACK_STATUSES,
  MAP_PLAYBOOK_STATUSES,
  PENTEST_MAP_NODE_KINDS,
  type PentestMapNode,
  type PentestMapNodeKind,
  type PentestTargetMapDocument,
} from '@/lib/pentest-target-map-schema';
import { getMapKindEntry, kindLabel } from '@/lib/pentest-target-map-kinds';
import { getMapNodeIconDataUri } from '@/lib/pentest-target-map-icons';
import { MapPlaybookSection } from '@/components/phantom/target-map/MapPlaybookSection';
import { MapNodeAttackFields } from '@/components/phantom/target-map/MapNodeAttackFields';
import { playbookStatusGlyph } from '@/lib/pentest-map-playbook';
import { MapCommandVariablesSection } from '@/components/phantom/target-map/MapCommandVariablesSection';
import { nodeHasCommandField } from '@/lib/pentest-map-command-vars';
import type { AttackSuggestion } from '@/lib/pentest-map-attack-graph';
import {
  MITRE_TACTICS,
  getMitreTactic,
  getMitreTechnique,
  tacticLabel,
  techniqueLabel,
  techniquesForTactic,
  searchMitreTechniques,
} from '@/lib/pentest-map-mitre';

type Props = {
  node: PentestMapNode;
  doc: PentestTargetMapDocument;
  isDark: boolean;
  uiLanguage: 'es' | 'en';
  isTouchDevice?: boolean;
  connectMode: boolean;
  copiedField: 'command' | 'output' | 'playbook' | 'schema' | 'schema-notes' | null;
  setCopiedField: (f: 'command' | 'output' | 'playbook' | 'schema' | 'schema-notes' | null) => void;
  t: (key: UiMessageKey) => string;
  onPatch: (patch: Partial<Omit<PentestMapNode, 'id'>>) => void;
  onCopy: (text: string, field: 'command' | 'output' | 'playbook' | 'schema') => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onConnect: () => void;
  onRunSelectedCommand?: () => void;
  onOpenJson: () => void;
  onClose: () => void;
  onAddSuggestion?: (suggestion: AttackSuggestion) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onDeleteNodeById?: (nodeId: string) => void;
  onAddPort?: (port: number, service: string) => void;
};

const STATUS_LABELS: Record<string, { es: string; en: string }> = {
  pending: { es: 'Pendiente', en: 'Pending' },
  in_progress: { es: 'En progreso', en: 'In progress' },
  done: { es: 'Completado', en: 'Done' },
  partial: { es: 'Parcial', en: 'Partial' },
  exploited: { es: 'Explotado', en: 'Exploited' },
  pivot: { es: 'Pivot', en: 'Pivot' },
};

export function MapRightInspector({
  node,
  doc,
  isDark,
  uiLanguage,
  isTouchDevice,
  connectMode,
  copiedField,
  t,
  onPatch,
  onCopy,
  onDelete,
  onDuplicate,
  onConnect,
  onOpenJson,
  onClose,
  onAddSuggestion,
  onSelectNode,
  onDeleteNodeById,
  onAddPort,
}: Props) {
  const kindEntry = getMapKindEntry(node.kind);
  const description = node.meta?.description ?? '';
  const lang = uiLanguage === 'es' ? 'es' : 'en';

  const techniques = useMemo(
    () =>
      node.mitreTactic
        ? techniquesForTactic(node.mitreTactic)
        : searchMitreTechniques('', undefined),
    [node.mitreTactic]
  );

  const inspectorContent = (
    <>
      <div className="phantom-map-inspector-header">
        <div className="flex min-w-0 items-center gap-2">
          <img src={getMapNodeIconDataUri(node.kind, isDark)} alt="" className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {playbookStatusGlyph(node.status) ? `${playbookStatusGlyph(node.status)} ` : ''}
              {node.label}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {kindLabel(kindEntry, uiLanguage)}
              {node.mitreTechnique ? ` · ${node.mitreTechnique}` : ''}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="phantom-map-inspector-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="phantom-map-inspector-toolbar flex items-center justify-between gap-1.5 p-2 rounded-xl bg-muted/20 border border-border/40">
        <MiniBtn icon={<Copy className="size-3.5" />} onClick={onDuplicate} className="flex-1">
          {t('phantomMapDuplicate')}
        </MiniBtn>
        <MiniBtn
          icon={<GitBranch className="size-3.5" />}
          onClick={onConnect}
          active={connectMode}
          className="flex-1"
        >
          {connectMode ? 'Connecting' : t('phantomMapConnect')}
        </MiniBtn>
        <MiniBtn icon={<Trash2 className="size-3.5" />} onClick={onDelete} danger className="flex-1">
          {t('phantomMapDeleteNode')}
        </MiniBtn>
      </div>

      <div className="phantom-map-inspector-body space-y-3">
        <label className="block space-y-1">
          <span className="phantom-map-field-label">{t('phantomMapKind')}</span>
          <select
            value={node.kind}
            onChange={(e) => onPatch({ kind: e.target.value as PentestMapNodeKind })}
            className="phantom-field text-xs font-medium"
          >
            {PENTEST_MAP_NODE_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(getMapKindEntry(k), uiLanguage)} ({k})
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="phantom-map-field-label">{t('phantomMapLabel')}</span>
          <input
            value={node.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            className="phantom-field text-sm"
            autoFocus={!isTouchDevice}
          />
        </label>

        {nodeHasCommandField(node) ? (
          <>
            {/* 1. Hot Zone (Zona de Acción Inmediata) */}
            <MapCommandVariablesSection
              node={node}
              doc={doc}
              t={t}
              copiedField={copiedField}
              onPatch={onPatch}
              onCopy={onCopy}
              mode="hotzone"
            />

            {/* 2. Configuración y Variables */}
            <MapCommandVariablesSection
              node={node}
              doc={doc}
              t={t}
              copiedField={copiedField}
              onPatch={onPatch}
              onCopy={onCopy}
              mode="config"
            />

            <label className="block space-y-1">
              <span className="phantom-map-field-label">{t('phantomMapDescription')}</span>
              <textarea
                value={description}
                onChange={(e) => {
                  const val = e.target.value;
                  const meta = { ...(node.meta ?? {}) };
                  if (val) meta.description = val;
                  else delete meta.description;
                  onPatch({ meta: Object.keys(meta).length > 0 ? meta : undefined });
                }}
                rows={2}
                className="phantom-field text-xs leading-relaxed"
                placeholder="…"
              />
            </label>

            {/* 3. Clasificación Operativa */}
            <div className="border-t border-border/40 pt-3 space-y-3">
              <span className="phantom-map-field-label block uppercase text-[10px] tracking-wider text-muted-foreground font-bold">
                Clasificación Operativa
              </span>
              
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t('phantomMapAttackStatus')}</span>
                  <select
                    value={node.attackStatus ?? ''}
                    onChange={(e) =>
                      onPatch({ attackStatus: (e.target.value || undefined) as PentestMapNode['attackStatus'] })
                    }
                    className="phantom-field text-xs"
                  >
                    <option value="">—</option>
                    {MAP_ATTACK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t('phantomMapPrivilege')}</span>
                  <select
                    value={node.privilegeLevel ?? ''}
                    onChange={(e) =>
                      onPatch({ privilegeLevel: (e.target.value || undefined) as PentestMapNode['privilegeLevel'] })
                    }
                    className="phantom-field text-xs"
                  >
                    <option value="">—</option>
                    {['unauthenticated', 'guest', 'low', 'user', 'admin', 'root', 'system'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t('phantomMapNetworkZone')}</span>
                  <select
                    value={node.networkZone ?? ''}
                    onChange={(e) =>
                      onPatch({ networkZone: (e.target.value || undefined) as PentestMapNode['networkZone'] })
                    }
                    className="phantom-field text-xs"
                  >
                    <option value="">—</option>
                    {['external', 'dmz', 'internal', 'domain', 'crown_jewels'].map((z) => (
                      <option key={z} value={z}>
                        {z}
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
                </label>
              </div>

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
              </label>
            </div>

            {/* 4. Registro y Evidencia */}
            <div className="border-t border-border/40 pt-3 space-y-3">
              <span className="phantom-map-field-label block uppercase text-[10px] tracking-wider text-muted-foreground font-bold">
                Registro y Evidencia
              </span>

              <div className="grid grid-cols-2 gap-2">
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
                    <option value="">—</option>
                    {MAP_PLAYBOOK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]?.[lang] ?? s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] text-muted-foreground">{t('phantomMapTimeline')}</span>
                  <input
                    type="datetime-local"
                    value={node.timelineAt ? node.timelineAt.slice(0, 16) : ''}
                    onChange={(e) =>
                      onPatch({ timelineAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })
                    }
                    className="phantom-field font-mono text-[11px]"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">{t('phantomMapStepNotes')}</span>
                <textarea
                  value={node.notes ?? ''}
                  onChange={(e) => onPatch({ notes: e.target.value || undefined })}
                  rows={3}
                  className="phantom-field text-xs leading-relaxed"
                  placeholder={t('phantomMapStepNotesHint')}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">{t('phantomMapOutput')}</span>
                <textarea
                  value={node.output ?? ''}
                  onChange={(e) => onPatch({ output: e.target.value || undefined })}
                  rows={4}
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
          </>
        ) : (
          <>
            {/* Standard non-command Node inspector */}
            <label className="block space-y-1">
              <span className="phantom-map-field-label">{t('phantomMapDescription')}</span>
              <textarea
                value={description}
                onChange={(e) => {
                  const val = e.target.value;
                  const meta = { ...(node.meta ?? {}) };
                  if (val) meta.description = val;
                  else delete meta.description;
                  onPatch({ meta: Object.keys(meta).length > 0 ? meta : undefined });
                }}
                rows={3}
                className="phantom-field text-xs leading-relaxed"
                placeholder="…"
              />
            </label>

            {(node.kind === 'attacker' || node.kind === 'target' || node.kind === 'initial_target' || node.kind === 'derived_target') && (
              <label className="block space-y-1">
                <span className="phantom-map-field-label">IP</span>
                <input
                  value={node.ip ?? ''}
                  onChange={(e) => onPatch({ ip: e.target.value || undefined })}
                  className="phantom-field font-mono text-xs"
                />
              </label>
            )}

            {(node.kind === 'port' || node.kind === 'service') && (
              <>
                <label className="block space-y-1">
                  <span className="phantom-map-field-label">{t('phantomMapPort')}</span>
                  <input
                    type="number"
                    value={node.port ?? ''}
                    onChange={(e) =>
                      onPatch({ port: e.target.value ? parseInt(e.target.value, 10) : undefined })
                    }
                    className="phantom-field font-mono text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="phantom-map-field-label">{t('phantomMapProtocol')}</span>
                  <select
                    value={node.protocol ?? 'tcp'}
                    onChange={(e) => onPatch({ protocol: e.target.value })}
                    className="phantom-field text-xs"
                  >
                    <option value="tcp">tcp</option>
                    <option value="udp">udp</option>
                  </select>
                </label>
              </>
            )}

            {node.kind === 'service' && (
              <label className="block space-y-1">
                <span className="phantom-map-field-label">Service</span>
                <input
                  value={node.service ?? ''}
                  onChange={(e) => onPatch({ service: e.target.value || undefined })}
                  className="phantom-field text-xs"
                />
              </label>
            )}

            {(node.kind === 'technology' || node.kind === 'route') && (
              <label className="block space-y-1">
                <span className="phantom-map-field-label">{t('phantomMapUrl')}</span>
                <input
                  value={node.url ?? ''}
                  onChange={(e) => onPatch({ url: e.target.value || undefined })}
                  className="phantom-field font-mono text-[11px]"
                />
              </label>
            )}

            {node.kind === 'vulnerability' && (
              <>
                <label className="block space-y-1">
                  <span className="phantom-map-field-label">{t('phantomMapCve')}</span>
                  <input
                    value={node.cve ?? ''}
                    onChange={(e) => onPatch({ cve: e.target.value || undefined })}
                    className="phantom-field font-mono text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="phantom-map-field-label">{t('phantomMapSeverity')}</span>
                  <select
                    value={node.severity ?? 'medium'}
                    onChange={(e) =>
                      onPatch({ severity: e.target.value as PentestMapNode['severity'] })
                    }
                    className="phantom-field text-xs"
                  >
                    {(['info', 'low', 'medium', 'high', 'critical'] as const).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {(node.kind === 'target' || node.kind === 'initial_target' || node.kind === 'derived_target') && (() => {
              const unsortedPortNodes = doc.edges
                .filter(e => e.from === node.id)
                .map(e => doc.nodes.find(n => n.id === e.to))
                .filter((n): n is import('@/lib/pentest-target-map-schema').PentestMapNode => Boolean(n && (n.kind === 'port' || n.kind === 'service' || n.kind === 'technology')));

              let portNodes = [...unsortedPortNodes];
              if (node.subItemOrder && node.subItemOrder.length > 0) {
                const orderMap = new Map(node.subItemOrder.map((id, index) => [id, index]));
                portNodes.sort((a, b) => {
                  const idxA = orderMap.get(a.id) ?? Infinity;
                  const idxB = orderMap.get(b.id) ?? Infinity;
                  if (idxA !== idxB) return idxA - idxB;
                  return (a.port || 0) - (b.port || 0);
                });
              } else {
                portNodes.sort((a, b) => (a.port || 0) - (b.port || 0));
              }

              const moveItem = (index: number, direction: 'up' | 'down' | 'pin') => {
                const newOrder = portNodes.map(n => n.id);
                const temp = newOrder[index];
                if (direction === 'up' && index > 0) {
                  newOrder[index] = newOrder[index - 1];
                  newOrder[index - 1] = temp;
                } else if (direction === 'down' && index < newOrder.length - 1) {
                  newOrder[index] = newOrder[index + 1];
                  newOrder[index + 1] = temp;
                } else if (direction === 'pin' && index > 0) {
                  newOrder.splice(index, 1);
                  newOrder.unshift(temp);
                }
                onPatch({ subItemOrder: newOrder });
              };

              const sortItems = (by: 'port' | 'az') => {
                const sorted = [...portNodes].sort((a, b) => {
                  if (by === 'port') return (a.port || 0) - (b.port || 0);
                  return (a.service || a.label || '').localeCompare(b.service || b.label || '');
                });
                onPatch({ subItemOrder: sorted.map(n => n.id) });
              };

              return (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="phantom-map-field-label mb-0">Discovered Services & Ports</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => sortItems('port')} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Sort by Port">
                        <Hash className="size-3" />
                      </button>
                      <button type="button" onClick={() => sortItems('az')} className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground" title="Sort A-Z">
                        <ArrowDownAZ className="size-3" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {portNodes.map((portNode, idx) => (
                      <div key={portNode.id} className="flex flex-col gap-1.5 p-1.5 rounded-lg bg-muted/30 border border-border/20 text-xs group">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold flex items-center gap-1.5">
                            <span className="text-[10px] uppercase text-muted-foreground">{portNode.kind}</span>
                            {portNode.port ? `${portNode.port} ` : ''}({portNode.service || portNode.label || 'unknown'})
                          </span>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => onSelectNode?.(portNode.id)} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/15 text-[10px]">
                              Edit
                            </button>
                            <button type="button" onClick={() => { if (portNode) onDeleteNodeById?.(portNode.id); }} className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/15 text-[10px]">
                              Delete
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => moveItem(idx, 'pin')} disabled={idx === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Pin to top">
                            <Pin className="size-3" />
                          </button>
                          <button type="button" onClick={() => moveItem(idx, 'up')} disabled={idx === 0} className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Move Up">
                            <ArrowUp className="size-3" />
                          </button>
                          <button type="button" onClick={() => moveItem(idx, 'down')} disabled={idx === portNodes.length - 1} className="p-1 hover:bg-muted rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Move Down">
                            <ArrowDown className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <QuickAddPortForm onAdd={(port, service) => onAddPort?.(port, service)} />
                </div>
              );
            })()}

            <MapPlaybookSection
              node={node}
              uiLanguage={uiLanguage}
              t={t}
              copiedField={copiedField}
              onPatch={onPatch}
              onCopy={onCopy}
            />

            <MapNodeAttackFields
              node={node}
              uiLanguage={uiLanguage}
              t={t}
              onPatch={onPatch}
              onCopy={(text) => onCopy(text, 'command')}
              onAddSuggestion={onAddSuggestion}
            />
          </>
        )}

        {/* 5. Datos Técnicos */}
        <div className="border-t border-border/40 pt-3 space-y-2">
          <p className="phantom-map-field-label">{t('phantomMapEdgeRelations')}</p>
          <p className="text-[9px] leading-relaxed text-muted-foreground">{MAP_EDGE_RELATIONS.join(' · ')}</p>

          <p className="truncate font-mono text-[9px] text-muted-foreground">{node.id}</p>

          <button type="button" onClick={onOpenJson} className="phantom-btn w-full justify-center text-[10px]">
            <FileJson className="size-3" />
            {t('phantomMapOpenJson')}
          </button>
        </div>
      </div>
    </>
  );

  if (isTouchDevice) {
    return (
      <>
        <div className="phantom-map-inspector-backdrop" onClick={onClose} />
        <aside className="phantom-map-inspector phantom-map-inspector--touch">
          <div className="phantom-map-inspector-drag-handle" />
          {inspectorContent}
        </aside>
      </>
    );
  }

  return (
    <aside className="phantom-map-inspector">
      {inspectorContent}
    </aside>
  );
}

function MiniBtn({
  icon,
  onClick,
  active,
  danger,
  disabled,
  className,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all select-none',
        active
          ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]'
          : danger
            ? 'border-rose-500/30 bg-rose-500/5 text-rose-500 hover:bg-rose-500/10'
            : 'border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
        disabled && 'pointer-events-none opacity-40',
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

function QuickAddPortForm({ onAdd }: { onAdd: (port: number, service: string) => void }) {
  const [port, setPort] = useState('');
  const [service, setService] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) return;
    onAdd(portNum, service);
    setPort('');
    setService('');
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onAdd(80, 'http')}
          className="px-2 py-1 bg-muted/30 hover:bg-muted text-[10px] rounded border border-border/40 text-muted-foreground font-mono transition-colors"
        >
          + 80/HTTP
        </button>
        <button
          type="button"
          onClick={() => onAdd(443, 'https')}
          className="px-2 py-1 bg-muted/30 hover:bg-muted text-[10px] rounded border border-border/40 text-muted-foreground font-mono transition-colors"
        >
          + 443/HTTPS
        </button>
        <button
          type="button"
          onClick={() => onAdd(22, 'ssh')}
          className="px-2 py-1 bg-muted/30 hover:bg-muted text-[10px] rounded border border-border/40 text-muted-foreground font-mono transition-colors"
        >
          + 22/SSH
        </button>
        <button
          type="button"
          onClick={() => onAdd(445, 'smb')}
          className="px-2 py-1 bg-muted/30 hover:bg-muted text-[10px] rounded border border-border/40 text-muted-foreground font-mono transition-colors"
        >
          + 445/SMB
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          type="number"
          placeholder="Port (80)"
          value={port}
          onChange={e => setPort(e.target.value)}
          className="phantom-field w-16 text-xs font-mono"
          required
        />
        <input
          type="text"
          placeholder="Service (http)"
          value={service}
          onChange={e => setService(e.target.value)}
          className="phantom-field flex-1 text-xs"
        />
        <button
          type="submit"
          className="phantom-btn phantom-btn-primary py-1 px-2.5 h-7 text-[10px]"
        >
          + Add
        </button>
      </form>
    </div>
  );
}
