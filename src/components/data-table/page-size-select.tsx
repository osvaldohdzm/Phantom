'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  pageSizeLabel,
  type FindingsPageSizeOption,
  type FindingsUiPageSize,
} from '@/lib/secops-api';

const ROW_PX = 44;
const GAP_PX = 8;

export type PageSizeSelectProps = {
  value: FindingsUiPageSize;
  options: readonly FindingsPageSizeOption[];
  onChange: (size: FindingsUiPageSize) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export function PageSizeSelect({
  value,
  options,
  onChange,
  disabled,
  label = 'Filas por página',
  className,
}: PageSizeSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => setMounted(true), []);

  const updateMenuPosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const listHeight = options.length * ROW_PX + 2;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < listHeight + GAP_PX && spaceAbove > spaceBelow;

    setMenuPos({
      left: rect.left,
      width: Math.max(rect.width, 96),
      top: openUp ? rect.top - listHeight - GAP_PX : rect.bottom + GAP_PX,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu =
    open && menuPos && mounted ? (
      <ul
        ref={menuRef}
        id={listId}
        role="listbox"
        aria-label={label}
        style={{
          position: 'fixed',
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 9999,
        }}
        className={cn(
          'overflow-hidden rounded-xl border border-border',
          'bg-popover text-popover-foreground shadow-lg',
          'animate-in fade-in-0 zoom-in-95 duration-150'
        )}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <li key={String(opt.value)} role="option" aria-selected={selected}>
              <button
                type="button"
                className={cn(
                  'flex w-full min-h-11 items-center gap-3 px-4 text-sm transition-colors',
                  'hover:bg-muted/80 focus-visible:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  selected ? 'bg-muted/60 text-foreground font-medium' : 'text-foreground/90'
                )}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn('size-4 shrink-0', selected ? 'opacity-100 text-primary' : 'opacity-0')}
                />
                <span className={opt.value === 'all' ? '' : 'tabular-nums'}>{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <span className="type-small text-muted-foreground mr-2 hidden sm:inline">{label}</span>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2',
          'text-sm font-medium text-foreground shadow-sm transition-colors',
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
          'disabled:opacity-50 disabled:pointer-events-none min-w-[5.5rem]',
          open && 'ring-2 ring-ring/30'
        )}
      >
        <span className={value === 'all' ? '' : 'tabular-nums'}>{pageSizeLabel(value)}</span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}
