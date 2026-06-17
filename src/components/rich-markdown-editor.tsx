'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Bold,
  Heading2,
  Image as ImageIcon,
  List,
  Eye,
  Pencil,
  Loader2,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type RichMarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  aiGlow?: boolean;
  /** full: headings, lists, bold, images. minimal: bold + images only. */
  variant?: 'full' | 'minimal';
  /** Default alt text when pasting images (e.g. finding title). */
  defaultImageCaption?: string;
};

/** Convierte markdown básico + imágenes a HTML seguro para vista previa */
export function markdownToPreviewHtml(md: string, variant: 'full' | 'minimal' = 'full'): string {
  if (!md.trim()) return '';

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  const inlineFormat = (text: string) => {
    let t = escape(text);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    if (variant === 'full') {
      t = t.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-muted text-violet-600 dark:text-violet-300 text-xs">$1</code>');
    }
    t = t.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_m, alt, src) =>
        `<figure class="my-4 flex flex-col items-center"><img src="${src}" alt="${escape(alt)}" class="max-w-full rounded-lg border border-border shadow-sm" /><figcaption class="text-[10px] text-muted-foreground mt-1.5 text-center">${escape(alt || 'Evidencia')}</figcaption></figure>`
    );
    return t;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    if (variant === 'full') {
      if (trimmed.startsWith('## ')) {
        closeList();
        out.push(`<h3 class="text-sm font-bold text-violet-600 dark:text-violet-200 mt-4 mb-2">${inlineFormat(trimmed.slice(3))}</h3>`);
        continue;
      }
      if (trimmed.startsWith('# ')) {
        closeList();
        out.push(`<h2 class="text-base font-bold text-foreground mt-4 mb-2">${inlineFormat(trimmed.slice(2))}</h2>`);
        continue;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          out.push('<ul class="list-disc pl-5 space-y-1 my-2">');
          inList = true;
        }
        out.push(`<li class="text-foreground/90">${inlineFormat(trimmed.slice(2))}</li>`);
        continue;
      }
    }

    if (/^!\[/.test(trimmed)) {
      closeList();
      out.push(`<div class="my-3">${inlineFormat(trimmed)}</div>`);
      continue;
    }

    closeList();
    out.push(`<p class="text-foreground/90 leading-relaxed mb-2 text-justify">${inlineFormat(trimmed)}</p>`);
  }

  closeList();
  return out.join('\n');
}

function insertAtCursor(textarea: HTMLTextAreaElement, before: string, after = '') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  const next = textarea.value.slice(0, start) + before + selected + after + textarea.value.slice(end);
  const pos = start + before.length + selected.length + after.length;
  return { next, pos };
}

export function RichMarkdownEditor({
  value,
  onChange,
  placeholder = 'Detalle técnico con markdown…',
  rows = 8,
  disabled,
  aiGlow,
  variant = 'full',
  defaultImageCaption,
}: RichMarkdownEditorProps) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [pasting, setPasting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMinimal = variant === 'minimal';

  const wrapSelection = (before: string, after = before) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { next, pos } = insertAtCursor(ta, before, after);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const insertLine = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => ta.focus());
  };

  const insertImageSnippet = useCallback(
    (alt: string) => {
      const ta = textareaRef.current;
      const snippet = `\n\n![${alt}](`;
      if (ta) {
        const start = ta.selectionStart;
        const next = value.slice(0, start) + snippet + ')' + value.slice(start);
        onChange(next);
        requestAnimationFrame(() => {
          ta.focus();
          const pos = start + snippet.length;
          ta.setSelectionRange(pos, pos);
        });
      } else {
        onChange(value + snippet + ')');
      }
    },
    [onChange, value]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (!item.type.startsWith('image/')) continue;
        e.preventDefault();
        setPasting(true);
        try {
          const file = item.getAsFile();
          if (!file) continue;
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const ta = textareaRef.current;
          const alt = defaultImageCaption?.trim() || 'Evidencia';
          const snippet = `\n\n![${alt}](${dataUrl})\n\n`;
          if (ta) {
            const start = ta.selectionStart;
            const next = value.slice(0, start) + snippet + value.slice(start);
            onChange(next);
          } else {
            onChange(value + snippet);
          }
        } finally {
          setPasting(false);
        }
        break;
      }
    },
    [onChange, value, defaultImageCaption]
  );

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden bg-card',
        aiGlow ? 'border-violet-500/50 shadow-[0_0_12px_rgba(139,92,246,0.2)]' : 'border-border'
      )}
    >
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-muted/40 border-b border-border">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={disabled}
          onClick={() => wrapSelection('**', '**')}
          title="Negrita"
        >
          <Bold className="size-3.5" />
        </Button>
        {!isMinimal && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={disabled}
              onClick={() => insertLine('## ')}
              title="Subtítulo"
            >
              <Heading2 className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={disabled}
              onClick={() => insertLine('- ')}
              title="Lista"
            >
              <List className="size-3.5" />
            </Button>
          </>
        )}
        {defaultImageCaption?.trim() && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            disabled={disabled}
            onClick={() => insertImageSnippet(defaultImageCaption.trim())}
            title={`Insertar imagen con pie «${defaultImageCaption.trim()}»`}
          >
            <Type className="size-3.5" />
          </Button>
        )}
        <span className="text-[10px] text-muted-foreground/60 px-1 hidden sm:inline">|</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          {pasting ? <Loader2 className="size-3 animate-spin" /> : <ImageIcon className="size-3" />}
          Ctrl+V imagen
        </span>
        <div className="ml-auto flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7 px-2 text-xs', mode === 'edit' && 'bg-muted text-foreground')}
            onClick={() => setMode('edit')}
          >
            <Pencil className="size-3 mr-1" />
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('h-7 px-2 text-xs', mode === 'preview' && 'bg-muted text-foreground')}
            onClick={() => setMode('preview')}
          >
            <Eye className="size-3 mr-1" />
            Vista previa
          </Button>
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          className="w-full bg-background text-sm text-foreground px-3 py-2.5 font-mono text-xs leading-relaxed resize-y min-h-[160px] focus:outline-none focus:ring-2 focus:ring-violet-500/30 placeholder:text-muted-foreground"
        />
      ) : (
        <div
          className="min-h-[160px] max-h-[480px] overflow-y-auto px-4 py-3 bg-background/80"
          dangerouslySetInnerHTML={{
            __html: value.trim()
              ? markdownToPreviewHtml(value, variant)
              : '<p class="text-muted-foreground text-sm italic">Sin contenido — escribe markdown o pega capturas en modo Editar.</p>',
          }}
        />
      )}
    </div>
  );
}
