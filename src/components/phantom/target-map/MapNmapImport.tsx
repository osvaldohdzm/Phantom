'use client';

import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { parseNmapFile } from '@/lib/nmap-parser';
import { mergeNmapScanIntoMap } from '@/lib/pentest-map-nmap-import';
import type { PentestTargetMapDocument } from '@/lib/pentest-target-map-schema';

type Props = {
  doc: PentestTargetMapDocument;
  onImport: (next: PentestTargetMapDocument) => void;
  label: string;
  hint: string;
  doneLabel: string;
};

export function MapNmapImport({ doc, onImport, label, hint, doneLabel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setMessage(null);
    try {
      let next = doc;
      let total = 0;
      for (const file of Array.from(files)) {
        const text = await file.text();
        const rows = parseNmapFile(text, file.name);
        total += rows.length;
        next = mergeNmapScanIntoMap(next, rows);
      }
      onImport(next);
      setMessage(`${doneLabel}: ${total}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="phantom-map-nmap-import">
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.nmap,.gnmap,.txt"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="phantom-btn w-full justify-center text-[10px]"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <FileUp className="size-3" />}
        {label}
      </button>
      <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{hint}</p>
      {message ? <p className="mt-1 text-[9px] text-emerald-600 dark:text-emerald-400">{message}</p> : null}
    </div>
  );
}
