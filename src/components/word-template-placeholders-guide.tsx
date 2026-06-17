'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Search, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  DETALLE_PRUEBAS_SECCION,
  getAllWordPlaceholders,
  getPrincipalWordPlaceholders,
  WORD_PLACEHOLDER_CATEGORY_LABELS,
  WORD_PLACEHOLDER_CATEGORY_ORDER,
  type WordPlaceholderCategory,
  type WordPlaceholderDef,
} from '@/lib/word-template-placeholders';

const CATEGORY_STYLES: Record<WordPlaceholderCategory, string> = {
  plantilla: 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  detalle: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  hallazgo: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
  catalogo: 'border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100',
  legacy: 'border-border bg-muted/50 text-muted-foreground',
  metadato: 'border-border bg-muted/40 text-muted-foreground',
  activo: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100',
  alias: 'border-dashed border-border bg-transparent text-muted-foreground',
};

function CopyMarkerButton({ marker }: { marker: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(marker);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copiar marcador"
      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
    >
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
    </button>
  );
}

function PlaceholderChip({ item, compact }: { item: WordPlaceholderDef; compact?: boolean }) {
  return (
    <div
      className={cn(
        'group flex items-start gap-1 rounded-md border px-2 py-1.5 text-left',
        CATEGORY_STYLES[item.category]
      )}
    >
      <div className="min-w-0 flex-1">
        <code className="text-[11px] font-mono break-all leading-snug">{item.marker}</code>
        {!compact && (
          <p className="mt-0.5 text-[10px] leading-snug opacity-80">{item.label}</p>
        )}
        {!compact && item.hint && (
          <p className="mt-0.5 text-[9px] leading-snug opacity-60 italic">{item.hint}</p>
        )}
        {!item.wired && (
          <span className="mt-1 inline-block text-[9px] uppercase tracking-wide opacity-70">
            Referencia · copiar para plantilla
          </span>
        )}
      </div>
      <CopyMarkerButton marker={item.marker} />
    </div>
  );
}

function PlaceholderGrid({ items, compact }: { items: WordPlaceholderDef[]; compact?: boolean }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin coincidencias.</p>;
  }
  return (
    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <PlaceholderChip key={item.marker} item={item} compact={compact} />
      ))}
    </div>
  );
}

function SectionBlock({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-medium text-foreground">{title}</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-3 space-y-3">
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

export function WordTemplatePlaceholdersGuide() {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const principal = useMemo(() => getPrincipalWordPlaceholders(), []);
  const all = useMemo(() => getAllWordPlaceholders(), []);

  const normalizedQuery = query.trim().toLowerCase();

  const filterItems = (items: WordPlaceholderDef[]) => {
    if (!normalizedQuery) return items;
    return items.filter(
      (item) =>
        item.marker.toLowerCase().includes(normalizedQuery) ||
        item.label.toLowerCase().includes(normalizedQuery) ||
        (item.hint?.toLowerCase().includes(normalizedQuery) ?? false)
    );
  };

  const filteredPrincipal = useMemo(() => filterItems(principal), [principal, normalizedQuery]);

  const filteredAll = useMemo(() => {
    const items = filterItems(all);
    const principalMarkers = new Set(principal.map((p) => p.marker));
    return items.filter((item) => !principalMarkers.has(item.marker));
  }, [all, principal, normalizedQuery]);

  const byCategory = useMemo(() => {
    const map = new Map<WordPlaceholderCategory, WordPlaceholderDef[]>();
    for (const cat of WORD_PLACEHOLDER_CATEGORY_ORDER) {
      map.set(cat, []);
    }
    for (const item of filteredAll) {
      map.get(item.category)?.push(item);
    }
    return map;
  }, [filteredAll]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar marcador o columna…"
            className="pl-8 h-9 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className={cn(
            'text-xs px-3 py-2 rounded-md border transition-colors whitespace-nowrap',
            showAll
              ? 'border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200'
              : 'border-border text-muted-foreground hover:bg-muted/50'
          )}
        >
          {showAll ? 'Ocultar catálogo completo' : `Ver todos (${all.length})`}
        </button>
      </div>

      
      <SectionBlock
        title="Marcadores principales (plantilla CYB001)"
        description="Para plantillas de detalle por vulnerabilidad (TBL-01, Logicallis, etc.). La Tabla de hallazgos resumen se genera automática; estos marcadores van en cada tabla de detalle. Haz clic en copiar para pegarlos en Word."
        defaultOpen
      >
        <PlaceholderGrid items={filteredPrincipal} />
      </SectionBlock>


      {showAll && (
        <SectionBlock
          title="Catálogo completo de marcadores"
          description="Incluye columnas de core.vulns_catalog, hallazgos, activos y alias. Los marcados como referencia puedes usarlos en plantilla; la sustitución directa desde catálogo se ampliará en exportaciones futuras."
          defaultOpen
        >
          <div className="space-y-4">
            {WORD_PLACEHOLDER_CATEGORY_ORDER.filter((cat) => cat !== 'plantilla' && cat !== 'detalle').map(
              (cat) => {
                const items = byCategory.get(cat) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h4 className="text-xs font-medium text-foreground mb-2 flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] border',
                          CATEGORY_STYLES[cat]
                        )}
                      >
                        {WORD_PLACEHOLDER_CATEGORY_LABELS[cat]}
                      </span>
                      <span className="text-muted-foreground font-normal">({items.length})</span>
                    </h4>
                    <PlaceholderGrid items={items} compact />
                  </div>
                );
              }
            )}
          </div>
        </SectionBlock>
      )}
    </div>
  );
}
