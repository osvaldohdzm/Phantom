'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Loader2, Network, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { importAssetScanTargets, type AssetSourceType } from '@/lib/secops-api';
import { LARGE_INGEST_BYTES } from '@/lib/ingest-upload';
import { LongTaskProgress } from '@/components/long-task-progress';
import { estimateIngestSeconds } from '@/lib/eta-progress';
import { assetSourceLabel } from '@/lib/ui-locale';
import { useUiT } from '@/lib/use-ui-locale';

const ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.csv'],
  'text/xml': ['.xml'],
  'application/xml': ['.xml'],
  'text/plain': ['.nmap', '.gnmap', '.txt'],
};

const DIRECT_DESTINATIONS: AssetSourceType[] = [
  'internal_attack_surface',
  'external_attack_surface',
  'inventory',
  'internal_recon',
  'external_recon',
];

type AssetsScanImportZoneProps = {
  engagementId: string | null;
  onImported: () => void;
};

function formatImportNotice(
  result: Awaited<ReturnType<typeof importAssetScanTargets>>,
  t: (key: Parameters<typeof import('@/lib/ui-locale').uiT>[0]) => string,
  format: (
    key: Parameters<typeof import('@/lib/ui-locale').uiT>[0],
    vars: Record<string, string | number>
  ) => string,
  destLabel: string
): string {
  const source =
    result.source === 'nmap' ? t('assetsScanImportSourceNmap') : t('assetsScanImportSourceNessus');
  const count = result.targets_only ? result.unique_targets : result.created_count;
  const parts = [
    result.targets_only
      ? format('assetsScanImportResultTargets', { count, source })
      : format('assetsScanImportResultFindings', { count, source }),
  ];

  if (result.assets_created > 0 || result.assets_updated > 0) {
    parts.push(
      format('assetsScanImportResultInventory', {
        created: result.assets_created,
        updated: result.assets_updated,
        dest: destLabel,
      })
    );
  } else {
    parts.push(
      format('assetsScanImportResultQueue', {
        discovered: result.discovered,
        pending: result.pending,
      })
    );
  }

  if (result.reopened > 0) {
    parts.push(format('assetsScanImportResultReopened', { count: result.reopened }));
  }
  if (result.discovered === 0 && result.import_keys > 0 && result.assets_created === 0) {
    parts.push(format('assetsScanImportResultOverlap', { keys: result.import_keys }));
  }
  if (result.used_default_engagement) {
    parts.push(t('assetsScanImportResultDefaultEngagement'));
  }
  return parts.join('. ');
}

export function AssetsScanImportZone({ engagementId, onImported }: AssetsScanImportZoneProps) {
  const { t, format, uiLanguage } = useUiT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [estimateSec, setEstimateSec] = useState(30);
  const [directDestination, setDirectDestination] =
    useState<AssetSourceType>('internal_attack_surface');
  const [targetsOnly, setTargetsOnly] = useState(true);

  const destLabel = useMemo(
    () => assetSourceLabel(directDestination, uiLanguage),
    [directDestination, uiLanguage]
  );

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (!files.length || busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      setElapsedSec(0);
      let lastMsg: string | null = null;
      try {
        for (const file of files) {
          setActiveFile(file);
          setEstimateSec(estimateIngestSeconds(Math.max(file.size, LARGE_INGEST_BYTES / 10)));
          const result = await importAssetScanTargets(file, {
            engagement_id: engagementId ?? undefined,
            promote_source_type: directDestination,
            targets_only: targetsOnly,
          });
          lastMsg = formatImportNotice(result, t, format, destLabel);
        }
        setNotice(lastMsg);
        onImported();
      } catch (e) {
        setError(e instanceof Error ? e.message : t('assetsScanImportError'));
      } finally {
        setBusy(false);
        setActiveFile(null);
      }
    },
    [busy, engagementId, onImported, directDestination, targetsOnly, t, format, destLabel]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDrop(files),
    accept: ACCEPT,
    disabled: busy,
    multiple: true,
  });

  return (
    <div className="space-y-2">
      <label className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        <span>{t('assetsScanImportDirectLabel')}</span>
        <select
          className="h-7 min-w-[12rem] rounded border border-input bg-background px-1.5 text-[10px] text-foreground"
          value={directDestination}
          onChange={(e) => setDirectDestination(e.target.value as AssetSourceType)}
          disabled={busy}
        >
          {DIRECT_DESTINATIONS.map((k) => (
            <option key={k} value={k}>
              {assetSourceLabel(k, uiLanguage)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[10px] text-muted-foreground max-w-3xl leading-snug">
        {t('assetsScanImportDirectHint')}
      </p>
      <label className="flex items-start gap-2 text-[10px] text-muted-foreground max-w-3xl cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={targetsOnly}
          onChange={(e) => setTargetsOnly(e.target.checked)}
          disabled={busy}
        />
        <span>
          <strong className="text-foreground">{t('assetsScanImportTargetsOnly')}</strong>
          <span className="block mt-0.5">{t('assetsScanImportTargetsOnlyHint')}</span>
        </span>
      </label>

      <div
        {...getRootProps()}
        className={cn(
          'rounded-lg border border-dashed px-4 py-5 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-border hover:bg-muted/30',
          busy && 'pointer-events-none opacity-70'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-wrap items-center justify-center gap-3 text-muted-foreground">
          {busy ? (
            <Loader2 className="size-5 animate-spin text-cyan-600" />
          ) : (
            <Upload className="size-5" />
          )}
          <span className="text-xs">
            <strong className="text-foreground">{t('assetsScanImportTitle')}</strong> —{' '}
            {t('assetsScanImportHint')}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px]">
            <FileSpreadsheet className="size-3.5" /> Nessus CSV
          </span>
          <span className="inline-flex items-center gap-1 text-[10px]">
            <Network className="size-3.5" /> Nmap XML · GNMAP · TXT
          </span>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground max-w-xl mx-auto leading-snug">
          {engagementId ? t('assetsScanImportWithProject') : t('assetsScanImportNoProject')}
        </p>
      </div>

      {busy ? (
        <LongTaskProgress
          title={t('assetsScanImportProgress')}
          phase={activeFile?.name ?? '…'}
          elapsedSec={elapsedSec}
          estimatedTotalSec={estimateSec}
          hint={t('assetsScanImportProgressHint')}
        />
      ) : null}

      {notice ? <p className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
