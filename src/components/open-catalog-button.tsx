'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  catalogEditUrl,
  findingToCatalogInput,
  resolveCatalogFromFinding,
  type CatalogFromFindingInput,
} from '@/lib/catalog-from-finding';
import type { Finding } from '@/lib/secops-api';

type OpenCatalogButtonProps = {
  finding?: Finding;
  input?: CatalogFromFindingInput;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'ghost' | 'default';
  className?: string;
  label?: string;
  /** Abre el catálogo en pestaña nueva sin salir de la vista actual (por defecto: sí). */
  openInNewTab?: boolean;
  /** Solo icono, sin texto ni aviso debajo (tabla compacta). */
  compact?: boolean;
  onResolved?: (catalogId: string, created: boolean) => void;
};

export function OpenCatalogButton({
  finding,
  input,
  size = 'sm',
  variant = 'outline',
  className,
  label,
  openInNewTab = true,
  compact = false,
  onResolved,
}: OpenCatalogButtonProps) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const payload = input ?? (finding ? findingToCatalogInput(finding) : null);

  const handleClick = async () => {
    if (!payload) return;
    setBusy(true);
    setNotice(null);
    try {
      const { row, created } = await resolveCatalogFromFinding(payload);
      const id = String(row.Id ?? '');
      if (!id) throw new Error('El catálogo no devolvió un Id válido');
      onResolved?.(id, created);
      const url = catalogEditUrl(id, finding?.id, finding?.engagement_id ?? undefined);
      if (openInNewTab) {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (!opened) {
          setNotice('Permite ventanas emergentes o abre manualmente el catálogo');
        } else {
          setNotice(created ? 'Catálogo abierto en nueva pestaña (creado)' : 'Catálogo abierto en nueva pestaña');
        }
      } else {
        window.location.assign(url);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Error al abrir catálogo');
    } finally {
      setBusy(false);
    }
  };

  if (!payload) return null;

  const title = openInNewTab ? 'Abrir catálogo en nueva pestaña' : 'Abrir catálogo';

  return (
    <div className={compact ? 'inline-flex' : 'inline-flex flex-col items-start gap-1'}>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        disabled={busy}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          void handleClick();
        }}
      >
        {busy ? (
          <Loader2 className={compact ? 'size-3.5 animate-spin' : 'size-3.5 mr-1.5 animate-spin'} />
        ) : openInNewTab ? (
          <ExternalLink className={compact ? 'size-3.5' : 'size-3.5 mr-1.5'} />
        ) : (
          <BookOpen className={compact ? 'size-3.5' : 'size-3.5 mr-1.5'} />
        )}
        {compact ? <span className="sr-only">{label ?? 'Catálogo'}</span> : (label ?? 'Editar en catálogo')}
      </Button>
      {!compact && notice ? (
        <span className={`text-[10px] ${notice.includes('Error') ? 'text-rose-400' : 'text-emerald-400'}`}>
          {notice}
        </span>
      ) : null}
    </div>
  );
}
