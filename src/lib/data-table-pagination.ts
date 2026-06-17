import {
  FINDINGS_UI_PAGE_SIZE_ALL,
  type FindingsUiPageSize,
} from '@/lib/secops-api';

export type TablePageSize = FindingsUiPageSize;

function isTableAllPageSize(size: TablePageSize): size is typeof FINDINGS_UI_PAGE_SIZE_ALL {
  return size === FINDINGS_UI_PAGE_SIZE_ALL;
}

export function formatRecordRange(
  page: number,
  pageSize: TablePageSize,
  total: number,
  locale = 'es-MX'
): string {
  if (total === 0) return '0 registros';
  const nf = new Intl.NumberFormat(locale);
  if (isTableAllPageSize(pageSize)) {
    return `${nf.format(1)}–${nf.format(total)} de ${nf.format(total)} registros`;
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `${nf.format(start)}–${nf.format(end)} de ${nf.format(total)} registros`;
}

export function totalPages(total: number, pageSize: TablePageSize): number {
  if (isTableAllPageSize(pageSize)) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, total: number, pageSize: TablePageSize): number {
  return Math.max(1, Math.min(page, totalPages(total, pageSize)));
}

/** Activa virtualización en páginas de 500+ filas o en modo «Todos» con 100+. */
export const VIRTUAL_SCROLL_THRESHOLD = 500;
export const VIRTUAL_SCROLL_THRESHOLD_ALL = 100;

export function virtualScrollThreshold(pageSize: TablePageSize): number {
  return isTableAllPageSize(pageSize) ? VIRTUAL_SCROLL_THRESHOLD_ALL : VIRTUAL_SCROLL_THRESHOLD;
}

export const TABLE_DENSITY_KEY = 'spectre.table.density';

export type TableDensity = 'compact' | 'comfortable';

export const ROW_HEIGHT_PX: Record<TableDensity, number> = {
  compact: 44,
  comfortable: 52,
};

export function loadTableDensity(): TableDensity {
  if (typeof window === 'undefined') return 'compact';
  try {
    const v = localStorage.getItem(TABLE_DENSITY_KEY);
    return v === 'comfortable' ? 'comfortable' : 'compact';
  } catch {
    return 'compact';
  }
}

export function saveTableDensity(density: TableDensity): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TABLE_DENSITY_KEY, density);
}
