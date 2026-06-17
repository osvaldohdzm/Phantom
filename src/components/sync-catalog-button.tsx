'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { syncFindingFromCatalog } from '@/lib/catalog-from-finding';
import type { Finding } from '@/lib/secops-api';

type SyncCatalogButtonProps = {
  finding: Finding;
  className?: string;
  label?: string;
  onSynced?: (finding: Finding) => void;
};

export function SyncCatalogButton({
  finding,
  className,
  label = 'Actualizar datos',
  onSynced,
}: SyncCatalogButtonProps) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const handleClick = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const updated = await syncFindingFromCatalog(finding);
      onSynced?.(updated);
      setNotice('Datos actualizados desde catálogo');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Error al actualizar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-stretch gap-0.5 min-w-0">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className}
        disabled={busy}
        title="Traer al hallazgo los campos guardados en el catálogo"
        onClick={(e) => {
          e.stopPropagation();
          void handleClick();
        }}
      >
        {busy ? (
          <Loader2 className="size-3 mr-1 animate-spin shrink-0" />
        ) : (
          <RefreshCw className="size-3 mr-1 shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </Button>
      {notice ? (
        <span
          className={`text-[9px] leading-tight max-w-[140px] ${
            notice.includes('Error') || notice.includes('No hay') ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {notice}
        </span>
      ) : null}
    </div>
  );
}
