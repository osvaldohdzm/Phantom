'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet } from 'lucide-react';
import { loadSavedExcelInspect } from '@/lib/excel-inspect-storage';

export function LastExcelIngestHint() {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSavedExcelInspect();
    if (!s) return;
    if ('summaryOnly' in s && s.summaryOnly) {
      setLine(`${s.fileName} · ${s.sheetCount} hojas (resumen)`);
    } else if ('result' in s) {
      setLine(`${s.result.fileName} · ${s.result.sheetCount} hojas`);
    }
  }, []);

  if (!line) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
      <FileSpreadsheet className="size-3.5 text-violet-400 shrink-0" />
      <span>
        Última ingesta Excel en este navegador: <span className="text-slate-300 font-mono">{line}</span>
      </span>
      <Link href="/ingesta-excel" className="text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline">
        Abrir inspector
      </Link>
    </div>
  );
}
