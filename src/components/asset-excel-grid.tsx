'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { ChevronLeft, ChevronRight, Eraser, GripVertical, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVirtualRows } from '@/components/data-table/use-virtual-rows';
import type { AssetGridColumn } from '@/lib/asset-spreadsheet-columns';
import { cloneRow, type AssetGridRow } from '@/lib/asset-row-utils';
import { SeverityBadge } from '@/components/severity-badge';
import { FindingStatusBadge } from '@/components/finding-status-badge';
import {
  loadMatrixSeverityOptions,
  loadMatrixStatusOptions,
  normalizeSeverityValue,
} from '@/lib/matrix-field-options';
import { alignPasteByHeaders, parseClipboardFromDataTransfer } from '@/lib/parse-clipboard-table';
import {
  canReorderColumn,
  clampColumnWidth,
  createCustomColumn,
  minMovableColumnIndex,
  moveColumn,
  moveColumnByStep,
  moveColumnToEdge,
  setColumnWidth,
} from '@/lib/asset-grid-column-layout';

const ROW_HEIGHT = 28;
const VIRTUALIZE_THRESHOLD = 15;
const ROW_NUM_WIDTH = 52;

type CellPos = { row: number; col: number };
type CellRange = { r1: number; r2: number; c1: number; c2: number };

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function validateCell(value: string, col: AssetGridColumn): boolean {
  if (!value.trim()) return true;
  switch (col.type) {
    case 'number':
      return /^-?\d*(\.\d+)?$/.test(value.trim());
    case 'date':
      return /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(value.trim()) || !Number.isNaN(Date.parse(value));
    case 'boolean':
      return ['true', 'false', '1', '0', 'sí', 'si', 'no', 'yes', ''].includes(value.trim().toLowerCase());
    default:
      return true;
  }
}

function isEditableCol(columns: AssetGridColumn[], colIdx: number) {
  const col = columns[colIdx];
  return Boolean(col && col.type !== 'readonly' && col.key !== 'id');
}

function normalizeRange(a: CellPos, b: CellPos): CellRange {
  return {
    r1: Math.min(a.row, b.row),
    r2: Math.max(a.row, b.row),
    c1: Math.min(a.col, b.col),
    c2: Math.max(a.col, b.col),
  };
}

function emptyRow(columns: AssetGridColumn[]): AssetGridRow {
  const row: AssetGridRow = {};
  for (const col of columns) row[col.key] = '';
  return row;
}

function rowPersistId(row: AssetGridRow): string | undefined {
  const id = row.__id ?? row.id;
  return id?.trim() || undefined;
}

/** Scroll only the minimum delta so the active cell stays visible (Excel-like). */
function scrollActiveCellIntoView(container: HTMLElement, rowNumWidth: number): boolean {
  const cell = container.querySelector('td[data-active="true"]');
  if (!(cell instanceof HTMLElement)) return false;

  const headerHeight = ROW_HEIGHT;
  const cellRect = cell.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const visibleTop = containerRect.top + headerHeight;
  const visibleBottom = containerRect.bottom;
  const visibleLeft = containerRect.left + rowNumWidth;
  const visibleRight = containerRect.right;

  if (cellRect.top < visibleTop) {
    container.scrollTop -= visibleTop - cellRect.top;
  } else if (cellRect.bottom > visibleBottom) {
    container.scrollTop += cellRect.bottom - visibleBottom;
  }

  if (cellRect.left < visibleLeft) {
    container.scrollLeft -= visibleLeft - cellRect.left;
  } else if (cellRect.right > visibleRight) {
    container.scrollLeft += cellRect.right - visibleRight;
  }

  return true;
}

function scrollRowIntoViewByIndex(container: HTMLElement, row: number) {
  const top = row * ROW_HEIGHT;
  const bottom = top + ROW_HEIGHT;
  const headerHeight = ROW_HEIGHT;
  const viewTop = container.scrollTop;
  const viewBottom = viewTop + container.clientHeight;

  if (top < viewTop + headerHeight) {
    container.scrollTop = Math.max(0, top - headerHeight);
  } else if (bottom > viewBottom) {
    container.scrollTop = bottom - container.clientHeight;
  }
}

/** Fast bulk paste: only clones touched rows, keeps tail references intact. */
function pasteIntoRows(
  prev: AssetGridRow[],
  matrix: string[][],
  startRow: number,
  keysPerMatrixCol: string[],
  emptyTemplate: AssetGridRow
): AssetGridRow[] {
  const endRow = startRow + matrix.length;
  const nextLen = Math.max(prev.length, endRow);
  const next = new Array<AssetGridRow>(nextLen);

  for (let i = 0; i < startRow; i++) next[i] = prev[i];

  for (let ri = 0; ri < matrix.length; ri += 1) {
    const rowIdx = startRow + ri;
    const line = matrix[ri];
    const base = prev[rowIdx];
    const row: AssetGridRow = base ? { ...base } : { ...emptyTemplate };
    const limit = Math.min(line.length, keysPerMatrixCol.length);
    for (let ci = 0; ci < limit; ci += 1) {
      const key = keysPerMatrixCol[ci];
      if (key) row[key] = line[ci];
    }
    next[rowIdx] = row;
  }

  for (let i = endRow; i < prev.length; i += 1) next[i] = prev[i];

  return next;
}

type Props = {
  columns: AssetGridColumn[];
  rows: AssetGridRow[];
  onRowsChange: (rows: AssetGridRow[]) => void;
  onSave: (dirtyRows: AssetGridRow[], deletedIds: string[]) => Promise<void>;
  onColumnsChange?: (columns: AssetGridColumn[]) => void;
  loading?: boolean;
  /** Hallazgos: sin alta/baja de filas ni limpiar tabla. */
  allowRowMutations?: boolean;
  allowRowInsert?: boolean;
  allowRowDelete?: boolean;
  allowClearTable?: boolean;
  allowColumnInsert?: boolean;
  allowColumnDelete?: boolean;
  isColumnDeletable?: (col: AssetGridColumn) => boolean;
  onActiveCellChange?: (pos: { row: number; col: number }) => void;
  /** Rango de filas/columnas seleccionado (p. ej. acciones masivas en matriz). */
  onSelectionChange?: (range: CellRange) => void;
  /** Cabecera personalizada (orden/filtro); el resize sigue en el borde derecho. */
  renderColumnHeader?: (col: AssetGridColumn, columnIndex: number) => ReactNode;
};

const GridCell = memo(function GridCell({
  value,
  selected,
  active,
  invalid,
  readonly,
  editing,
  editValue,
  col,
  width,
  onEditChange,
  onCommit,
  inputRef,
  onMouseDown,
  onMouseEnter,
  onDoubleClick,
}: {
  value: string;
  selected: boolean;
  active: boolean;
  invalid: boolean;
  readonly: boolean;
  editing: boolean;
  editValue: string;
  col: AssetGridColumn;
  width: number;
  onEditChange: (v: string) => void;
  onCommit: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onMouseDown: (e: ReactMouseEvent) => void;
  onMouseEnter: () => void;
  onDoubleClick: () => void;
}) {
  const isPickList =
    col.type === 'select' || col.type === 'severity' || col.type === 'status';
  const pickOptions =
    col.type === 'severity'
      ? loadMatrixSeverityOptions()
      : col.type === 'status'
        ? loadMatrixStatusOptions()
        : (col.options ?? []).map((o) => ({ value: o, label: o }));

  const displayNode = (() => {
    if (col.type === 'severity' && value.trim()) {
      const sev = normalizeSeverityValue(value);
      if (sev) return <SeverityBadge severity={sev} compact />;
    }
    if (col.type === 'status' && value.trim()) {
      return <FindingStatusBadge label={value} compact />;
    }
    return null;
  })();

  return (
    <td
      data-active={active ? 'true' : undefined}
      className={[
        'border border-border p-0 relative select-none',
        selected ? 'bg-violet-500/15' : '',
        active ? 'ring-2 ring-violet-500 ring-inset z-[1]' : '',
        invalid ? 'bg-rose-500/20' : '',
        readonly ? 'bg-muted/50 text-muted-foreground' : '',
      ].join(' ')}
      style={{ width, minWidth: width, maxWidth: width, height: ROW_HEIGHT }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onDoubleClick}
    >
      {active && editing && !readonly ? (
        isPickList ? (
          <select
            className="w-full h-full px-1 bg-background text-xs border-0 outline-none font-mono"
            value={editValue}
            autoFocus
            onChange={(e) => {
              onEditChange(e.target.value);
              window.setTimeout(() => onCommit(), 0);
            }}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onCommit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCommit();
              }
            }}
          >
            <option value="">—</option>
            {pickOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            className="w-full h-full px-1.5 bg-background text-xs border-0 outline-none font-mono"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onBlur={onCommit}
          />
        )
      ) : (
        <div className="px-1.5 py-0.5 truncate leading-5 flex items-center min-h-[22px]" title={value}>
          {displayNode ?? (value || '\u00a0')}
        </div>
      )}
    </td>
  );
});

type GridRowProps = {
  row: AssetGridRow;
  r: number;
  columns: AssetGridColumn[];
  columnWidths: number[];
  selR1: number;
  selR2: number;
  selC1: number;
  selC2: number;
  activeRow: number;
  activeCol: number;
  editing: boolean;
  editValue: string;
  invalidCols: ReadonlySet<number> | undefined;
  showRowAction: boolean;
  rowCount: number;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  onEditChange: (v: string) => void;
  onCommit: () => void;
  onCellMouseDown: (r: number, c: number, e: ReactMouseEvent) => void;
  onCellMouseEnter: (r: number, c: number) => void;
  onStartEdit: (r: number, c: number) => void;
  onSelectRow: (r: number, shiftKey: boolean) => void;
  onDeleteRows: () => void;
};

const AssetGridRow = memo(function AssetGridRow({
  row,
  r,
  columns,
  columnWidths,
  selR1,
  selR2,
  selC1,
  selC2,
  activeRow,
  activeCol,
  editing,
  editValue,
  invalidCols,
  showRowAction,
  rowCount,
  editInputRef,
  onEditChange,
  onCommit,
  onCellMouseDown,
  onCellMouseEnter,
  onStartEdit,
  onSelectRow,
  onDeleteRows,
}: GridRowProps) {
  const rowInSelection = r >= selR1 && r <= selR2;

  return (
    <tr style={{ height: ROW_HEIGHT }}>
      <td
        className="border border-border px-0.5 text-center text-muted-foreground bg-muted/40 sticky left-0 z-[1] cursor-pointer hover:bg-muted select-none relative"
        onMouseDown={(e) => {
          e.preventDefault();
          onSelectRow(r, e.shiftKey);
        }}
        title="Clic: fila · Shift+clic: extender · Ctrl+Shift+↓: rango"
      >
        <div className="flex items-center justify-center gap-0.5 min-w-[2rem]">
          {showRowAction ? (
            <button
              type="button"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded text-rose-600 hover:bg-rose-500/15 dark:text-rose-400"
              title={`Eliminar ${rowCount} fila(s)`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRows();
              }}
            >
              <Trash2 className="size-3" />
            </button>
          ) : (
            <span className="inline-block w-5" aria-hidden />
          )}
          <span className="tabular-nums text-[10px]">{r + 1}</span>
        </div>
      </td>
      {columns.map((col, c) => {
        const selected = rowInSelection && c >= selC1 && c <= selC2;
        const isActive = activeRow === r && activeCol === c;
        return (
          <GridCell
            key={col.key}
            value={row[col.key] ?? ''}
            selected={selected}
            active={isActive}
            invalid={invalidCols?.has(c) ?? false}
            readonly={col.type === 'readonly' || col.key === 'id'}
            editing={editing && isActive}
            editValue={editValue}
            col={col}
            width={columnWidths[c] ?? 120}
            inputRef={editInputRef}
            onEditChange={onEditChange}
            onCommit={onCommit}
            onMouseDown={(e) => onCellMouseDown(r, c, e)}
            onMouseEnter={() => onCellMouseEnter(r, c)}
            onDoubleClick={() => onStartEdit(r, c)}
          />
        );
      })}
    </tr>
  );
}, (prev, next) => {
  if (prev.row !== next.row || prev.r !== next.r) return false;
  if (prev.columnWidths !== next.columnWidths) return false;
  if (prev.showRowAction !== next.showRowAction || prev.rowCount !== next.rowCount) return false;

  const prevInSel = prev.r >= prev.selR1 && prev.r <= prev.selR2;
  const nextInSel = next.r >= next.selR1 && next.r <= next.selR2;
  if (prevInSel !== nextInSel) return false;
  if (prevInSel && (prev.selC1 !== next.selC1 || prev.selC2 !== next.selC2)) return false;
  if (prev.selR1 !== next.selR1 || prev.selR2 !== next.selR2) {
    const touched =
      (prev.r >= prev.selR1 && prev.r <= prev.selR2) ||
      (prev.r >= next.selR1 && prev.r <= next.selR2);
    if (touched) return false;
  }

  const prevActive = prev.r === prev.activeRow;
  const nextActive = next.r === next.activeRow;
  if (prevActive !== nextActive) return false;
  if (prevActive) {
    if (
      prev.activeCol !== next.activeCol ||
      prev.editing !== next.editing ||
      prev.editValue !== next.editValue
    ) {
      return false;
    }
  }

  if (prev.invalidCols !== next.invalidCols) return false;
  return true;
});

export function AssetExcelGrid({
  columns,
  rows,
  onRowsChange,
  onSave,
  onColumnsChange,
  loading,
  allowRowMutations = true,
  allowRowInsert = allowRowMutations,
  allowRowDelete = allowRowMutations,
  allowClearTable = allowRowMutations,
  allowColumnInsert = Boolean(onColumnsChange),
  allowColumnDelete = Boolean(onColumnsChange),
  isColumnDeletable = (col) => col.key.startsWith('custom_'),
  onActiveCellChange,
  onSelectionChange,
  renderColumnHeader,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const dragRef = useRef(false);
  const dragColRef = useRef<number | null>(null);
  const dragOverColRef = useRef<number | null>(null);
  const dragPointerXRef = useRef(0);
  const dragScrollRafRef = useRef(0);
  const resizeRafRef = useRef(0);
  const dragActiveRafRef = useRef(0);
  const pendingDragCellRef = useRef<CellPos | null>(null);

  const emptyTemplate = useMemo(() => emptyRow(columns), [columns]);
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});

  const [active, setActive] = useState<CellPos>({ row: 0, col: 0 });

  useEffect(() => {
    onActiveCellChange?.(active);
  }, [active, onActiveCellChange]);
  const [anchor, setAnchor] = useState<CellPos | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [originalRows, setOriginalRows] = useState<AssetGridRow[]>([]);
  const [undoStack, setUndoStack] = useState<AssetGridRow[][]>([]);
  const [pasteHint, setPasteHint] = useState<string | null>(null);
  const [columnDragUi, setColumnDragUi] = useState<{ from: number | null; over: number | null }>({
    from: null,
    over: null,
  });

  const editableColIndexes = useMemo(
    () => columns.map((c, i) => (isEditableCol(columns, i) ? i : -1)).filter((i) => i >= 0),
    [columns]
  );

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const lastNotifiedSelectionRef = useRef<CellRange | null>(null);

  const columnSignature = useMemo(() => columns.map((c) => c.key).join('|'), [columns]);

  useEffect(() => {
    setOriginalRows(rows.map(cloneRow));
    setDeletedIds([]);
    setUndoStack([]);
    setAnchor(null);
    setActive({ row: 0, col: editableColIndexes[0] ?? 0 });
    lastNotifiedSelectionRef.current = null;
  }, [columnSignature, editableColIndexes]);

  const selectionRange = useMemo<CellRange>(() => {
    if (anchor) return normalizeRange(anchor, active);
    return { r1: active.row, r2: active.row, c1: active.col, c2: active.col };
  }, [active, anchor]);

  useEffect(() => {
    const prev = lastNotifiedSelectionRef.current;
    if (
      prev &&
      prev.r1 === selectionRange.r1 &&
      prev.r2 === selectionRange.r2 &&
      prev.c1 === selectionRange.c1 &&
      prev.c2 === selectionRange.c2
    ) {
      return;
    }
    lastNotifiedSelectionRef.current = selectionRange;
    onSelectionChangeRef.current?.(selectionRange);
  }, [selectionRange]);

  const selectionMeta = useMemo(() => {
    const rowCount = selectionRange.r2 - selectionRange.r1 + 1;
    const colCount = selectionRange.c2 - selectionRange.c1 + 1;
    const firstEditable = editableColIndexes[0] ?? 0;
    const lastEditable = editableColIndexes[editableColIndexes.length - 1] ?? columns.length - 1;
    const isFullRowSelection =
      editableColIndexes.length > 0 &&
      selectionRange.c1 <= firstEditable &&
      selectionRange.c2 >= lastEditable;
    const isFullColumnSelection =
      rows.length > 0 && selectionRange.r1 === 0 && selectionRange.r2 === rows.length - 1;

    let hasEditableInRange = false;
    for (let r = selectionRange.r1; r <= selectionRange.r2 && !hasEditableInRange; r += 1) {
      for (let c = selectionRange.c1; c <= selectionRange.c2; c += 1) {
        if (isEditableCol(columns, c)) {
          hasEditableInRange = true;
          break;
        }
      }
    }

    let allColsDeletable = colCount > 0;
    if (allowColumnDelete) {
      for (let c = selectionRange.c1; c <= selectionRange.c2; c += 1) {
        const col = columns[c];
        if (!col || !isColumnDeletable(col)) {
          allColsDeletable = false;
          break;
        }
      }
    } else {
      allColsDeletable = false;
    }

    return {
      rowCount,
      colCount,
      isMultiRow: rowCount > 1,
      isMultiCol: colCount > 1,
      isFullRowSelection,
      isFullColumnSelection,
      hasEditableInRange,
      showRowDelete: allowRowDelete && rowCount >= 1,
      showRowInsert: allowRowInsert,
      showColInsert: allowColumnInsert,
      showColDelete: allowColumnDelete && allColsDeletable && colCount >= 1,
      showClearSelection: hasEditableInRange,
      showClearTable: allowClearTable,
    };
  }, [
    allowColumnDelete,
    allowRowDelete,
    allowRowInsert,
    allowColumnInsert,
    allowClearTable,
    columns,
    editableColIndexes,
    isColumnDeletable,
    rows.length,
    selectionRange,
  ]);

  const dirtyRows = useMemo(() => {
    const dirty: AssetGridRow[] = [];
    rows.forEach((row, i) => {
      const orig = originalRows[i];
      if (!orig) {
        const hasData = columns.some((col) => col.key !== 'id' && (row[col.key] ?? '').trim());
        if (hasData) dirty.push(row);
        return;
      }
      if (columns.some((col) => (row[col.key] ?? '') !== (orig[col.key] ?? ''))) {
        dirty.push(row);
      }
    });
    return dirty;
  }, [rows, originalRows, columns]);

  const dirtyCount = dirtyRows.length + deletedIds.length;

  const columnWidthSignature = useMemo(
    () => columns.map((c) => `${c.key}:${c.width ?? 0}`).join('|'),
    [columns]
  );

  useEffect(() => {
    setLiveWidths({});
  }, [columnWidthSignature]);

  const columnWidths = useMemo(
    () => columns.map((col) => liveWidths[col.key] ?? col.width ?? 120),
    [columns, liveWidths]
  );

  const invalidColsByRow = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const k of invalid) {
      const sep = k.indexOf(':');
      if (sep < 0) continue;
      const r = Number(k.slice(0, sep));
      const c = Number(k.slice(sep + 1));
      if (Number.isNaN(r) || Number.isNaN(c)) continue;
      let cols = map.get(r);
      if (!cols) {
        cols = new Set();
        map.set(r, cols);
      }
      cols.add(c);
    }
    return map;
  }, [invalid]);

  const virtualEnabled = rows.length >= VIRTUALIZE_THRESHOLD;
  const { rows: virtualRows, paddingTop, paddingBottom } = useVirtualRows({
    items: rows,
    rowHeight: ROW_HEIGHT,
    containerRef: gridRef,
    enabled: virtualEnabled && !loading,
  });

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyCount > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirtyCount]);

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-25), rowsRef.current.map(cloneRow)]);
  }, []);

  const validateRegion = useCallback(
    (data: AssetGridRow[], region: CellRange) => {
      setInvalid((prev) => {
        const next = new Set(prev);
        for (let r = region.r1; r <= region.r2; r += 1) {
          for (let c = region.c1; c <= region.c2; c += 1) {
            const col = columns[c];
            if (!col) continue;
            const k = cellKey(r, c);
            if (!validateCell(data[r]?.[col.key] ?? '', col)) next.add(k);
            else next.delete(k);
          }
        }
        return next;
      });
    },
    [columns]
  );

  const applyRows = useCallback(
    (next: AssetGridRow[], region?: CellRange, skipValidate?: boolean) => {
      onRowsChange(next);
      if (region && !skipValidate) validateRegion(next, region);
    },
    [onRowsChange, validateRegion]
  );

  const resolveWidth = useCallback(
    (col: AssetGridColumn) => liveWidths[col.key] ?? col.width ?? 120,
    [liveWidths]
  );

  const startColumnResize = useCallback(
    (colIdx: number, e: ReactMouseEvent) => {
      if (!onColumnsChange) return;
      e.preventDefault();
      e.stopPropagation();
      const col = columns[colIdx];
      const startX = e.clientX;
      const startW = liveWidths[col.key] ?? col.width ?? 120;
      let latestX = startX;

      const onMove = (ev: MouseEvent) => {
        latestX = ev.clientX;
        if (resizeRafRef.current) return;
        resizeRafRef.current = requestAnimationFrame(() => {
          resizeRafRef.current = 0;
          const w = clampColumnWidth(startW + latestX - startX);
          setLiveWidths((prev) => (prev[col.key] === w ? prev : { ...prev, [col.key]: w }));
        });
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        if (resizeRafRef.current) {
          cancelAnimationFrame(resizeRafRef.current);
          resizeRafRef.current = 0;
        }
        const w = clampColumnWidth(startW + latestX - startX);
        setLiveWidths({});
        onColumnsChange(setColumnWidth(columnsRef.current, col.key, w));
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [columns, liveWidths, onColumnsChange]
  );

  const scrollColumnHeaderIntoView = useCallback((colIdx: number) => {
    requestAnimationFrame(() => {
      const grid = gridRef.current;
      if (!grid) return;
      const th = grid.querySelector(`th[data-col-idx="${colIdx}"]`);
      th?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }, []);

  const stopColumnDragScroll = useCallback(() => {
    if (dragScrollRafRef.current) {
      cancelAnimationFrame(dragScrollRafRef.current);
      dragScrollRafRef.current = 0;
    }
    dragColRef.current = null;
    dragOverColRef.current = null;
    setColumnDragUi({ from: null, over: null });
  }, []);

  const tickColumnDragScroll = useCallback(() => {
    const grid = gridRef.current;
    if (dragColRef.current === null || !grid) {
      dragScrollRafRef.current = 0;
      return;
    }
    const rect = grid.getBoundingClientRect();
    const edge = 56;
    const x = dragPointerXRef.current;
    let dx = 0;
    if (x < rect.left + edge) {
      dx = -Math.max(4, Math.ceil((rect.left + edge - x) / 3));
    } else if (x > rect.right - edge) {
      dx = Math.max(4, Math.ceil((x - (rect.right - edge)) / 3));
    }
    if (dx) grid.scrollLeft += dx;
    dragScrollRafRef.current = requestAnimationFrame(tickColumnDragScroll);
  }, []);

  const trackColumnDragPointer = useCallback(
    (clientX: number) => {
      dragPointerXRef.current = clientX;
      if (dragColRef.current !== null && !dragScrollRafRef.current) {
        dragScrollRafRef.current = requestAnimationFrame(tickColumnDragScroll);
      }
    },
    [tickColumnDragScroll]
  );

  const shiftColumn = useCallback(
    (from: number, delta: -1 | 1, edge?: 'start' | 'end') => {
      if (!onColumnsChange) return;
      const cols = columnsRef.current;
      const next = edge
        ? moveColumnToEdge(cols, from, edge)
        : moveColumnByStep(cols, from, delta);
      if (next === cols) return;
      const to = next.findIndex((c) => c.key === cols[from]?.key);
      onColumnsChange(next);
      if (to >= 0) scrollColumnHeaderIntoView(to);
    },
    [onColumnsChange, scrollColumnHeaderIntoView]
  );

  const minMovableCol = minMovableColumnIndex(columns);

  const columnLayout = useMemo(() => {
    const rowNumWidth = ROW_NUM_WIDTH;
    const lefts: number[] = [];
    let x = rowNumWidth;
    for (let i = 0; i < columns.length; i += 1) {
      lefts.push(x);
      x += columnWidths[i] ?? 120;
    }
    return { rowNumWidth, lefts };
  }, [columnWidths, columns.length]);

  const ensureCellVisible = useCallback(
    (row: number) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = gridRef.current;
          if (!el) return;
          const rowNumW = columnLayout.rowNumWidth;

          if (scrollActiveCellIntoView(el, rowNumW)) return;

          scrollRowIntoViewByIndex(el, row);
          requestAnimationFrame(() => {
            scrollActiveCellIntoView(el, rowNumW);
          });
        });
      });
    },
    [columnLayout.rowNumWidth]
  );

  const startEdit = useCallback(
    (row: number, col: number, initial?: string) => {
      if (!isEditableCol(columns, col)) return;
      setActive({ row, col });
      setEditing(true);
      setEditValue(initial ?? rowsRef.current[row]?.[columns[col].key] ?? '');
      requestAnimationFrame(() => {
        editInputRef.current?.focus();
        if (initial !== undefined) editInputRef.current?.select();
      });
    },
    [columns]
  );

  const commitEdit = useCallback(
    (move?: 'down' | 'right') => {
      if (!editing) return;
      const col = columns[active.col];
      if (col && isEditableCol(columns, active.col)) {
        pushUndo();
        const next = rowsRef.current.slice();
        next[active.row] = { ...next[active.row], [col.key]: editValue };
        applyRows(next, {
          r1: active.row,
          r2: active.row,
          c1: active.col,
          c2: active.col,
        });
      }
      setEditing(false);
      if (move === 'down' && active.row < rowsRef.current.length - 1) {
        const nr = active.row + 1;
        setActive((a) => ({ ...a, row: nr }));
        ensureCellVisible(nr);
      } else if (move === 'right') {
        const idx = editableColIndexes.find((i) => i > active.col);
        if (idx !== undefined) {
          setActive((a) => ({ ...a, col: idx }));
          ensureCellVisible(active.row);
        } else if (active.row < rowsRef.current.length - 1) {
          const nr = active.row + 1;
          setActive({ row: nr, col: editableColIndexes[0] ?? 0 });
          ensureCellVisible(nr);
        }
      }
    },
    [active, applyRows, columns, editableColIndexes, editing, editValue, ensureCellVisible, pushUndo]
  );

  const applyPasteMatrixFull = useCallback(
    (matrix: string[][], startRow: number) => {
      if (!matrix.length) return;
      pushUndo();
      const keysPerMatrixCol = columns.map((col) =>
        col.key === 'id' || col.type === 'readonly' ? '' : col.key
      );
      const next = pasteIntoRows(rowsRef.current, matrix, startRow, keysPerMatrixCol, emptyTemplate);
      applyRows(next, undefined, true);
    },
    [applyRows, columns, emptyTemplate, pushUndo]
  );

  const applyPasteMatrix = useCallback(
    (matrix: string[][], startRow: number, startCol: number) => {
      if (!matrix.length) return;
      pushUndo();

      let pasteCol = startCol;
      if (!isEditableCol(columns, pasteCol)) {
        pasteCol = editableColIndexes.find((i) => i >= startCol) ?? editableColIndexes[0] ?? 0;
      }

      const targetCols: number[] = [];
      let c = pasteCol;
      const maxW = Math.max(...matrix.map((line) => line.length));
      for (let i = 0; i < maxW && c < columns.length; i += 1) {
        while (c < columns.length && !isEditableCol(columns, c)) c += 1;
        if (c < columns.length) {
          targetCols.push(c);
          c += 1;
        }
      }

      const keysPerMatrixCol = targetCols.map((ci) => columns[ci].key);
      const next = pasteIntoRows(rowsRef.current, matrix, startRow, keysPerMatrixCol, emptyTemplate);
      applyRows(next, undefined, true);
    },
    [applyRows, columns, editableColIndexes, emptyTemplate, pushUndo]
  );

  const copyRange = useCallback(
    (range: CellRange) => {
      const lines: string[] = [];
      for (let r = range.r1; r <= range.r2; r += 1) {
        const cells: string[] = [];
        for (let c = range.c1; c <= range.c2; c += 1) {
          cells.push(rowsRef.current[r]?.[columns[c]?.key] ?? '');
        }
        lines.push(cells.join('\t'));
      }
      void navigator.clipboard.writeText(lines.join('\n'));
    },
    [columns]
  );

  const cutRange = useCallback(
    (range: CellRange) => {
      copyRange(range);
      pushUndo();
      const next = rowsRef.current.slice();
      for (let r = range.r1; r <= range.r2; r += 1) {
        const row = { ...next[r] };
        for (let c = range.c1; c <= range.c2; c += 1) {
          if (!isEditableCol(columns, c)) continue;
          row[columns[c].key] = '';
        }
        next[r] = row;
      }
      applyRows(next, range);
    },
    [applyRows, columns, copyRange, pushUndo]
  );

  const clearRange = useCallback(
    (range: CellRange) => {
      pushUndo();
      const next = rowsRef.current.slice();
      for (let r = range.r1; r <= range.r2; r += 1) {
        const row = { ...next[r] };
        for (let c = range.c1; c <= range.c2; c += 1) {
          if (!isEditableCol(columns, c)) continue;
          row[columns[c].key] = '';
        }
        next[r] = row;
      }
      applyRows(next, range);
    },
    [applyRows, columns, pushUndo]
  );

  const clearAllTable = useCallback(() => {
    const hasData = rowsRef.current.some((row) =>
      columns.some((col) => col.key !== 'id' && (row[col.key] ?? '').trim())
    );
    if (!hasData && deletedIds.length === 0) return;
    if (
      !window.confirm(
        '¿Vaciar toda la tabla? Se borrarán todos los datos editables. Guarda los cambios para aplicar en el servidor.'
      )
    ) {
      return;
    }
    pushUndo();
    const ids = rowsRef.current.map(rowPersistId).filter((id): id is string => Boolean(id));
    if (ids.length) setDeletedIds((prev) => [...prev, ...ids]);
    applyRows([{ ...emptyTemplate }]);
    setAnchor(null);
    setActive({ row: 0, col: editableColIndexes[0] ?? 0 });
  }, [applyRows, columns, deletedIds.length, editableColIndexes, emptyTemplate, pushUndo]);

  const deleteSelectedRows = useCallback(() => {
    const { r1, r2 } = selectionRange;
    const count = r2 - r1 + 1;
    if (
      !window.confirm(
        `¿Eliminar ${count} fila(s) por completo? Las filas ya guardadas se borrarán al guardar.`
      )
    ) {
      return;
    }
    pushUndo();
    const removed = rowsRef.current.slice(r1, r2 + 1);
    const ids = removed.map(rowPersistId).filter((id): id is string => Boolean(id));
    if (ids.length) setDeletedIds((prev) => [...prev, ...ids]);
    const next = rowsRef.current.filter((_, i) => i < r1 || i > r2);
    if (!next.length) next.push({ ...emptyTemplate });
    applyRows(next);
    const newRow = Math.min(r1, next.length - 1);
    setAnchor(null);
    setActive({ row: newRow, col: active.col });
  }, [active.col, applyRows, emptyTemplate, pushUndo, selectionRange]);

  const clearSelectedSelection = useCallback(() => {
    const { r1, r2, c1, c2 } = selectionRange;
    const colCount = c2 - c1 + 1;
    const rowCount = r2 - r1 + 1;
    const fullCols = selectionMeta.isFullColumnSelection && colCount > 0;
    const msg = fullCols
      ? `¿Vaciar las celdas de ${colCount} columna(s) en ${rowCount} fila(s) seleccionada(s)?`
      : `¿Vaciar las celdas de la selección (${rowCount}×${colCount})?`;
    if (!window.confirm(msg)) return;
    clearRange(selectionRange);
  }, [clearRange, selectionMeta.isFullColumnSelection, selectionRange]);

  const insertRowsAbove = useCallback(() => {
    const count = selectionRange.r2 - selectionRange.r1 + 1;
    const newRows = Array.from({ length: count }, () => emptyRow(columns));
    pushUndo();
    const next = [
      ...rowsRef.current.slice(0, selectionRange.r1),
      ...newRows,
      ...rowsRef.current.slice(selectionRange.r1),
    ];
    applyRows(next);
    setAnchor({ row: selectionRange.r1, col: selectionRange.c1 });
    setActive({ row: selectionRange.r1 + count - 1, col: selectionRange.c2 });
  }, [applyRows, columns, pushUndo, selectionRange]);

  const insertRowsBelow = useCallback(() => {
    const count = selectionRange.r2 - selectionRange.r1 + 1;
    const insertAt = selectionRange.r2 + 1;
    const newRows = Array.from({ length: count }, () => emptyRow(columns));
    pushUndo();
    const next = [
      ...rowsRef.current.slice(0, insertAt),
      ...newRows,
      ...rowsRef.current.slice(insertAt),
    ];
    applyRows(next);
    setAnchor({ row: insertAt, col: selectionRange.c1 });
    setActive({ row: insertAt + count - 1, col: selectionRange.c2 });
  }, [applyRows, columns, pushUndo, selectionRange]);

  const insertColumnLeft = useCallback(() => {
    if (!onColumnsChange) return;
    const insertAt = selectionRange.c1;
    const newCol = createCustomColumn();
    pushUndo();
    onColumnsChange([...columns.slice(0, insertAt), newCol, ...columns.slice(insertAt)]);
    const next = rowsRef.current.map((row) => ({ ...row, [newCol.key]: '' }));
    applyRows(next);
    const maxRow = Math.max(next.length - 1, 0);
    setAnchor({ row: 0, col: insertAt });
    setActive({ row: maxRow, col: insertAt });
  }, [applyRows, columns, onColumnsChange, pushUndo, selectionRange]);

  const insertColumnRight = useCallback(() => {
    if (!onColumnsChange) return;
    const insertAt = selectionRange.c2 + 1;
    const newCol = createCustomColumn();
    pushUndo();
    onColumnsChange([...columns.slice(0, insertAt), newCol, ...columns.slice(insertAt)]);
    const next = rowsRef.current.map((row) => ({ ...row, [newCol.key]: '' }));
    applyRows(next);
    const maxRow = Math.max(next.length - 1, 0);
    setAnchor({ row: 0, col: insertAt });
    setActive({ row: maxRow, col: insertAt });
  }, [applyRows, columns, onColumnsChange, pushUndo, selectionRange]);

  const deleteSelectedColumns = useCallback(() => {
    if (!onColumnsChange) return;
    const { c1, c2 } = selectionRange;
    const colsToDelete = columns.slice(c1, c2 + 1);
    if (!colsToDelete.length || !colsToDelete.every(isColumnDeletable)) return;
    const colCount = c2 - c1 + 1;
    if (
      !window.confirm(
        `¿Eliminar ${colCount} columna(s) por completo? Los datos de esas columnas se perderán al guardar.`
      )
    ) {
      return;
    }
    pushUndo();
    const keysToRemove = new Set(colsToDelete.map((c) => c.key));
    onColumnsChange(columns.filter((c) => !keysToRemove.has(c.key)));
    const next = rowsRef.current.map((row) => {
      const nr = { ...row };
      for (const k of keysToRemove) delete nr[k];
      return nr;
    });
    applyRows(next);
    const newCol = Math.min(c1, columns.length - colCount - 1);
    setAnchor(null);
    setActive({ row: Math.min(active.row, next.length - 1), col: Math.max(0, newCol) });
  }, [active.row, applyRows, columns, isColumnDeletable, onColumnsChange, pushUndo, selectionRange]);

  const jumpToEdge = useCallback(
    (row: number, col: number, key: string): CellPos => {
      const colDef = columns[col];
      const colKey = colDef?.key;
      const data = rowsRef.current;
      const maxRow = Math.max(data.length - 1, 0);

      if (key === 'ArrowDown') {
        if (!colKey) return { row: maxRow, col };
        for (let r = maxRow; r >= row; r -= 1) {
          if ((data[r]?.[colKey] ?? '').trim()) return { row: r, col };
        }
        return { row: maxRow, col };
      }
      if (key === 'ArrowUp') {
        if (!colKey) return { row: 0, col };
        for (let r = 0; r <= row; r += 1) {
          if ((data[r]?.[colKey] ?? '').trim()) return { row: r, col };
        }
        return { row: 0, col };
      }
      if (key === 'ArrowRight') {
        for (let c = columns.length - 1; c >= col; c -= 1) {
          if (isEditableCol(columns, c)) return { row, col: c };
        }
        return { row, col: columns.length - 1 };
      }
      if (key === 'ArrowLeft') {
        for (let c = 0; c <= col; c += 1) {
          if (isEditableCol(columns, c)) return { row, col: c };
        }
        return { row, col: 0 };
      }
      return { row, col };
    },
    [columns]
  );

  const onPaste = (e: ClipboardEvent) => {
    const raw = parseClipboardFromDataTransfer(e.clipboardData);
    if (!raw.length) return;

    const singleCell =
      raw.length === 1 &&
      raw[0].length === 1 &&
      !raw[0][0].includes('\t') &&
      !raw[0][0].includes('\n');

    if (singleCell) {
      if (!editing && isEditableCol(columns, active.col)) {
        e.preventDefault();
        startEdit(active.row, active.col, raw[0][0]);
      }
      return;
    }

    e.preventDefault();
    const colCount = Math.max(...raw.map((r) => r.length), 0);
    const { rows: headerAligned, usedHeaders } = alignPasteByHeaders(raw, columns);

    if (usedHeaders) {
      applyPasteMatrixFull(headerAligned, selectionRange.r1);
      setPasteHint(`Pegadas ${headerAligned.length} filas · mapeo por cabeceras (${colCount} cols)`);
    } else {
      applyPasteMatrix(raw, selectionRange.r1, selectionRange.c1);
      setPasteHint(`Pegadas ${raw.length} filas · ${colCount} columnas desde celda activa`);
    }
    window.setTimeout(() => setPasteHint(null), 5000);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const range = selectionRange;
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

    if (!editing && arrowKeys.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(false);
        setEditValue(rowsRef.current[active.row]?.[columns[active.col]?.key] ?? '');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit('down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit('right');
      }
      return;
    }

    if (mod && e.key === 'c') {
      e.preventDefault();
      copyRange(range);
      return;
    }
    if (mod && e.key === 'x') {
      e.preventDefault();
      cutRange(range);
      return;
    }
    if (mod && e.key === 'z') {
      e.preventDefault();
      const prev = undoStack[undoStack.length - 1];
      if (prev) {
        setUndoStack((s) => s.slice(0, -1));
        applyRows(prev);
      }
      return;
    }
    if (mod && e.key === 'a') {
      e.preventDefault();
      const maxRow = Math.max(rowsRef.current.length - 1, 0);
      const lastCol = editableColIndexes[editableColIndexes.length - 1] ?? columns.length - 1;
      setAnchor({ row: 0, col: editableColIndexes[0] ?? 0 });
      setActive({ row: maxRow, col: lastCol });
      ensureCellVisible(maxRow);
      return;
    }

    if (
      mod &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    ) {
      e.preventDefault();
      const edge = jumpToEdge(active.row, active.col, e.key);
      if (e.shiftKey) setAnchor((a) => a ?? active);
      else setAnchor(null);
      setActive(edge);
      ensureCellVisible(edge.row);
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const maxRow = Math.max(rowsRef.current.length - 1, 0);
      const maxCol = columns.length - 1;
      const next = {
        row: Math.min(Math.max(active.row + dr, 0), maxRow),
        col: Math.min(Math.max(active.col + dc, 0), maxCol),
      };
      setActive(next);
      if (e.shiftKey) setAnchor((a) => a ?? active);
      else setAnchor(null);
      ensureCellVisible(next.row);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      startEdit(active.row, active.col);
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      startEdit(active.row, active.col);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      const list = editableColIndexes;
      const pos = list.indexOf(active.col);
      if (pos >= 0) {
        const np = pos + dir;
        if (np >= 0 && np < list.length) {
          setActive((a) => ({ ...a, col: list[np] }));
          ensureCellVisible(active.row);
        } else if (dir > 0 && active.row < rowsRef.current.length - 1) {
          const nr = active.row + 1;
          setActive({ row: nr, col: list[0] });
          ensureCellVisible(nr);
        }
      }
      setAnchor(null);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearRange(range);
      return;
    }
    if (e.key.length === 1 && !mod && isEditableCol(columns, active.col)) {
      e.preventDefault();
      startEdit(active.row, active.col, e.key);
    }
  };

  const onCellMouseDown = useCallback((r: number, c: number, e: ReactMouseEvent) => {
    e.preventDefault();
    if (e.shiftKey) {
      setActive({ row: r, col: c });
    } else {
      setAnchor({ row: r, col: c });
      setActive({ row: r, col: c });
      dragRef.current = true;
    }
    setEditing(false);
    gridRef.current?.focus();
  }, []);

  const onCellMouseEnter = useCallback((r: number, c: number) => {
    if (!dragRef.current) return;
    pendingDragCellRef.current = { row: r, col: c };
    if (dragActiveRafRef.current) return;
    dragActiveRafRef.current = requestAnimationFrame(() => {
      dragActiveRafRef.current = 0;
      const next = pendingDragCellRef.current;
      if (next) setActive(next);
    });
  }, []);

  useEffect(() => {
    const up = () => {
      dragRef.current = false;
      pendingDragCellRef.current = null;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const selectColumn = useCallback((colIdx: number, shiftKey?: boolean) => {
    const maxRow = Math.max(rows.length - 1, 0);
    if (shiftKey && anchor !== null) {
      const ac1 = Math.min(anchor.col, colIdx);
      const ac2 = Math.max(anchor.col, colIdx);
      setAnchor({ row: 0, col: ac1 });
      setActive({ row: maxRow, col: ac2 });
    } else {
      setAnchor({ row: 0, col: colIdx });
      setActive({ row: maxRow, col: colIdx });
    }
    gridRef.current?.focus();
  }, [anchor, rows.length]);

  const selectRow = useCallback((rowIdx: number, shiftKey?: boolean) => {
    const c1 = editableColIndexes[0] ?? 0;
    const c2 = editableColIndexes[editableColIndexes.length - 1] ?? columns.length - 1;
    if (shiftKey && anchor !== null) {
      const r1 = Math.min(anchor.row, rowIdx);
      const r2 = Math.max(anchor.row, rowIdx);
      setAnchor({ row: r1, col: c1 });
      setActive({ row: r2, col: c2 });
    } else {
      setAnchor({ row: rowIdx, col: c1 });
      setActive({ row: rowIdx, col: c2 });
    }
    gridRef.current?.focus();
  }, [anchor, columns.length, editableColIndexes]);

  const onCommitCell = useCallback(() => {
    commitEdit();
  }, [commitEdit]);

  const showRowActionAt = selectionMeta.showRowDelete ? selectionRange.r1 : -1;

  const activeCol = columns[active.col];
  const activeRow = rows[active.row];
  const originalVal = originalRows[active.row]?.[activeCol?.key ?? ''] ?? '';

  const gridRowProps = useMemo(
    () => ({
      columns,
      columnWidths,
      selR1: selectionRange.r1,
      selR2: selectionRange.r2,
      selC1: selectionRange.c1,
      selC2: selectionRange.c2,
      activeRow: active.row,
      activeCol: active.col,
      editing,
      editValue,
      rowCount: selectionMeta.rowCount,
      editInputRef,
      onEditChange: setEditValue,
      onCommit: onCommitCell,
      onCellMouseDown,
      onCellMouseEnter,
      onStartEdit: startEdit,
      onSelectRow: selectRow,
      onDeleteRows: deleteSelectedRows,
    }),
    [
      active.col,
      active.row,
      columnWidths,
      columns,
      deleteSelectedRows,
      editing,
      editValue,
      onCellMouseDown,
      onCellMouseEnter,
      onCommitCell,
      selectionMeta.rowCount,
      selectionRange.c1,
      selectionRange.c2,
      selectionRange.r1,
      selectionRange.r2,
      selectRow,
      startEdit,
    ]
  );

  return (
    <div className="space-y-2">
      {dirtyCount > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <span className="font-medium text-foreground">
            {dirtyRows.length} fila(s) modificada(s)
          </span>
          {activeCol && activeRow && (activeRow[activeCol.key] ?? '') !== (originalVal ?? '') ? (
            <span className="text-muted-foreground truncate max-w-md">
              {activeCol.label}: «{originalVal || '—'}» → «{activeRow[activeCol.key] || '—'}»
            </span>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (dirtyCount && !window.confirm('¿Descartar todos los cambios?')) return;
                applyRows(originalRows.map(cloneRow));
                setDeletedIds([]);
                setUndoStack([]);
              }}
              disabled={saving}
            >
              <RotateCcw className="size-3.5 mr-1" />
              Descartar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving || invalid.size > 0}
              onClick={() =>
                void (async () => {
                  setSaving(true);
                  try {
                    await onSave(dirtyRows, deletedIds);
                    setOriginalRows(rowsRef.current.map(cloneRow));
                    setDeletedIds([]);
                    setUndoStack([]);
                  } finally {
                    setSaving(false);
                  }
                })()
              }
            >
              {saving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 items-center">
        {allowRowMutations ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              pushUndo();
              applyRows([...rowsRef.current, emptyRow(columns)]);
            }}
          >
            <Plus className="size-3.5 mr-1" />
            Fila nueva
          </Button>
        ) : null}
        {selectionMeta.showClearTable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearAllTable}
            disabled={loading}
          >
            <Eraser className="size-3.5 mr-1" />
            Limpiar tabla
          </Button>
        ) : null}
        {selectionMeta.showRowInsert ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={insertRowsAbove}>
              <Plus className="size-3.5 mr-1" />
              Insertar fila arriba
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={insertRowsBelow}>
              <Plus className="size-3.5 mr-1" />
              Insertar fila abajo
            </Button>
          </>
        ) : null}
        {selectionMeta.showRowDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-rose-700 border-rose-500/40 hover:bg-rose-500/10 dark:text-rose-400"
            onClick={deleteSelectedRows}
          >
            <Trash2 className="size-3.5 mr-1" />
            Eliminar {selectionMeta.rowCount} fila(s)
          </Button>
        ) : null}
        {selectionMeta.showColInsert ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={insertColumnLeft}>
              <Plus className="size-3.5 mr-1" />
              Insertar columna izq.
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={insertColumnRight}>
              <Plus className="size-3.5 mr-1" />
              Insertar columna der.
            </Button>
          </>
        ) : null}
        {selectionMeta.showColDelete ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-rose-700 border-rose-500/40 hover:bg-rose-500/10 dark:text-rose-400"
            onClick={deleteSelectedColumns}
          >
            <Trash2 className="size-3.5 mr-1" />
            Eliminar {selectionMeta.colCount} columna(s)
          </Button>
        ) : null}
        {selectionMeta.showClearSelection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSelectedSelection}
          >
            <Eraser className="size-3.5 mr-1" />
            {selectionMeta.isFullColumnSelection && selectionMeta.colCount > 1
              ? `Vaciar ${selectionMeta.colCount} columna(s)`
              : 'Vaciar selección'}
          </Button>
        ) : null}
        {rows.length > 0 ? (
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {rows.length.toLocaleString()} filas
          </span>
        ) : null}
      </div>
      {pasteHint ? (
        <p className="text-[10px] text-emerald-700 dark:text-emerald-400">{pasteHint}</p>
      ) : null}

      <div
        ref={gridRef}
        tabIndex={0}
        className="overflow-auto max-h-[min(70vh,640px)] rounded-lg border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring/40 overscroll-contain"
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onDragOver={(e) => {
          if (dragColRef.current === null) return;
          e.preventDefault();
          trackColumnDragPointer(e.clientX);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          dragOverColRef.current = null;
          setColumnDragUi((prev) => (prev.over === null ? prev : { ...prev, over: null }));
        }}
        onDrop={() => {
          stopColumnDragScroll();
        }}
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="border-collapse text-xs w-full table-fixed">
            <colgroup>
              <col style={{ width: ROW_NUM_WIDTH }} />
              {columns.map((col, i) => (
                <col key={col.key} style={{ width: columnWidths[i] ?? 120 }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-[2] bg-muted">
              <tr>
                <th className="border border-border px-1 py-1 text-muted-foreground sticky left-0 z-[3] bg-muted">
                  #
                </th>
                {columns.map((col, ci) => {
                  const isFirstSelectedCol = ci === selectionRange.c1;
                  const showColDeleteBtn = selectionMeta.showColDelete && isFirstSelectedCol;
                  const showColClearBtn = selectionMeta.showClearSelection && isFirstSelectedCol;
                  const headerPad =
                    showColDeleteBtn && showColClearBtn ? 'pl-11' : showColDeleteBtn || showColClearBtn ? 'pl-6' : '';
                  const reorderable = Boolean(onColumnsChange) && canReorderColumn(col);
                  const isDragSource = columnDragUi.from === ci;
                  const isDropTarget = columnDragUi.from !== null && columnDragUi.over === ci;
                  const canMoveLeft = reorderable && ci > minMovableCol;
                  const canMoveRight = reorderable && ci < columns.length - 1;

                  return (
                  <th
                    key={col.key}
                    data-col-idx={ci}
                    className={[
                      'border border-border px-2 py-1 text-left font-medium whitespace-nowrap text-foreground relative group',
                      reorderable ? 'cursor-default' : '',
                      isDragSource ? 'opacity-60' : '',
                      isDropTarget ? 'bg-violet-500/20 ring-2 ring-inset ring-violet-500/50' : 'hover:bg-muted/80',
                    ].join(' ')}
                    style={{ width: columnWidths[ci] ?? 120, minWidth: columnWidths[ci] ?? 120 }}
                    onClick={(e) => selectColumn(ci, e.shiftKey)}
                    title={
                      reorderable
                        ? 'Clic: columna · Shift+clic: extender · ⋮⋮ arrastrar · ‹› mover · Borde derecho: ancho'
                        : 'Clic: columna · Shift+clic: extender · Borde derecho: ancho'
                    }
                    onDragOver={(e) => {
                      if (dragColRef.current === null) return;
                      e.preventDefault();
                      dragOverColRef.current = ci;
                      setColumnDragUi((prev) =>
                        prev.over === ci ? prev : { ...prev, over: ci }
                      );
                      trackColumnDragPointer(e.clientX);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = dragColRef.current;
                      stopColumnDragScroll();
                      if (from === null || !onColumnsChange || from === ci) return;
                      onColumnsChange(moveColumn(columns, from, ci));
                      scrollColumnHeaderIntoView(ci);
                    }}
                  >
                    {showColDeleteBtn ? (
                      <button
                        type="button"
                        className="absolute left-1 top-1/2 z-[4] inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-rose-600 hover:bg-rose-500/15 dark:text-rose-400"
                        title={`Eliminar ${selectionMeta.colCount} columna(s)`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSelectedColumns();
                        }}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : null}
                    {showColClearBtn ? (
                      <button
                        type="button"
                        className={[
                          'absolute top-1/2 z-[4] inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-amber-700 hover:bg-amber-500/15 dark:text-amber-400',
                          showColDeleteBtn ? 'left-6' : 'left-1',
                        ].join(' ')}
                        title={
                          selectionMeta.isFullColumnSelection && selectionMeta.colCount > 1
                            ? `Vaciar ${selectionMeta.colCount} columna(s)`
                            : 'Vaciar selección'
                        }
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          clearSelectedSelection();
                        }}
                      >
                        <Eraser className="size-3" />
                      </button>
                    ) : null}
                    {reorderable ? (
                      <div className="absolute left-0.5 top-1/2 z-[5] flex -translate-y-1/2 items-center gap-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <span
                          draggable
                          className="inline-flex size-4 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                          title="Arrastrar columna (auto-scroll cerca del borde)"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onDragStart={(e) => {
                            dragColRef.current = ci;
                            setColumnDragUi({ from: ci, over: ci });
                            e.dataTransfer.effectAllowed = 'move';
                            if (e.dataTransfer.setDragImage) {
                              const ghost = document.createElement('div');
                              ghost.textContent = col.label;
                              ghost.className =
                                'rounded border border-violet-500/40 bg-background px-2 py-1 text-[10px] font-semibold shadow-md';
                              ghost.style.position = 'absolute';
                              ghost.style.top = '-1000px';
                              document.body.appendChild(ghost);
                              e.dataTransfer.setDragImage(ghost, 12, 12);
                              requestAnimationFrame(() => ghost.remove());
                            }
                            trackColumnDragPointer(e.clientX);
                          }}
                          onDragEnd={() => {
                            stopColumnDragScroll();
                          }}
                        >
                          <GripVertical className="size-3" />
                        </span>
                        <button
                          type="button"
                          className="inline-flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                          title="Mover izquierda (Shift: al inicio)"
                          disabled={!canMoveLeft}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            shiftColumn(ci, -1, e.shiftKey ? 'start' : undefined);
                          }}
                        >
                          <ChevronLeft className="size-3" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                          title="Mover derecha (Shift: al final)"
                          disabled={!canMoveRight}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            shiftColumn(ci, 1, e.shiftKey ? 'end' : undefined);
                          }}
                        >
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    ) : null}
                    <span
                      className={[
                        'inline-flex items-center gap-1 pr-2 min-w-0',
                        headerPad,
                        reorderable ? 'pl-12' : '',
                      ].join(' ')}
                    >
                      {renderColumnHeader ? (
                        renderColumnHeader(col, ci)
                      ) : (
                        <>
                          {col.key.startsWith('custom_') ? (
                            <span className="text-violet-600 dark:text-violet-400" title="Columna temporal">◇</span>
                          ) : null}
                          {col.label}
                        </>
                      )}
                    </span>
                    {onColumnsChange ? (
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Redimensionar ${col.label}`}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none opacity-0 group-hover:opacity-100 bg-violet-500/40 hover:bg-violet-500"
                        onMouseDown={(e) => startColumnResize(ci, e)}
                        onClick={(e) => e.stopPropagation()}
                        onDragStart={(e) => e.preventDefault()}
                      />
                    ) : null}
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {virtualEnabled && paddingTop > 0 ? (
                <tr style={{ height: paddingTop }} aria-hidden>
                  <td colSpan={columns.length + 1} />
                </tr>
              ) : null}
              {virtualEnabled
                ? virtualRows.map(({ item, index }) => (
                    <AssetGridRow
                      key={item.__id ?? `new-${index}`}
                      {...gridRowProps}
                      row={item}
                      r={index}
                      invalidCols={invalidColsByRow.get(index)}
                      showRowAction={index === showRowActionAt}
                    />
                  ))
                : rows.map((item, index) => (
                    <AssetGridRow
                      key={item.__id ?? `new-${index}`}
                      {...gridRowProps}
                      row={item}
                      r={index}
                      invalidCols={invalidColsByRow.get(index)}
                      showRowAction={index === showRowActionAt}
                    />
                  ))}
              {virtualEnabled && paddingBottom > 0 ? (
                <tr style={{ height: paddingBottom }} aria-hidden>
                  <td colSpan={columns.length + 1} />
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
