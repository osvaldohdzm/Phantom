'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyTsvToClipboard } from '@/lib/clipboard-tsv';
import { cn } from '@/lib/utils';

type CopyableDataTableProps = {
  caption?: string;
  tsvRows: (string | number | null | undefined)[][];
  className?: string;
  children: React.ReactNode;
};

export function CopyableDataTable({ caption, tsvRows, className, children }: CopyableDataTableProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await copyTsvToClipboard(tsvRows);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        {caption ? <p className="text-[10px] text-muted-foreground">{caption}</p> : <span />}
        <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] shrink-0" onClick={onCopy}>
          {copied ? <Check className="size-3 mr-1 text-emerald-600" /> : <Copy className="size-3 mr-1" />}
          {copied ? 'Copiado' : 'Copiar tabla'}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-xs border-collapse select-text text-foreground">{children}</table>
      </div>
    </div>
  );
}
