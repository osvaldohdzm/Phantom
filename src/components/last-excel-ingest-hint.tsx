'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import { loadSavedExcelInspect } from '@/lib/excel-inspect-storage';
import { useUiT } from '@/lib/use-ui-locale';

export function LastExcelIngestHint() {
  const { t } = useUiT();
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSavedExcelInspect();
    if (!s) return;
    if ('summaryOnly' in s && s.summaryOnly) {
      setLine(`${s.fileName} · ${s.sheetCount} ${t('dashExcelSheets')} (${t('dashExcelSummary')})`);
    } else if ('result' in s) {
      setLine(`${s.result.fileName} · ${s.result.sheetCount} ${t('dashExcelSheets')}`);
    }
  }, [t]);

  if (!line) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <FileSpreadsheet className="size-3.5 text-violet-400 shrink-0" />
      <span>
        {t('dashExcelHint')}{' '}
        <span className="text-slate-300 font-mono">{line}</span>
      </span>
      <Link href="/ingesta-excel" className="text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline">
        {t('dashExcelOpenInspector')}
      </Link>
    </div>
  );
}
