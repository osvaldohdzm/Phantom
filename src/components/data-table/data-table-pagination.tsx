'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRecordRange, totalPages as calcTotalPages } from '@/lib/data-table-pagination';
import { PageSizeSelect } from '@/components/data-table/page-size-select';
import { isAllPageSize, type FindingsPageSizeOption, type FindingsUiPageSize } from '@/lib/secops-api';

const navBtnClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-card';

export type DataTablePaginationProps = {
  page: number;
  pageSize: FindingsUiPageSize;
  total: number;
  pageSizeOptions: readonly FindingsPageSizeOption[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: FindingsUiPageSize) => void;
  loading?: boolean;
  className?: string;
};

export function DataTablePagination({
  page,
  pageSize,
  total,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  loading,
  className,
}: DataTablePaginationProps) {
  const pages = calcTotalPages(total, pageSize);
  const safePage = Math.max(1, Math.min(page, pages));
  const singlePage = isAllPageSize(pageSize) || pages <= 1;
  const atStart = singlePage || safePage <= 1;
  const atEnd = singlePage || safePage >= pages;

  return (
    <div
      className={cn(
        'relative z-20 flex flex-col gap-3 border-t border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <PageSizeSelect
            value={pageSize}
            options={pageSizeOptions}
            onChange={onPageSizeChange}
            disabled={loading}
          />
        ) : null}
        <p className="type-small text-muted-foreground tabular-nums flex items-center gap-2">
          {loading ? <Loader2 className="size-4 animate-spin text-primary" /> : null}
          {formatRecordRange(safePage, pageSize, total)}
        </p>
      </div>

      <nav
        className="flex items-center justify-end gap-1.5"
        aria-label="Paginación de tabla"
      >
        <button
          type="button"
          className={navBtnClass}
          disabled={atStart || loading}
          aria-label="Primera página"
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="size-4" />
        </button>
        <button
          type="button"
          className={navBtnClass}
          disabled={atStart || loading}
          aria-label="Página anterior"
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="hidden sm:inline type-small text-muted-foreground px-2 tabular-nums min-w-[4.5rem] text-center">
          {safePage} / {pages}
        </span>
        <button
          type="button"
          className={navBtnClass}
          disabled={atEnd || loading}
          aria-label="Página siguiente"
          onClick={() => onPageChange(safePage + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          className={navBtnClass}
          disabled={atEnd || loading}
          aria-label="Última página"
          onClick={() => onPageChange(pages)}
        >
          <ChevronsRight className="size-4" />
        </button>
      </nav>
    </div>
  );
}
