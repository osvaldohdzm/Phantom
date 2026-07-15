'use client';

import { Copy, Plus } from 'lucide-react';
import type { UiMessageKey } from '@/lib/ui-locale';
import {
  MAP_ATTACK_STATUSES,
  type PentestMapNode,
} from '@/lib/pentest-target-map-schema';
import {
  defaultChecklistForKind,
  suggestAttackSteps,
  type AttackSuggestion,
} from '@/lib/pentest-map-attack-graph';

type Props = {
  node: PentestMapNode;
  uiLanguage: 'es' | 'en';
  t: (key: UiMessageKey) => string;
  onPatch: (patch: Partial<Omit<PentestMapNode, 'id'>>) => void;
  onCopy: (text: string) => void;
  onAddSuggestion?: (suggestion: AttackSuggestion) => void;
};

export function MapNodeAttackFields({ node, t, onPatch, onCopy, onAddSuggestion }: Props) {
  const suggestions = suggestAttackSteps(node);

  return (
    <>
      <label className="block space-y-1">
        <span className="phantom-map-field-label">{t('phantomMapAttackStatus')}</span>
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

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="phantom-map-field-label">{t('phantomMapPrivilege')}</span>
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
        <label className="block space-y-1">
          <span className="phantom-map-field-label">{t('phantomMapNetworkZone')}</span>
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
      </div>

      <label className="block space-y-1">
        <span className="phantom-map-field-label">{t('phantomMapTimeline')}</span>
        <input
          type="datetime-local"
          value={node.timelineAt ? node.timelineAt.slice(0, 16) : ''}
          onChange={(e) =>
            onPatch({ timelineAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })
          }
          className="phantom-field font-mono text-[11px]"
        />
      </label>

      {node.kind === 'session' && (
        <>
          <label className="block space-y-1">
            <span className="phantom-map-field-label">{t('phantomMapSessionUser')}</span>
            <input
              value={node.sessionUser ?? ''}
              onChange={(e) => onPatch({ sessionUser: e.target.value || undefined })}
              className="phantom-field font-mono text-xs"
              placeholder="www-data"
            />
          </label>
          <label className="block space-y-1">
            <span className="phantom-map-field-label">{t('phantomMapSessionState')}</span>
            <select
              value={node.sessionState ?? ''}
              onChange={(e) =>
                onPatch({ sessionState: (e.target.value || undefined) as PentestMapNode['sessionState'] })
              }
              className="phantom-field text-xs"
            >
              <option value="">—</option>
              {['unstable', 'stable', 'root', 'low_priv'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="phantom-map-field-label">{t('phantomMapHealth')}</span>
            <select
              value={node.health ?? ''}
              onChange={(e) => onPatch({ health: (e.target.value || undefined) as PentestMapNode['health'] })}
              className="phantom-field text-xs"
            >
              <option value="">—</option>
              {['stable', 'unstable', 'needs_tty', 'dead'].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {node.kind === 'credential' && (
        <>
          <label className="block space-y-1">
            <span className="phantom-map-field-label">{t('phantomMapCredType')}</span>
            <select
              value={node.credentialType ?? 'password'}
              onChange={(e) =>
                onPatch({ credentialType: e.target.value as PentestMapNode['credentialType'] })
              }
              className="phantom-field text-xs"
            >
              {['password', 'hash', 'ssh_key', 'token', 'cookie', 'jwt', 'api_key'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="phantom-map-field-label">Username</span>
            <input
              value={node.username ?? ''}
              onChange={(e) => onPatch({ username: e.target.value || undefined })}
              className="phantom-field font-mono text-xs"
            />
          </label>
        </>
      )}

      {node.kind === 'flag' && (
        <>
          <label className="block space-y-1">
            <span className="phantom-map-field-label">{t('phantomMapFlagType')}</span>
            <select
              value={node.flagType ?? 'user'}
              onChange={(e) => onPatch({ flagType: e.target.value as PentestMapNode['flagType'] })}
              className="phantom-field text-xs"
            >
              {['user', 'root', 'proof', 'local'].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="phantom-map-field-label">Path</span>
            <input
              value={node.flagPath ?? ''}
              onChange={(e) => onPatch({ flagPath: e.target.value || undefined })}
              className="phantom-field font-mono text-[11px]"
              placeholder="/home/user/user.txt"
            />
          </label>
        </>
      )}

      {node.kind === 'pivot' && (
        <label className="block space-y-1">
          <span className="phantom-map-field-label">{t('phantomMapPivotType')}</span>
          <select
            value={node.pivotType ?? 'ligolo'}
            onChange={(e) => onPatch({ pivotType: e.target.value as PentestMapNode['pivotType'] })}
            className="phantom-field text-xs"
          >
            {['socks', 'chisel', 'ligolo', 'ssh_tunnel', 'port_forward'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      )}

      {(node.kind === 'service' || node.kind === 'technology' || node.kind === 'session') && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="phantom-map-field-label">{t('phantomMapChecklist')}</span>
            {!node.checklist?.length ? (
              <button
                type="button"
                className="text-[10px] text-primary hover:underline"
                onClick={() => onPatch({ checklist: defaultChecklistForKind(node.kind) })}
              >
                {t('phantomMapChecklistInit')}
              </button>
            ) : null}
          </div>
          <ul className="space-y-1">
            {(node.checklist ?? []).map((item, idx) => (
              <li key={item.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => {
                    const next = [...(node.checklist ?? [])];
                    next[idx] = { ...item, done: !item.done };
                    onPatch({ checklist: next });
                  }}
                />
                <span className={item.done ? 'line-through opacity-60' : ''}>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-md border border-border/60 bg-muted/20 p-2 space-y-1.5">
          <p className="phantom-map-field-label">{t('phantomMapSuggestions')}</p>
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-start gap-1.5 text-[10px]">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{s.label}</p>
                <p className="text-muted-foreground">{s.reason}</p>
              </div>
              {s.command ? (
                <button
                  type="button"
                  title={t('phantomMapCopyCommand')}
                  onClick={() => onCopy(s.command!)}
                  className="phantom-map-inspector-mini shrink-0"
                >
                  <Copy className="size-3" />
                </button>
              ) : null}
              {onAddSuggestion ? (
                <button
                  type="button"
                  title={t('phantomMapAddNode')}
                  onClick={() => onAddSuggestion(s)}
                  className="phantom-map-inspector-mini shrink-0"
                >
                  <Plus className="size-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
