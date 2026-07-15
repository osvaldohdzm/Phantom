'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, RefreshCw, ScanSearch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type AssetSourceType } from '@/lib/asset-spreadsheet-columns';
import { assetSourceLabel } from '@/lib/ui-locale';
import { useUiT } from '@/lib/use-ui-locale';
import {
  listAssetScanTargets,
  passAssetScanTargets,
  promoteAssetScanTargets,
  refreshAssetScanTargets,
  type AssetScanTarget,
} from '@/lib/secops-api';
import { AssetsScanImportZone } from '@/components/assets-scan-import-zone';

type AssetsScanTargetsPanelProps = {
  engagementId: string | null;
  onPromoted?: () => void;
};

const DEST_OPTIONS = [
  { id: 'host_inventory', label: 'Host Inventory' },
  { id: 'app_inventory', label: 'Apps Inventory' },
  { id: 'external_recon', label: 'External Reconnaissance' },
  { id: 'external_attack_surface', label: 'External Attack Surface' },
  { id: 'internal_recon', label: 'Internal Reconnaissance' },
  { id: 'internal_attack_surface', label: 'Internal Attack Surface' },
] as const;

export function AssetsScanTargetsPanel({ engagementId, onPromoted }: AssetsScanTargetsPanelProps) {
  const { t, uiLanguage, format } = useUiT();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'accepted' | 'passed' | 'all'>(
    'pending'
  );
  const [targets, setTargets] = useState<AssetScanTarget[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [promoteSource, setPromoteSource] = useState<string>('host_inventory');
  const [hasUserOverridden, setHasUserOverridden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'refresh' | 'promote' | 'pass' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect destination based on selected scan targets' tool sources
  useEffect(() => {
    if (hasUserOverridden || selected.size === 0) return;
    const selectedRows = targets.filter(t => selected.has(t.id));
    const hasAppTool = selectedRows.some(row => 
      (row.tool_sources ?? []).some(src => {
        const lowerSrc = src.toLowerCase();
        return lowerSrc.includes('acunetix') || lowerSrc.includes('zap') || lowerSrc.includes('burp') || lowerSrc.includes('web');
      })
    );
    setPromoteSource(hasAppTool ? 'app_inventory' : 'host_inventory');
  }, [selected, targets, hasUserOverridden]);

  useEffect(() => {
    if (selected.size === 0) {
      setHasUserOverridden(false);
    }
  }, [selected]);

  const statusFilters = useMemo(
    () =>
      [
        { id: 'pending' as const, label: t('assetsScanStatusPending') },
        { id: 'accepted' as const, label: t('assetsScanStatusAccepted') },
        { id: 'passed' as const, label: t('assetsScanStatusPassed') },
        { id: 'all' as const, label: t('assetsScanStatusAll') },
      ] as const,
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAssetScanTargets({
        status: statusFilter,
        engagement_id: engagementId || undefined,
      });
      setTargets(rows);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('assetsLoadError'));
      setTargets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, engagementId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingSelectable = useMemo(
    () => targets.filter((row) => row.status === 'pending'),
    [targets]
  );

  const toggleAll = () => {
    if (selected.size === pendingSelectable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingSelectable.map((row) => row.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runRefresh = async () => {
    setBusy('refresh');
    setNotice(null);
    setError(null);
    try {
      const res = await refreshAssetScanTargets(engagementId || undefined);
      setNotice(res.message ?? `${res.pending}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setBusy(null);
    }
  };

  const runPromote = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy('promote');
    setNotice(null);
    setError(null);
    try {
      let sourceType: AssetSourceType = 'inventory';
      let assetType: string | undefined = undefined;

      if (promoteSource === 'host_inventory') {
        sourceType = 'inventory';
        assetType = 'Host';
      } else if (promoteSource === 'app_inventory') {
        sourceType = 'inventory';
        assetType = 'App';
      } else {
        sourceType = promoteSource as AssetSourceType;
      }

      const res = await promoteAssetScanTargets({
        target_ids: ids,
        source_type: sourceType,
        engagement_id: engagementId,
        asset_type: assetType,
      });
      setNotice(res.message ?? String(res.processed));
      onPromoted?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setBusy(null);
    }
  };

  const runPass = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy('pass');
    setNotice(null);
    setError(null);
    try {
      const res = await passAssetScanTargets(ids);
      setNotice(res.message ?? String(res.processed));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground max-w-3xl">{t('assetsScanIntro')}</p>

      <AssetsScanImportZone
        engagementId={engagementId}
        onImported={() => {
          void load();
          onPromoted?.();
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border/60 bg-background p-0.5">
          {statusFilters.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px]',
                statusFilter === opt.id
                  ? 'bg-foreground text-background font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={busy !== null}
          onClick={() => void runRefresh()}
        >
          {busy === 'refresh' ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {t('assetsScanRefresh')}
        </Button>

        {statusFilter === 'pending' || statusFilter === 'all' ? (
          <>
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              {t('assetsScanDestination')}
              <select
                className="h-7 rounded border border-input bg-background px-1.5 text-[10px]"
                value={promoteSource}
                onChange={(e) => {
                  setPromoteSource(e.target.value);
                  setHasUserOverridden(true);
                }}
              >
                {DEST_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <Button
              type="button"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={busy !== null || selected.size === 0}
              onClick={() => void runPromote()}
            >
              {busy === 'promote' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              {format('assetsScanAdd', { count: selected.size })}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={busy !== null || selected.size === 0}
              onClick={() => void runPass()}
            >
              {busy === 'pass' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              {format('assetsScanPass', { count: selected.size })}
            </Button>
          </>
        ) : null}
      </div>

      {notice ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : targets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          <ScanSearch className="size-8 mx-auto mb-2 opacity-40" />
          {t('assetsScanEmpty')}
        </div>
      ) : (
        <div className="overflow-auto max-h-[min(50vh,480px)] rounded-lg border border-border">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {statusFilter !== 'accepted' && statusFilter !== 'passed' ? (
                  <th className="border-b border-border px-2 py-1.5 w-8">
                    <input
                      type="checkbox"
                      checked={
                        pendingSelectable.length > 0 &&
                        selected.size === pendingSelectable.length
                      }
                      onChange={toggleAll}
                      aria-label={t('assetsScanSelectAll')}
                    />
                  </th>
                ) : (
                  <th className="w-8" />
                )}
                <th className="border-b border-border px-2 py-1.5 text-left">{t('assetsScanColTarget')}</th>
                <th className="border-b border-border px-2 py-1.5 text-left">{t('assetsScanColComponent')}</th>
                <th className="border-b border-border px-2 py-1.5 text-left">{t('assetsScanColSource')}</th>
                <th className="border-b border-border px-2 py-1.5 text-right">{t('assetsScanColFindings')}</th>
                <th className="border-b border-border px-2 py-1.5 text-left">{t('assetsScanColStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="border-b border-border/50 px-2 py-1">
                    {row.status === 'pending' ? (
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={row.display_name}
                      />
                    ) : null}
                  </td>
                  <td className="border-b border-border/50 px-2 py-1 font-medium">{row.display_name}</td>
                  <td className="border-b border-border/50 px-2 py-1 text-muted-foreground font-mono text-[10px]">
                    {row.componente_afectado}
                  </td>
                  <td className="border-b border-border/50 px-2 py-1">
                    {(row.tool_sources ?? []).join(', ') || '—'}
                  </td>
                  <td className="border-b border-border/50 px-2 py-1 text-right tabular-nums">
                    {row.finding_count}
                  </td>
                  <td className="border-b border-border/50 px-2 py-1">
                    {row.status === 'pending' ? (
                      <span className="text-amber-700 dark:text-amber-400">{t('assetsScanStatusPendingRow')}</span>
                    ) : row.status === 'accepted' ? (
                      <span className="text-emerald-700 dark:text-emerald-400">{t('assetsScanStatusAcceptedRow')}</span>
                    ) : (
                      <span className="text-muted-foreground">{t('assetsScanStatusPassedRow')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
