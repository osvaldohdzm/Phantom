'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  deleteEvidence,
  evidenceFileUrl,
  listEvidence,
  uploadEvidence,
  type EvidenceAttachment,
} from '@/lib/secops-api';

type PendingImage = { id: string; file: File; preview: string };

export function FindingEvidencePanel({
  findingId,
  pendingImages,
  onPendingChange,
}: {
  findingId?: string;
  pendingImages?: PendingImage[];
  onPendingChange?: (images: PendingImage[]) => void;
}) {
  const [attachments, setAttachments] = useState<EvidenceAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPending, setLocalPending] = useState<PendingImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const pending = pendingImages ?? localPending;

  const setPending = useCallback(
    (action: React.SetStateAction<PendingImage[]>) => {
      const apply = (current: PendingImage[]) =>
        typeof action === 'function' ? action(current) : action;
      if (onPendingChange) {
        onPendingChange(apply(pendingImages ?? []));
      } else {
        setLocalPending(apply);
      }
    },
    [onPendingChange, pendingImages]
  );

  const load = useCallback(async () => {
    if (!findingId) return;
    setLoading(true);
    try {
      setAttachments(await listEvidence(findingId));
    } catch {
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [findingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (!images.length) return;
      const newPending = images.map((file) => ({
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
      }));
      setPending((prev) => [...prev, ...newPending]);
    },
    [setPending]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles]
  );

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const uploadPending = async () => {
    if (!findingId || !pending.length) return;
    setUploading(true);
    try {
      for (const p of pending) {
        await uploadEvidence(findingId, p.file, 'screenshot');
        URL.revokeObjectURL(p.preview);
      }
      setPending([]);
      await load();
    } finally {
      setUploading(false);
    }
  };

  const removePending = (id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleDeleteSaved = async (evidenceId: string) => {
    if (!findingId) return;
    await deleteEvidence(findingId, evidenceId);
    await load();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Las capturas aquí son solo para archivo interno; no se exportan al informe Word.
      </p>
      <div
        className={cn(
          'rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition-colors',
          'hover:border-violet-500/40 hover:bg-violet-500/5 cursor-pointer'
        )}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <ImagePlus className="size-8 text-violet-400 mx-auto mb-2" />
        <p className="text-sm text-foreground font-medium">Pegar o subir evidencia</p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
          <ClipboardPaste className="size-3" />
          Ctrl+V captura de pantalla · clic para elegir archivos
        </p>
      </div>

      {(pending.length > 0 || attachments.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {pending.map((p) => (
            <div key={p.id} className="relative group rounded-lg overflow-hidden border border-amber-500/30 bg-muted/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="Evidencia pendiente" className="w-full h-28 object-cover" />
              <span className="absolute top-1 left-1 text-[9px] bg-amber-500/80 text-black px-1 rounded">Pendiente</span>
              <button
                type="button"
                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-rose-300 opacity-0 group-hover:opacity-100"
                onClick={() => removePending(p.id)}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {attachments.map((a) => (
            <div key={a.id} className="relative group rounded-lg overflow-hidden border border-border bg-muted/50">
              {a.mime_type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={evidenceFileUrl(findingId!, a.id)} alt={a.filename} className="w-full h-28 object-cover" />
              ) : (
                <div className="h-28 flex items-center justify-center text-xs text-muted-foreground p-2">{a.filename}</div>
              )}
              <button
                type="button"
                className="absolute top-1 right-1 p-1 rounded bg-black/60 text-rose-300 opacity-0 group-hover:opacity-100"
                onClick={() => void handleDeleteSaved(a.id)}
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {findingId && pending.length > 0 && (
        <Button type="button" size="sm" onClick={() => void uploadPending()} disabled={uploading}>
          {uploading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <ImagePlus className="size-3.5 mr-1.5" />}
          Subir {pending.length} imagen(es) al hallazgo
        </Button>
      )}

      {!findingId && pending.length > 0 && (
        <p className="text-xs text-amber-400/90">Las imágenes se subirán al guardar el reporte.</p>
      )}

      {loading && findingId && <p className="text-xs text-muted-foreground">Cargando evidencias…</p>}
    </div>
  );
}

export type { PendingImage };
