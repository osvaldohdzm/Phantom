'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Shield,
  Search,
  Filter,
  Plus,
  Play,
  CheckCircle,
  Clock,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Edit2,
  Save,
  Terminal,
  Copy,
  LayoutGrid,
  Table,
  Download,
  FolderOpen,
  ArrowUpDown,
  CheckSquare,
  Square,
  ChevronsUpDown,
  RotateCcw,
  Scissors,
  Clipboard,
  ClipboardPaste,
  HelpCircle,
  Palette,
  Sparkles,
  FileText,
  Sliders,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PRUEBAS_INITIAL, type SecurityTestItem } from '@/lib/data-pruebas';

const HackerCanvas = dynamic(
  () => import('@/components/hacker-canvas').then((mod) => mod.HackerCanvas),
  { ssr: false }
);

interface ActiveTestSuiteInstance {
  id: string;
  name: string;
  projectName: string;
  framework: string;
  createdAt: string;
  tests: SecurityTestItem[];
}

interface MatrixCellInputProps {
  rowIndex: number;
  colIndex: number;
  test: SecurityTestItem;
  isFocused: boolean;
  isRangeSelected?: boolean;
  isTopEdge?: boolean;
  isBottomEdge?: boolean;
  isLeftEdge?: boolean;
  isRightEdge?: boolean;
  isEditingCell: boolean;
  field?: keyof SecurityTestItem;
  type?: string;
  step?: string;
  placeholder?: string;
  className?: string;
  isEvidence?: boolean;
  evidenceIdx?: number;
  evidenceField?: 'imagen' | 'nota';
  onMatrixCellUpdate: (testId: number, field: keyof SecurityTestItem, value: any) => void;
  onMatrixEvidenceUpdate: (testId: number, idx: number, field: 'imagen' | 'nota', value: string) => void;
  onSetFocusedCell: (cell: { rowIndex: number; colIndex: number } | null) => void;
  onCellMouseDown?: (rIndex: number, cIndex: number, e: React.MouseEvent) => void;
  onCellMouseEnter?: (rIndex: number, cIndex: number) => void;
  onCellClick: (rIndex: number, cIndex: number) => void;
  onStartEditing: () => void;
  substituteCommand: (rawCommand: string, target: string, file: string) => string;
  onEditEvidence?: (testId: number, idx: number) => void;
}

const areCellPropsEqual = (prev: MatrixCellInputProps, next: MatrixCellInputProps): boolean => {
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.colIndex !== next.colIndex) return false;
  if (prev.isFocused !== next.isFocused) return false;
  if (prev.isEditingCell !== next.isEditingCell && next.isFocused) return false;
  if (prev.isRangeSelected !== next.isRangeSelected) return false;
  if (prev.isTopEdge !== next.isTopEdge) return false;
  if (prev.isBottomEdge !== next.isBottomEdge) return false;
  if (prev.isLeftEdge !== next.isLeftEdge) return false;
  if (prev.isRightEdge !== next.isRightEdge) return false;
  if (prev.test !== next.test) return false;
  if (prev.className !== next.className) return false;
  return true;
};

const MatrixCellInput = React.memo(({
  rowIndex,
  colIndex,
  test,
  isFocused,
  isRangeSelected = false,
  isTopEdge = false,
  isBottomEdge = false,
  isLeftEdge = false,
  isRightEdge = false,
  isEditingCell,
  field,
  type = 'text',
  step,
  placeholder,
  className = '',
  isEvidence = false,
  evidenceIdx = 0,
  evidenceField = 'imagen',
  onMatrixCellUpdate,
  onMatrixEvidenceUpdate,
  onSetFocusedCell,
  onCellMouseDown,
  onCellMouseEnter,
  onCellClick,
  onStartEditing,
  substituteCommand,
  onEditEvidence,
}: MatrixCellInputProps) => {
  const isEditing = isEditingCell && isFocused;

  let val: string | number = '';
  let changeHandler = (val: any) => {};

  if (isEvidence) {
    val = test.evidencias[evidenceIdx]?.[evidenceField] || '';
    changeHandler = (newVal: any) => onMatrixEvidenceUpdate(test.id, evidenceIdx, evidenceField, newVal);
  } else if (field) {
    if (field === 'comandoBulk') {
      val = substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile);
    } else if (field === 'comandoSingle') {
      val = substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile);
    } else {
      val = (test[field] as string | number) || '';
    }
    changeHandler = (newVal: any) => onMatrixCellUpdate(test.id, field, newVal);
  }

  const inputEl = (
    <input
      id={`cell-${rowIndex}-${colIndex}`}
      type={type}
      step={step}
      placeholder={placeholder}
      value={val}
      onChange={(e) => changeHandler(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
      readOnly={!isEditing}
      onFocus={() => onSetFocusedCell({ rowIndex, colIndex })}
      onMouseDown={(e) => onCellMouseDown && onCellMouseDown(rowIndex, colIndex, e)}
      onMouseEnter={() => onCellMouseEnter && onCellMouseEnter(rowIndex, colIndex)}
      onClick={() => onCellClick(rowIndex, colIndex)}
      onDoubleClick={onStartEditing}
      className={`w-full h-7 rounded-none bg-transparent px-1 focus:bg-background/80 focus:ring-1 focus:ring-cyan-500 focus:outline-none text-[10px] ${
        isFocused
          ? 'ring-2 ring-cyan-500 bg-cyan-500/10 dark:bg-cyan-500/20 font-bold z-20 shadow-md'
          : isRangeSelected
          ? `bg-cyan-500/20 dark:bg-cyan-500/25 font-semibold text-cyan-950 dark:text-cyan-100 ${
              isTopEdge ? 'border-t-2 border-t-cyan-500 z-10' : ''
            } ${isBottomEdge ? 'border-b-2 border-b-cyan-500 z-10' : ''} ${
              isLeftEdge ? 'border-l-2 border-l-cyan-500 z-10' : ''
            } ${isRightEdge ? 'border-r-2 border-r-cyan-500 z-10' : ''}`
          : ''
      } ${!isEditing ? 'cursor-pointer select-none' : 'cursor-text'} ${className}`}
    />
  );

  if (isEvidence && evidenceField === 'imagen' && onEditEvidence) {
    const rawVal = String(val || '');
    return (
      <div className="flex items-center gap-1.5 w-full px-1">
        {rawVal ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditEvidence(test.id, evidenceIdx);
            }}
            className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-bold underline flex items-center gap-1 text-[10px] truncate max-w-[130px] shrink-0 focus:outline-none"
            title="Clic para ver o editar evidencia en Canvas"
          >
            <ImageIcon className="size-3 text-blue-500 shrink-0" />
            <span className="truncate">
              {rawVal.startsWith('data:image/') ? `Ver Evidencia ${evidenceIdx + 1}` : rawVal}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditEvidence(test.id, evidenceIdx);
            }}
            className="text-muted-foreground/60 hover:text-cyan-400 italic text-[9px] flex items-center gap-1 shrink-0"
            title="Añadir Evidencia en Canvas"
          >
            <ImageIcon className="size-3 text-muted-foreground shrink-0" />
            + Evidencia
          </button>
        )}
        <div className="grow min-w-0">{inputEl}</div>
      </div>
    );
  }

  if (field === 'resultadoPrueba' && !isEditing) {
    const st = String(val || 'PENDING');
    return (
      <div
        onClick={() => onCellClick(rowIndex, colIndex)}
        onDoubleClick={onStartEditing}
        className="w-full h-7 flex items-center justify-center cursor-pointer select-none px-1"
      >
        {st === 'PASSED' ? (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            ✅ PASSED
          </span>
        ) : st === 'FAILED' ? (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            ❌ FAILED
          </span>
        ) : st === 'Out Of Scope' ? (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40">
            🚫 Out Of Scope
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
            ⏳ PENDING
          </span>
        )}
      </div>
    );
  }

  return inputEl;
}, areCellPropsEqual);

MatrixCellInput.displayName = 'MatrixCellInput';

interface MatrixRowProps {
  rowIndex: number;
  test: SecurityTestItem;
  isSelected: boolean;
  isFullRowSelected: boolean;
  focusedColIndex: number | null;
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  isEditingCell: boolean;
  copiedId: string | null;
  toggleSelectOne: (id: number) => void;
  onRowContextMenu: (e: React.MouseEvent, testId: number, rowIndex: number) => void;
  onSelectFullRow: (rowIndex: number) => void;
  onMatrixCellUpdate: (testId: number, field: keyof SecurityTestItem, value: any) => void;
  onMatrixEvidenceUpdate: (testId: number, idx: number, field: 'imagen' | 'nota', value: string) => void;
  onSetFocusedCell: (cell: { rowIndex: number; colIndex: number } | null) => void;
  onCellMouseDown: (rIndex: number, cIndex: number, e: React.MouseEvent) => void;
  onCellMouseEnter: (rIndex: number, cIndex: number) => void;
  onCellClick: (rIndex: number, cIndex: number) => void;
  onStartEditing: () => void;
  substituteCommand: (rawCommand: string, target: string, file: string) => string;
  onEditEvidence: (testId: number, idx: number) => void;
  setIsEditingCell: (val: boolean) => void;
  copyToClipboard: (text: string, id: string) => void;
}

const areRowPropsEqual = (prev: MatrixRowProps, next: MatrixRowProps): boolean => {
  if (prev.rowIndex !== next.rowIndex) return false;
  if (prev.test !== next.test) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isFullRowSelected !== next.isFullRowSelected) return false;
  if (prev.focusedColIndex !== next.focusedColIndex) return false;
  if (prev.copiedId !== next.copiedId && (prev.copiedId?.includes(String(prev.test.id)) || next.copiedId?.includes(String(next.test.id)))) return false;
  if (prev.isEditingCell !== next.isEditingCell && (prev.focusedColIndex !== null || next.focusedColIndex !== null)) return false;

  const prevRangeInRow = Boolean(prev.selectionRange && prev.rowIndex >= prev.selectionRange.startRow && prev.rowIndex <= prev.selectionRange.endRow);
  const nextRangeInRow = Boolean(next.selectionRange && next.rowIndex >= next.selectionRange.startRow && next.rowIndex <= next.selectionRange.endRow);
  if (prevRangeInRow !== nextRangeInRow) return false;

  if (nextRangeInRow && prev.selectionRange && next.selectionRange) {
    if (prev.selectionRange.startCol !== next.selectionRange.startCol || prev.selectionRange.endCol !== next.selectionRange.endCol) return false;
  }

  return true;
};

const MatrixRow = React.memo(({
  rowIndex,
  test,
  isSelected,
  isFullRowSelected,
  focusedColIndex,
  selectionRange,
  isEditingCell,
  copiedId,
  toggleSelectOne,
  onRowContextMenu,
  onSelectFullRow,
  onMatrixCellUpdate,
  onMatrixEvidenceUpdate,
  onSetFocusedCell,
  onCellMouseDown,
  onCellMouseEnter,
  onCellClick,
  onStartEditing,
  substituteCommand,
  onEditEvidence,
  setIsEditingCell,
  copyToClipboard,
}: MatrixRowProps) => {
  const renderCellInput = (
    colIndex: number,
    field?: keyof SecurityTestItem,
    type = 'text',
    step?: string,
    placeholder?: string,
    className = '',
    isEvidence = false,
    evidenceIdx = 0,
    evidenceField: 'imagen' | 'nota' = 'imagen'
  ) => (
    <MatrixCellInput
      rowIndex={rowIndex}
      colIndex={colIndex}
      test={test}
      isFocused={focusedColIndex === colIndex}
      isRangeSelected={Boolean(
        selectionRange &&
        rowIndex >= selectionRange.startRow &&
        rowIndex <= selectionRange.endRow &&
        colIndex >= selectionRange.startCol &&
        colIndex <= selectionRange.endCol
      )}
      isTopEdge={Boolean(selectionRange && rowIndex === selectionRange.startRow)}
      isBottomEdge={Boolean(selectionRange && rowIndex === selectionRange.endRow)}
      isLeftEdge={Boolean(selectionRange && colIndex === selectionRange.startCol)}
      isRightEdge={Boolean(selectionRange && colIndex === selectionRange.endCol)}
      isEditingCell={isEditingCell}
      field={field}
      type={type}
      step={step}
      placeholder={placeholder}
      className={className}
      isEvidence={isEvidence}
      evidenceIdx={evidenceIdx}
      evidenceField={evidenceField}
      onMatrixCellUpdate={onMatrixCellUpdate}
      onMatrixEvidenceUpdate={onMatrixEvidenceUpdate}
      onSetFocusedCell={onSetFocusedCell}
      onCellMouseDown={onCellMouseDown}
      onCellMouseEnter={onCellMouseEnter}
      onCellClick={onCellClick}
      onStartEditing={onStartEditing}
      substituteCommand={substituteCommand}
      onEditEvidence={onEditEvidence}
    />
  );

  return (
    <tr
      className={`hover:bg-cyan-500/5 transition-colors ${
        isFullRowSelected
          ? 'bg-cyan-600/20 ring-1 ring-cyan-500/40'
          : isSelected
            ? 'bg-cyan-600/10'
            : test.resultadoPrueba === 'FAILED'
              ? 'bg-rose-500/5'
              : test.resultadoPrueba === 'PASSED'
                ? 'bg-emerald-500/5'
                : 'bg-background/10'
      }`}
    >
      {/* 0. Checkbox Column */}
      <td className="p-2 text-center border-r-2 border-cyan-500/20 sticky left-0 z-30 bg-background dark:bg-[#0a0f18] w-10">
        <button
          type="button"
          onClick={() => toggleSelectOne(test.id)}
          className="focus:outline-none inline-flex items-center justify-center"
        >
          {isSelected ? (
            <CheckSquare className="size-3.5 text-cyan-500" />
          ) : (
            <Square className="size-3.5 text-muted-foreground/60" />
          )}
        </button>
      </td>

      {/* 1. Id (Sticky Left) */}
      <td
        onClick={() => onSelectFullRow(rowIndex)}
        onContextMenu={(e) => onRowContextMenu(e, test.id, rowIndex)}
        className={`p-2 text-center font-bold border-r border-border/20 sticky left-0 z-20 w-12 font-mono cursor-pointer select-none transition-colors ${
          isFullRowSelected
            ? 'bg-cyan-600/40 text-cyan-300 ring-2 ring-cyan-500 z-30'
            : 'bg-muted dark:bg-[#0f1520] text-foreground dark:text-cyan-400/90 hover:bg-cyan-500/20'
        }`}
        title="Clic para seleccionar fila | Clic derecho para opciones (Duplicar, Insertar)"
      >
        {test.id}
      </td>

      {/* 2. Id de Servicio */}
      <td className="p-1 border-r border-border/20">{renderCellInput(2, 'idServicio')}</td>
      {/* 3. Plataforma */}
      <td className="p-1 border-r border-border/20">{renderCellInput(3, 'plataforma')}</td>
      {/* 4. Servicio Tecnológico */}
      <td className="p-1 border-r border-border/20">{renderCellInput(4, 'servicioTecnologico')}</td>
      {/* 5. Id de Prueba de Seguridad */}
      <td className="p-1 border-r border-border/20 font-bold">{renderCellInput(5, 'idPruebaSeguridad', 'text', undefined, undefined, 'font-bold text-foreground')}</td>
      {/* 6. Evaluación Asociada */}
      <td className="p-1 border-r border-border/20">{renderCellInput(6, 'evaluacionAsociada')}</td>
      {/* 7. Categoria */}
      <td className="p-1 border-r border-border/20">{renderCellInput(7, 'categoria')}</td>
      {/* 8. Nombre de la Prueba */}
      <td className="p-1 border-r border-border/20">{renderCellInput(8, 'nombrePrueba', 'text', undefined, undefined, 'font-semibold font-sans text-foreground')}</td>

      {/* 9. Resultado / Estado */}
      <td className="p-1 border-r border-border/20">
        {isEditingCell && focusedColIndex === 9 ? (
          <select
            id={`cell-${rowIndex}-9`}
            value={test.resultadoPrueba}
            onChange={(e) => {
              onMatrixCellUpdate(test.id, 'resultadoPrueba', e.target.value);
              setIsEditingCell(false);
              setTimeout(() => {
                const el = document.getElementById(`cell-${rowIndex}-9`);
                el?.focus();
              }, 0);
            }}
            onBlur={() => setIsEditingCell(false)}
            className={`w-full h-7 rounded border border-border/40 bg-background/50 px-1 text-[10px] font-bold focus:ring-1 focus:ring-cyan-500 focus:outline-none ${
              test.resultadoPrueba === 'FAILED'
                ? 'text-rose-500'
                : test.resultadoPrueba === 'PASSED'
                  ? 'text-emerald-500'
                  : 'text-muted-foreground'
            }`}
          >
            <option value="PENDING">PENDING</option>
            <option value="PASSED">PASSED</option>
            <option value="FAILED">FAILED</option>
            <option value="Out Of Scope">Out Of Scope</option>
          </select>
        ) : (
          <div
            id={`cell-${rowIndex}-9`}
            tabIndex={0}
            onFocus={() => onSetFocusedCell({ rowIndex, colIndex: 9 })}
            onClick={() => onCellClick(rowIndex, 9)}
            onDoubleClick={onStartEditing}
            className={`w-full h-7 flex items-center rounded px-2 text-[10px] font-bold cursor-pointer select-none focus:outline-none ${
              focusedColIndex === 9
                ? 'ring-2 ring-cyan-500/80 bg-background/50 border-cyan-500/50'
                : ''
            } ${
              test.resultadoPrueba === 'FAILED'
                ? 'text-rose-500 bg-rose-500/10'
                : test.resultadoPrueba === 'PASSED'
                  ? 'text-emerald-500 bg-emerald-500/10'
                  : 'text-muted-foreground bg-muted/20'
            }`}
          >
            {test.resultadoPrueba}
          </div>
        )}
      </td>

      {/* 10. Comentarios */}
      <td className="p-1 border-r border-border/20">{renderCellInput(10, 'comentariosPrueba', 'text', undefined, undefined, 'font-sans')}</td>
      {/* 11. Clasificación */}
      <td className="p-1 border-r border-border/20">{renderCellInput(11, 'clasificacion')}</td>
      {/* 12. Nombre Hallazgo */}
      <td className="p-1 border-r border-border/20">{renderCellInput(12, 'nombreHallazgo', 'text', undefined, undefined, 'font-semibold font-sans text-foreground')}</td>
      {/* 13. Descripción */}
      <td className="p-1 border-r border-border/20">{renderCellInput(13, 'descripcionPrueba', 'text', undefined, undefined, 'font-sans')}</td>
      {/* 14. Single Target */}
      <td className="p-1 border-r border-border/20">{renderCellInput(14, 'singleTarget', 'text', undefined, undefined, 'text-cyan-600 dark:text-cyan-400 font-bold')}</td>

      {/* 15. Comando Bulk */}
      <td className="p-1 border-r border-border/20">
        <div className={`flex items-center gap-1.5 bg-muted dark:bg-[#0a0f16]/95 px-2 py-1 rounded border border-border/20 max-w-full ${
          focusedColIndex === 15 ? 'ring-2 ring-cyan-500/80 bg-background/50 border-cyan-500/50' : ''
        }`}>
          {renderCellInput(15, 'comandoBulk', 'text', undefined, undefined, 'font-mono text-[9px] text-indigo-600 dark:text-[#a5b4fc] bg-transparent border-none outline-none grow min-w-0 p-0 focus:ring-0 focus:bg-transparent')}
          {test.comandoBulk && (
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile),
                  `matrix-b-${test.id}`
                )
              }
              className="shrink-0 p-1 text-muted-foreground hover:text-cyan-400 rounded bg-background/80 border border-border/40 transition-colors"
              title="Copiar Comando Bulk"
            >
              {copiedId === `matrix-b-${test.id}` ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          )}
        </div>
      </td>

      {/* 16. Targets File */}
      <td className="p-1 border-r border-border/20">{renderCellInput(16, 'targetsFile', 'text', undefined, undefined, 'text-indigo-600 dark:text-indigo-400')}</td>

      {/* 17. Comando Single */}
      <td className="p-1 border-r border-border/20">
        <div className={`flex items-center gap-1.5 bg-muted dark:bg-[#0a0f16]/95 px-2 py-1 rounded border border-border/20 max-w-full ${
          focusedColIndex === 17 ? 'ring-2 ring-cyan-500/80 bg-background/50 border-cyan-500/50' : ''
        }`}>
          {renderCellInput(17, 'comandoSingle', 'text', undefined, undefined, 'font-mono text-[9px] text-indigo-600 dark:text-[#a5b4fc] bg-transparent border-none outline-none grow min-w-0 p-0 focus:ring-0 focus:bg-transparent')}
          {test.comandoSingle && (
            <button
              type="button"
              onClick={() =>
                copyToClipboard(
                  substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile),
                  `matrix-s-${test.id}`
                )
              }
              className="shrink-0 p-1 text-muted-foreground hover:text-cyan-400 rounded bg-background/80 border border-border/40 transition-colors"
              title="Copiar Comando Single Target"
            >
              {copiedId === `matrix-s-${test.id}` ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          )}
        </div>
      </td>

      {/* 18. Filtro Burp History */}
      <td className="p-1 border-r border-border/20">{renderCellInput(18, 'filtroBurpHistory')}</td>
      {/* 19. Filtro Burp Search */}
      <td className="p-1 border-r border-border/20">{renderCellInput(19, 'filtroBurpSearch')}</td>
      {/* 20. Burp Suite File */}
      <td className="p-1 border-r border-border/20">{renderCellInput(20, 'burpSuiteFile')}</td>
      {/* 21. Comando Burp File */}
      <td className="p-1 border-r border-border/20">{renderCellInput(21, 'comandoBurpFile')}</td>
      {/* 22. Snippet Developer Console */}
      <td className="p-1 border-r border-border/20">{renderCellInput(22, 'snippetDeveloperConsole')}</td>

      {/* 23-34. Evidencias [1-6] Imagen y Nota */}
      {[0, 1, 2, 3, 4, 5].map((idx) => {
        const imgCol = 23 + idx * 2;
        const notaCol = 24 + idx * 2;
        return (
          <React.Fragment key={idx}>
            <td className="p-1 border-r border-border/20">
              {renderCellInput(imgCol, undefined, 'text', undefined, `Evidencia ${idx + 1}.png`, '', true, idx, 'imagen')}
            </td>
            <td className="p-1 border-r border-border/20">
              {renderCellInput(notaCol, undefined, 'text', undefined, `Nota ${idx + 1}`, '', true, idx, 'nota')}
            </td>
          </React.Fragment>
        );
      })}

      {/* 35. Herramienta Sugerida */}
      <td className="p-1 border-r border-border/20">{renderCellInput(35, 'herramientaSugerida')}</td>
      {/* 36. Herramienta Incluye Prueba */}
      <td className="p-1 border-r border-border/20">{renderCellInput(36, 'herramientaIncluyePrueba')}</td>
      {/* 37. Referencias */}
      <td className="p-1 border-r border-border/20">{renderCellInput(37, 'referencias')}</td>
      {/* 38. MITRE Táctica */}
      <td className="p-1 border-r border-border/20">{renderCellInput(38, 'mitreTactica')}</td>
      {/* 39. MITRE Técnica */}
      <td className="p-1 border-r border-border/20">{renderCellInput(39, 'mitreTecnica')}</td>
      {/* 40. ID MITRE */}
      <td className="p-1 border-r border-border/20">{renderCellInput(40, 'mitreId')}</td>
      {/* 41. Folio2 */}
      <td className="p-1 border-r border-border/20">{renderCellInput(41, 'folio2')}</td>
      {/* 42. Fecha Detección */}
      <td className="p-1 border-r border-border/20">{renderCellInput(42, 'fechaDeteccion')}</td>
      {/* 43. Nombre Activo Tecnológico */}
      <td className="p-1 border-r border-border/20">{renderCellInput(43, 'nombreActivoTecnologico')}</td>
      {/* 44. Servicio Seguridad Asociado */}
      <td className="p-1 border-r border-border/20">{renderCellInput(44, 'servicioSeguridadAsociado')}</td>
      {/* 45. Tipo Revisión */}
      <td className="p-1 border-r border-border/20">{renderCellInput(45, 'tipoRevision')}</td>
      {/* 46. Activo Objetivo Prueba Seguridad */}
      <td className="p-1 border-r border-border/20">{renderCellInput(46, 'activoObjetivoPruebaSeguridad')}</td>
      {/* 47. Nombre Prueba Seguridad */}
      <td className="p-1 border-r border-border/20">{renderCellInput(47, 'nombrePruebaSeguridad')}</td>
      {/* 48. Descripcion Prueba Seguridad */}
      <td className="p-1 border-r border-border/20">{renderCellInput(48, 'descripcionPruebaSeguridad')}</td>
      {/* 49. Resultado Prueba 2 */}
      <td className="p-1 border-r border-border/20">{renderCellInput(49, 'resultadoPrueba2')}</td>
      {/* 50. Evidencia Principal */}
      <td className="p-1 border-r border-border/20">{renderCellInput(50, 'evidenciaPrincipal')}</td>
      {/* 51. Notas Prueba Seguridad */}
      <td className="p-1 border-r border-border/20">{renderCellInput(51, 'notasPruebaSeguridad')}</td>
      {/* 52. Evidencia Complementaria 1 */}
      <td className="p-1 border-r border-border/20">{renderCellInput(52, 'evidenciaComplementaria1')}</td>
      {/* 53. Evidencia Complementaria 2 */}
      <td className="p-1 border-r border-border/20">{renderCellInput(53, 'evidenciaComplementaria2')}</td>
      {/* 54. Evidencia Complementaria 3 */}
      <td className="p-1 border-r border-border/20">{renderCellInput(54, 'evidenciaComplementaria3')}</td>
      {/* 55. Descripcion */}
      <td className="p-1 border-r border-border/20">{renderCellInput(55, 'descripcion')}</td>
      {/* 56. Amenaza */}
      <td className="p-1 border-r border-border/20">{renderCellInput(56, 'amenaza', 'text', undefined, undefined, 'font-sans')}</td>
      {/* 57. Recomendaciones */}
      <td className="p-1 border-r border-border/20">{renderCellInput(57, 'recomendaciones', 'text', undefined, undefined, 'font-sans')}</td>
      {/* 58. Prueba de Concepto */}
      <td className="p-1 border-r border-border/20">{renderCellInput(58, 'poc', 'text', undefined, undefined, 'font-sans')}</td>
      {/* 59. CWE */}
      <td className="p-1 border-r border-border/20 font-bold">{renderCellInput(59, 'cwe', 'text', undefined, undefined, 'font-bold')}</td>
      {/* 60. FQDN */}
      <td className="p-1 border-r border-border/20">{renderCellInput(60, 'fqdn', 'text', undefined, undefined, 'text-cyan-600 dark:text-cyan-400')}</td>
      {/* 61. Ambiente */}
      <td className="p-1 border-r border-border/20">{renderCellInput(61, 'ambiente')}</td>
      {/* 62. CVSS Score */}
      <td className="p-1 border-r border-border/20">{renderCellInput(62, 'cvssScore', 'number', '0.1', undefined, 'text-center font-bold text-rose-400')}</td>
      {/* 63. CVSS Vector */}
      <td className="p-1 border-r border-border/20">{renderCellInput(63, 'cvssVector', 'text', undefined, undefined, 'text-muted-foreground font-light text-[9px]')}</td>
    </tr>
  );
}, areRowPropsEqual);

interface SecurityTestsActivePageProps {
  embedded?: boolean;
  serviceType?: string;
  serviceName?: string;
}

export function SecurityTestsActivePage({
  embedded = false,
  serviceType,
  serviceName,
}: SecurityTestsActivePageProps) {
  const [instances, setInstances] = useState<ActiveTestSuiteInstance[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTests, setSearchTests] = useState('');
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);

  // View mode: 'cards' or 'matrix'
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('matrix');

  // Form State for new suite instance
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteProject, setNewSuiteProject] = useState('');

  // Editing state for card details
  const [editingTestId, setEditingTestId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<SecurityTestItem>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sorting state for matrix columns
  const [sortConfig, setSortConfig] = useState<{ key: keyof SecurityTestItem; direction: 'asc' | 'desc' } | null>(null);

  // Multi-row selection state
  const [selectedTestIds, setSelectedTestIds] = useState<number[]>([]);

  // Row and Column full selection states
  const [selectedFullRowIndex, setSelectedFullRowIndex] = useState<number | null>(null);
  const [selectedFullColIndex, setSelectedFullColIndex] = useState<number | null>(null);

  // Google Sheets UI States & Themes
  type ExcelExportTheme = 'spectre' | 'hackthebox' | 'adasecure' | 'bishopfox';
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASSED' | 'FAILED' | 'PENDING' | 'Out Of Scope'>('ALL');
  const [activeTopMenu, setActiveTopMenu] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [excelExportTheme, setExcelExportTheme] = useState<ExcelExportTheme>('spectre');
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Vertical Detail Drawer Inspection Sheet State
  const [detailDrawerTestId, setDetailDrawerTestId] = useState<number | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'general' | 'targets' | 'burp' | 'mitre' | 'evidencias' | 'extendidos'>('general');

  const THEME_CONFIGS: Record<ExcelExportTheme, {
    name: string;
    description: string;
    headerEvidencias: string;
    headerComandos: string;
    headerMitre: string;
    headerHallazgos: string;
    headerStatus: string;
    headerScore: string;
    headerGeneral: string;
    headerTextColor: string;
    bgRowEven: string;
    bgRowOdd: string;
    passedBg: string;
    passedText: string;
    failedBg: string;
    failedText: string;
  }> = useMemo(() => ({
    spectre: {
      name: 'Spectre Corporate (Cyber Navy & Teal)',
      description: 'Estilo corporativo oficial con tonos azul marino, teal y secciones coloreadas.',
      headerEvidencias: '#6b21a8',
      headerComandos: '#0f766e',
      headerMitre: '#b45309',
      headerHallazgos: '#991b1b',
      headerStatus: '#3730a3',
      headerScore: '#065f46',
      headerGeneral: '#1e293b',
      headerTextColor: '#ffffff',
      bgRowEven: '#ffffff',
      bgRowOdd: '#f8fafc',
      passedBg: '#dcfce7',
      passedText: '#15803d',
      failedBg: '#fee2e2',
      failedText: '#b91c1c',
    },
    hackthebox: {
      name: 'HackTheBox (Neon Green & Cyber Dark)',
      description: 'Tema ofensivo cibernético inspirado en la plataforma HackTheBox con verdes neón y contrastes oscuros.',
      headerEvidencias: '#059669',
      headerComandos: '#10b981',
      headerMitre: '#047857',
      headerHallazgos: '#dc2626',
      headerStatus: '#0284c7',
      headerScore: '#059669',
      headerGeneral: '#0f172a',
      headerTextColor: '#a7f3d0',
      bgRowEven: '#ffffff',
      bgRowOdd: '#f0fdf4',
      passedBg: '#bbf7d0',
      passedText: '#047857',
      failedBg: '#fecdd3',
      failedText: '#9f1239',
    },
    adasecure: {
      name: 'AdaSecure (Crimson Red & Platinum Light)',
      description: 'Tema corporativo sofisticado AdaSecure basado en tonalidades claras con acentos carmesí e hipervínculos azules.',
      headerEvidencias: '#9f1239',
      headerComandos: '#be123c',
      headerMitre: '#9a3412',
      headerHallazgos: '#881337',
      headerStatus: '#e11d48',
      headerScore: '#15803d',
      headerGeneral: '#4c0519',
      headerTextColor: '#ffffff',
      bgRowEven: '#ffffff',
      bgRowOdd: '#fff1f2',
      passedBg: '#dcfce7',
      passedText: '#166534',
      failedBg: '#fecdd3',
      failedText: '#9f1239',
    },
    bishopfox: {
      name: 'BishopFox (Fox Red & Charcoal Black)',
      description: 'Estilo auditoría técnica inspirada en BishopFox con rojo carmesí, carbón mate e hipervínculos azules deslumbrantes.',
      headerEvidencias: '#b91c1c',
      headerComandos: '#dc2626',
      headerMitre: '#c2410c',
      headerHallazgos: '#991b1b',
      headerStatus: '#ef4444',
      headerScore: '#047857',
      headerGeneral: '#18181b',
      headerTextColor: '#ffffff',
      bgRowEven: '#ffffff',
      bgRowOdd: '#f4f4f5',
      passedBg: '#dcfce7',
      passedText: '#15803d',
      failedBg: '#fee2e2',
      failedText: '#991b1b',
    },
  }), []);

  // Row and Column Context Menus
  const [rowContextMenu, setRowContextMenu] = useState<{ x: number; y: number; testId: number; rowIndex: number } | null>(null);
  const [colContextMenu, setColContextMenu] = useState<{ x: number; y: number; colIndex: number } | null>(null);

  // Excel grid cell focus/navigation and edit mode state
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [isEditingCell, setIsEditingCell] = useState<boolean>(false);

  // Focus a specific cell input helper (Sub-millisecond 60 FPS instant navigation)
  const focusCell = useCallback((rIndex: number, cIndex: number) => {
    setFocusedCell({ rowIndex: rIndex, colIndex: cIndex });
    setSelectionAnchor({ rowIndex: rIndex, colIndex: cIndex });
    setSelectionHead({ rowIndex: rIndex, colIndex: cIndex });
    setSelectionRange({ startRow: rIndex, endRow: rIndex, startCol: cIndex, endCol: cIndex });
    setIsEditingCell(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(`cell-${rIndex}-${cIndex}`);
      if (el) {
        el.focus({ preventScroll: true });
        if (el instanceof HTMLInputElement) {
          el.select();
        }
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    });
  }, []);

  // Multi-cell range selection state (Excel style click & drag)
  const [selectionAnchor, setSelectionAnchor] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [selectionHead, setSelectionHead] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  } | null>(null);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  // Mouse drag selection handlers
  const handleCellMouseDown = (rIndex: number, cIndex: number, e: React.MouseEvent) => {
    if (e.shiftKey && focusedCell) {
      const startRow = Math.min(focusedCell.rowIndex, rIndex);
      const endRow = Math.max(focusedCell.rowIndex, rIndex);
      const startCol = Math.min(focusedCell.colIndex, cIndex);
      const endCol = Math.max(focusedCell.colIndex, cIndex);
      setSelectionAnchor(focusedCell);
      setSelectionHead({ rowIndex: rIndex, colIndex: cIndex });
      setSelectionRange({ startRow, endRow, startCol, endCol });
      return;
    }

    setFocusedCell({ rowIndex: rIndex, colIndex: cIndex });
    setIsEditingCell(false);
    setSelectionAnchor({ rowIndex: rIndex, colIndex: cIndex });
    setSelectionHead({ rowIndex: rIndex, colIndex: cIndex });
    setSelectionRange({ startRow: rIndex, endRow: rIndex, startCol: cIndex, endCol: cIndex });
    setIsDraggingSelection(true);
  };

  const handleCellMouseEnter = (rIndex: number, cIndex: number) => {
    if (!isDraggingSelection || !selectionAnchor) return;
    const startRow = Math.min(selectionAnchor.rowIndex, rIndex);
    const endRow = Math.max(selectionAnchor.rowIndex, rIndex);
    const startCol = Math.min(selectionAnchor.colIndex, cIndex);
    const endCol = Math.max(selectionAnchor.colIndex, cIndex);
    setSelectionHead({ rowIndex: rIndex, colIndex: cIndex });
    setSelectionRange({ startRow, endRow, startCol, endCol });
  };

  // Window mouseup listener to end drag selection
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDraggingSelection(false);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleCellClick = (rIndex: number, cIndex: number) => {
    setFocusedCell({ rowIndex: rIndex, colIndex: cIndex });
    setIsEditingCell(false);
  };

  // Excel columns dynamic widths state (64 items: Checkbox + 63 columns)
  const [colWidths, setColWidths] = useState<number[]>([
    35,   // 0. Checkbox
    45,   // 1. Id
    180,  // 2. Id de Servicio
    95,   // 3. Plataforma
    120,  // 4. Servicio Tecnológico
    150,  // 5. Id de Prueba de Seguridad
    220,  // 6. Evaluación Asociada
    150,  // 7. Categoria
    280,  // 8. Nombre de la Prueba
    130,  // 9. Resultado de la Prueba / Estado de la Prueba
    220,  // 10. Comentarios de la Prueba
    130,  // 11. Clasificación
    220,  // 12. Nombre de Hallazgo
    280,  // 13. Descripción de la Prueba
    150,  // 14. Single Target
    280,  // 15. Prueba con Comando de Terminal Sugerido Para Bulk Targets
    120,  // 16. Targets File
    280,  // 17. Prueba con Comando de Terminal Sugerido Para Single Target
    250,  // 18. Verificación con Filtro de BurpSuite HTTP History Sugerido
    250,  // 19. Verificación con Filtro de BurpSuite Search Sugerido
    150,  // 20. BurpSuite File
    250,  // 21. Verificación con Comándo de Terminal Sugerido Para BurpSuite File
    250,  // 22. Verificación con Snippet de Consola de Desarrollador en Navegador con Archivo HAR
    // 23-34. Evidencias
    140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140,
    140,  // 35. Herramienta Sugerida
    180,  // 36. Herramienta que Incluye la Prueba
    200,  // 37. Referencias
    150,  // 38. Táctica MITRE
    150,  // 39. Técnica MITRE
    120,  // 40. ID MITRE
    110,  // 41. Folio2
    120,  // 42. Fecha de detección
    160,  // 43. Nombre de activo tecnológico
    160,  // 44. Servicio de seguridad asociado
    120,  // 45. Tipo de revisión
    160,  // 46. Activo objetivo de prueba de seguridad
    180,  // 47. Nombre de prueba seguridad
    220,  // 48. Descripción de la prueba de seguridad
    120,  // 49. Resultado de la prueba2
    150,  // 50. Evidencia principal
    180,  // 51. Notas de la prueba de seguridad
    140,  // 52. Evidencia complementaria 1
    140,  // 53. Evidencia complementaria 2
    140,  // 54. Evidencia complementaria 3
    220,  // 55. Descripción
    180,  // 56. Amenaza
    220,  // 57. Recomendaciones
    220,  // 58. Prueba de Concepto
    100,  // 59. CWE
    150,  // 60. FQDN
    120,  // 61. Ambiente
    100,  // 62. CVSS Score
    180   // 63. CVSS Vector
  ]);

  // Load from backend API (with localStorage fallback) on mount & sync across network devices
  useEffect(() => {
    let isSubscribed = true;

    const loadServerSuites = async () => {
      try {
        const res = await fetch('/api/pruebas-seguridad/suites');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.instances) && data.instances.length > 0) {
            if (isSubscribed) {
              setInstances(data.instances);
              localStorage.setItem('spectre_active_test_suites', JSON.stringify(data.instances));
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch server matrix suites, falling back to localStorage:', err);
      }

      // Fallback to localStorage if server fetch failed or empty
      const saved = localStorage.getItem('spectre_active_test_suites');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isSubscribed && Array.isArray(parsed) && parsed.length > 0) {
            setInstances(parsed);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
    };

    loadServerSuites();

    // Cross-device network polling every 3 seconds (lightweight version-only check to prevent GC lag)
    let lastKnownVersion: number | null = null;
    const interval = setInterval(async () => {
      try {
        const vRes = await fetch('/api/pruebas-seguridad/suites?versionOnly=true');
        if (vRes.ok) {
          const vData = await vRes.json();
          if (vData.success && vData.version) {
            if (lastKnownVersion === null) {
              lastKnownVersion = vData.version;
              return;
            }
            if (vData.version !== lastKnownVersion) {
              lastKnownVersion = vData.version;
              const res = await fetch('/api/pruebas-seguridad/suites');
              if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.instances) && data.instances.length > 0) {
                  setInstances(data.instances);
                  localStorage.setItem('spectre_active_test_suites', JSON.stringify(data.instances));
                }
              }
            }
          }
        }
      } catch (_) {}
    }, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  // Real-Time Multi-Tab / Multi-Session BroadcastChannel & Storage Sync
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('spectre_matrix_sync');
        channel.onmessage = (event) => {
          if (event.data && event.data.type === 'MATRIX_UPDATE' && Array.isArray(event.data.instances)) {
            setInstances(event.data.instances);
          }
        };
      }
    } catch (err) {
      console.warn('BroadcastChannel error:', err);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'spectre_active_test_suites' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setInstances(parsed);
          }
        } catch (err) {
          console.error('Storage sync error:', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (channel) channel.close();
    };
  }, []);

  const selectedSuite = useMemo(() => {
    const raw = instances.find((inst) => inst.id === selectedSuiteId) || instances[0];
    if (!raw) return undefined;
    return {
      ...raw,
      tests: Array.isArray(raw.tests) ? raw.tests : [],
    };
  }, [instances, selectedSuiteId]);

  const activeSuiteId = selectedSuite?.id || selectedSuiteId;

  useEffect(() => {
    if (!selectedSuiteId && selectedSuite?.id) {
      setSelectedSuiteId(selectedSuite.id);
    }
  }, [selectedSuiteId, selectedSuite]);

  const [instancesHistory, setInstancesHistory] = useState<ActiveTestSuiteInstance[][]>([]);
  const [activeCanvasEvidence, setActiveCanvasEvidence] = useState<{
    testId: number;
    evidenceIdx: number;
  } | null>(null);

  // Helper to persist instances change with undo history, server API, and real-time broadcast
  const saveSuiteInstances = (newInsts: ActiveTestSuiteInstance[]) => {
    setInstances((prev) => {
      setInstancesHistory((hist) => {
        const next = [...hist, prev];
        if (next.length > 50) next.shift();
        return next;
      });
      return newInsts;
    });

    const jsonStr = JSON.stringify(newInsts);
    localStorage.setItem('spectre_active_test_suites', jsonStr);

    // Save to Server API for cross-device network persistence
    try {
      fetch('/api/pruebas-seguridad/suites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instances: newInsts }),
      }).catch((err) => console.warn('Failed to save to server matrix API:', err));
    } catch (_) {}

    // Broadcast across local browser tabs
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('spectre_matrix_sync');
        channel.postMessage({ type: 'MATRIX_UPDATE', instances: newInsts });
        channel.close();
      }
    } catch (_) {}
  };

  const undoMatrixChange = () => {
    setInstancesHistory((hist) => {
      if (hist.length === 0) return hist;
      const prevInstances = hist[hist.length - 1];
      setInstances(prevInstances);
      localStorage.setItem('spectre_active_test_suites', JSON.stringify(prevInstances));
      return hist.slice(0, hist.length - 1);
    });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportZip = async () => {
    if (!selectedSuite) return;
    setIsExporting(true);

    try {
      const JSZip = (await import('jszip')).default;
      const ExcelJS = (await import('exceljs')).default;

      const zip = new JSZip();
      const folderEvidencias = zip.folder('evidencias');

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Spectre Tech Grid Security Suite';
      workbook.lastModifiedBy = 'Spectre Tech Grid';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Matriz de Pruebas', {
        views: [{ showGridLines: true }],
      });

      const themeConfig = THEME_CONFIGS[excelExportTheme] || THEME_CONFIGS.spectre;

      // 1. Configure Columns
      ws.columns = EXCEL_HEADERS.slice(1).map((h, i) => ({
        header: h,
        key: `col_${i + 1}`,
        width: Math.max(15, Math.min(50, Math.floor((colWidths[i + 1] || 150) / 7))),
      }));

      // 2. Style Header Row (Row 1)
      const headerRow = ws.getRow(1);
      headerRow.height = 28;

      for (let c = 1; c < EXCEL_HEADERS.length; c++) {
        const cell = headerRow.getCell(c);
        let fillHex = themeConfig.headerGeneral.replace('#', '');
        if (c >= 23 && c <= 34) fillHex = themeConfig.headerEvidencias.replace('#', '');
        else if (c >= 10 && c <= 19) fillHex = themeConfig.headerComandos.replace('#', '');
        else if (c >= 35 && c <= 43) fillHex = themeConfig.headerMitre.replace('#', '');
        else if (c >= 44 && c <= 53) fillHex = themeConfig.headerHallazgos.replace('#', '');
        else if (c >= 7 && c <= 9) fillHex = themeConfig.headerStatus.replace('#', '');
        else if (c >= 54 && c <= 63) fillHex = themeConfig.headerScore.replace('#', '');

        const textHex = themeConfig.headerTextColor.replace('#', '');

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${fillHex.toUpperCase()}` },
        };

        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: `FF${textHex.toUpperCase()}` },
        };

        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left',
          wrapText: true,
        };

        cell.border = {
          top: { style: 'medium', color: { argb: 'FF475569' } },
          bottom: { style: 'medium', color: { argb: 'FF475569' } },
          left: { style: 'thin', color: { argb: 'FF475569' } },
          right: { style: 'thin', color: { argb: 'FF475569' } },
        };
      }

      // 3. Populate Data Rows & Apply Colors
      selectedSuite.tests.forEach((test, rIdx) => {
        const rowObj: Record<string, any> = {};
        for (let colIdx = 1; colIdx < EXCEL_HEADERS.length; colIdx++) {
          if (colIdx >= 23 && colIdx <= 34) {
            const evIdx = Math.floor((colIdx - 23) / 2);
            const isNote = (colIdx - 23) % 2 === 1;
            const ev = test.evidencias?.[evIdx];
            if (isNote) {
              rowObj[`col_${colIdx}`] = ev?.nota || '';
            } else {
              const rawImg = ev?.imagen || '';
              if (rawImg) {
                let filename = rawImg;
                if (rawImg.startsWith('data:image/')) {
                  const match = rawImg.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
                  const ext = match ? match[1] : 'png';
                  const base64Data = match ? match[2] : rawImg.replace(/^data:image\/\w+;base64,/, '');
                  filename = `evidencia_caso_${test.id}_${evIdx + 1}.${ext}`;
                  folderEvidencias?.file(filename, base64Data, { base64: true });
                }
                rowObj[`col_${colIdx}`] = {
                  text: `Ver Evidencia ${evIdx + 1}`,
                  hyperlink: `evidencias/${filename}`,
                  tooltip: `Ver Evidencia ${evIdx + 1}`,
                };
              } else {
                rowObj[`col_${colIdx}`] = '';
              }
            }
          } else if (colIdx === 9) {
            rowObj[`col_${colIdx}`] = String(test.resultadoPrueba || 'PENDING');
          } else if (colIdx === 10) {
            rowObj[`col_${colIdx}`] = substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile);
          } else if (colIdx === 13) {
            rowObj[`col_${colIdx}`] = substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile);
          } else {
            const val = getCellValue(test, colIdx);
            rowObj[`col_${colIdx}`] = val !== undefined && val !== null ? String(val) : '';
          }
        }

        const addedRow = ws.addRow(rowObj);
        addedRow.height = 22;

        const bgRowHex = (rIdx % 2 === 0 ? themeConfig.bgRowEven : themeConfig.bgRowOdd).replace('#', '');

        for (let colIdx = 1; colIdx < EXCEL_HEADERS.length; colIdx++) {
          const cell = addedRow.getCell(colIdx);
          let cellFillHex = bgRowHex;
          let fontObj: any = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
          let alignObj: any = { vertical: 'middle', horizontal: 'left' };

          // Status Column styling
          if (colIdx === 9) {
            const status = String(test.resultadoPrueba || 'PENDING');
            alignObj.horizontal = 'center';
            if (status === 'PASSED') {
              cellFillHex = themeConfig.passedBg.replace('#', '');
              fontObj = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${themeConfig.passedText.replace('#', '')}` } };
            } else if (status === 'FAILED') {
              cellFillHex = themeConfig.failedBg.replace('#', '');
              fontObj = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
            } else if (status === 'PENDING') {
              cellFillHex = 'FEF3C7';
              fontObj = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF92400E' } };
            } else {
              cellFillHex = 'F3E8FF';
              fontObj = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF6B21A8' } };
            }
          }

          // Hyperlink styling
          if (typeof cell.value === 'object' && cell.value !== null && 'hyperlink' in cell.value) {
            fontObj = { name: 'Calibri', size: 10, bold: true, underline: true, color: { argb: 'FF0000FF' } };
          }

          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${cellFillHex.toUpperCase()}` },
          };

          cell.font = fontObj;
          cell.alignment = alignObj;
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
        }
      });

      // 4. AutoFilter Across All 62 Columns
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: selectedSuite.tests.length + 1, column: EXCEL_HEADERS.length - 1 },
      };

      // 5. Generate Excel ArrayBuffer & Zip
      const buffer = await workbook.xlsx.writeBuffer();
      const safeSuiteName = selectedSuite.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      zip.file(`Matriz_Pruebas_Seguridad_${safeSuiteName}.xlsx`, buffer);

      // Generate ZIP archive
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger download
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Matriz_Pruebas_Seguridad_${safeSuiteName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al exportar ZIP con matriz y evidencias:', err);
    } finally {
      setIsExporting(false);
    }
  };
  const getCellValue = (test: SecurityTestItem, colIdx: number): string => {
    if (colIdx >= 23 && colIdx <= 34) {
      const idx = Math.floor((colIdx - 23) / 2);
      const isNote = (colIdx - 23) % 2 === 1;
      const ev = test.evidencias[idx];
      return isNote ? (ev?.nota || '') : (ev?.imagen || '');
    }
    const key = EXCEL_KEYS[colIdx];
    if (!key || key === 'id') return '';
    return String(test[key] ?? '');
  };

  const updateCellValue = (testId: number, colIdx: number, val: string) => {
    if (colIdx >= 23 && colIdx <= 34) {
      const idx = Math.floor((colIdx - 23) / 2);
      const isNote = (colIdx - 23) % 2 === 1;
      handleMatrixEvidenceUpdate(testId, idx, isNote ? 'nota' : 'imagen', val);
      return;
    }
    const key = EXCEL_KEYS[colIdx];
    if (!key || key === 'id') return;
    handleMatrixCellUpdate(testId, key, val);
  };

  // Create new methodology suite in catalog
  const handleCreateSuite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuiteName.trim()) return;

    const newSuite: ActiveTestSuiteInstance = {
      id: `suite-${Date.now()}`,
      name: newSuiteName.trim(),
      projectName: 'Catálogo Maestro',
      framework: newSuiteName.trim(),
      createdAt: new Date().toISOString().split('T')[0],
      tests: PRUEBAS_INITIAL.map((t) => ({
        ...t,
        resultadoPrueba: 'PENDING',
        comentariosPrueba: '',
        singleTarget: '',
        targetsFile: 'BurpItems.txt',
        evidencias: [],
      })),
    };

    const updated = [newSuite, ...instances];
    saveSuiteInstances(updated);
    setSelectedSuiteId(newSuite.id);
    setShowCreateModal(false);
    setNewSuiteName('');
    setNewSuiteProject('');
  };

  // Delete active suite
  const handleDeleteSuite = (id: string) => {
    const updated = instances.filter((s) => s.id !== id);
    saveSuiteInstances(updated);
    if (selectedSuiteId === id && updated.length > 0) {
      setSelectedSuiteId(updated[0].id);
    }
  };

  // Edit / Save details of a test case
  const startEditing = (test: SecurityTestItem) => {
    setEditingTestId(test.id);
    setEditForm({ ...test });
  };

  const saveEdit = () => {
    if (editingTestId === null || !selectedSuite) return;

    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) =>
          t.id === editingTestId ? ({ ...t, ...editForm } as SecurityTestItem) : t
        ),
      };
    });

    saveSuiteInstances(updated);
    setEditingTestId(null);
    setEditForm({});
  };

  // Inline Excel Cell Updates (Matrix mode)
  const handleMatrixCellUpdate = (testId: number, field: keyof SecurityTestItem, value: any) => {
    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) => (t.id === testId ? ({ ...t, [field]: value } as SecurityTestItem) : t)),
      };
    });
    saveSuiteInstances(updated);
  };

  // Inline Evidence array cell updates (Matrix mode)
  const handleMatrixEvidenceUpdate = (testId: number, idx: number, field: 'imagen' | 'nota', value: string) => {
    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) => {
          if (t.id !== testId) return t;
          const current = [...t.evidencias];
          while (current.length <= idx) {
            current.push({ imagen: '', nota: '' });
          }
          current[idx] = { ...current[idx], [field]: value };
          return { ...t, evidencias: current } as SecurityTestItem;
        }),
      };
    });
    saveSuiteInstances(updated);
  };

  // Add mock evidence item to editForm
  const addEvidence = () => {
    const currentEvidencias = editForm.evidencias || [];
    setEditForm((f) => ({
      ...f,
      evidencias: [
        ...currentEvidencias,
        { imagen: `EVIDENCIA_${currentEvidencias.length + 1}.png`, nota: '' },
      ],
    }));
  };

  const removeEvidence = (idx: number) => {
    const currentEvidencias = editForm.evidencias || [];
    setEditForm((f) => ({
      ...f,
      evidencias: currentEvidencias.filter((_, i) => i !== idx),
    }));
  };

  const updateEvidence = (idx: number, field: 'imagen' | 'nota', val: string) => {
    const currentEvidencias = editForm.evidencias || [];
    setEditForm((f) => ({
      ...f,
      evidencias: currentEvidencias.map((ev, i) =>
        i === idx ? { ...ev, [field]: val } : ev
      ),
    }));
  };

  // Filter test cases
  const filteredTests = useMemo(() => {
    if (!selectedSuite || !Array.isArray(selectedSuite.tests)) return [];
    return selectedSuite.tests.filter((t) => {
      const matchesSearch =
        t.idPruebaSeguridad.toLowerCase().includes(searchTests.toLowerCase()) ||
        t.nombrePrueba.toLowerCase().includes(searchTests.toLowerCase()) ||
        (t.nombreHallazgo || '').toLowerCase().includes(searchTests.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ? true : (t.resultadoPrueba || 'PENDING') === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [selectedSuite, searchTests, statusFilter]);

  // Header section category styling helper
  const getHeaderCategoryStyle = (c: number) => {
    if (c === 0) return 'bg-slate-900 text-slate-300 border-r-2 border-cyan-500/20';
    if (c === 1) return 'bg-slate-950 dark:bg-[#090e17] text-cyan-400 font-bold';
    if (c >= 23 && c <= 34) return 'bg-purple-950/95 dark:bg-[#3b0764] text-purple-200 font-bold border-b-2 border-purple-500/60';
    if (c >= 10 && c <= 19) return 'bg-teal-950/95 dark:bg-[#042f2e] text-teal-200 font-bold border-b-2 border-teal-500/40';
    if (c >= 35 && c <= 43) return 'bg-amber-950/95 dark:bg-[#451a03] text-amber-200 font-bold border-b-2 border-amber-500/40';
    if (c >= 44 && c <= 53) return 'bg-rose-950/95 dark:bg-[#4c0519] text-rose-200 font-bold border-b-2 border-rose-500/40';
    if (c >= 7 && c <= 9) return 'bg-indigo-950/95 dark:bg-[#1e1b4b] text-indigo-200 font-bold border-b-2 border-indigo-500/40';
    if (c >= 54 && c <= 63) return 'bg-emerald-950/95 dark:bg-[#064e3b] text-emerald-200 font-bold border-b-2 border-emerald-500/40';
    return 'bg-slate-900/90 dark:bg-[#0f172a] text-slate-200';
  };

  // Sorting keys mapping
  const EXCEL_KEYS = useMemo<(keyof SecurityTestItem)[]>(() => [
    'id', // Checkbox key (placeholder)
    'id',
    'idServicio',
    'plataforma',
    'servicioTecnologico',
    'idPruebaSeguridad',
    'evaluacionAsociada',
    'categoria',
    'nombrePrueba',
    'resultadoPrueba',
    'comentariosPrueba',
    'clasificacion',
    'nombreHallazgo',
    'descripcionPrueba',
    'singleTarget',
    'comandoBulk',
    'targetsFile',
    'comandoSingle',
    'filtroBurpHistory',
    'filtroBurpSearch',
    'burpSuiteFile',
    'comandoBurpFile',
    'snippetDeveloperConsole',
    // Evidencias placeholders
    'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id',
    'herramientaSugerida',
    'herramientaIncluyePrueba',
    'referencias',
    'mitreTactica',
    'mitreTecnica',
    'mitreId',
    'folio2',
    'fechaDeteccion',
    'nombreActivoTecnologico',
    'servicioSeguridadAsociado',
    'tipoRevision',
    'activoObjetivoPruebaSeguridad',
    'nombrePruebaSeguridad',
    'descripcionPruebaSeguridad',
    'resultadoPrueba2',
    'evidenciaPrincipal',
    'notasPruebaSeguridad',
    'evidenciaComplementaria1',
    'evidenciaComplementaria2',
    'evidenciaComplementaria3',
    'descripcion',
    'amenaza',
    'recomendaciones',
    'poc',
    'cwe',
    'fqdn',
    'ambiente',
    'cvssScore',
    'cvssVector'
  ], []);

  // Sort Routine
  const sortedTests = useMemo(() => {
    let items = [...filteredTests];
    if (sortConfig) {
      items.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [filteredTests, sortConfig]);

  const clipboardMemoryRef = useRef<string>('');

  const performCopy = (val: string, rowIndex: number, colIndex: number) => {
    clipboardMemoryRef.current = val;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(val).catch(() => {});
    }
    setCopiedId(`copy-cell-${rowIndex}-${colIndex}`);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const executeCopyAction = (rowIndex: number, colIndex: number) => {
    if (
      selectionRange &&
      (selectionRange.startRow !== selectionRange.endRow || selectionRange.startCol !== selectionRange.endCol)
    ) {
      const rowLines: string[] = [];
      const rowCount = selectionRange.endRow - selectionRange.startRow + 1;
      const colCount = selectionRange.endCol - selectionRange.startCol + 1;

      for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
        const rowTest = sortedTests[r];
        if (!rowTest) continue;
        const colVals: string[] = [];
        for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
          colVals.push(getCellValue(rowTest, c));
        }
        rowLines.push(colVals.join('\t'));
      }
      const rangeText = rowLines.join('\n');
      performCopy(rangeText, rowIndex, colIndex);
      showDebugLog(`📋 COPIADO RANGO: ${rowCount} filas x ${colCount} columnas (${rangeText.length} caracteres).`);
      return;
    }
    const currentTest = sortedTests[rowIndex];
    if (currentTest) {
      const val = getCellValue(currentTest, colIndex);
      performCopy(val, rowIndex, colIndex);
      showDebugLog(`📋 COPIADA 1 CELDA: "${val.slice(0, 30)}${val.length > 30 ? '...' : ''}"`);
    }
  };

  const performCut = (testId: number, colIndex: number, val: string, rowIndex: number) => {
    clipboardMemoryRef.current = val;
    const executeCut = () => {
      updateCellValue(testId, colIndex, '');
      setCopiedId(`cut-cell-${rowIndex}-${colIndex}`);
      setTimeout(() => setCopiedId(null), 1500);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(val)
        .then(executeCut)
        .catch(() => executeCut());
    } else {
      executeCut();
    }
  };

  const [debugLogMessage, setDebugLogMessage] = useState<string | null>(null);

  const showDebugLog = (msg: string) => {
    setDebugLogMessage(msg);
    setTimeout(() => setDebugLogMessage(null), 6000);
  };

  const makeEmptyTestRow = (id: number, suite?: ActiveTestSuiteInstance): SecurityTestItem => ({
    id,
    idServicio: suite?.projectName || '',
    plataforma: '',
    servicioTecnologico: '',
    idPruebaSeguridad: `CROS-WSTG-WEB-${String(id).padStart(2, '0')}`,
    evaluacionAsociada: suite?.framework || '',
    categoria: '',
    nombrePrueba: '',
    resultadoPrueba: '',
    comentariosPrueba: '',
    clasificacion: '',
    nombreHallazgo: '',
    descripcionPrueba: '',
    singleTarget: '',
    comandoBulk: '',
    targetsFile: '',
    comandoSingle: '',
    filtroBurpHistory: '',
    filtroBurpSearch: '',
    burpSuiteFile: '',
    comandoBurpFile: '',
    snippetDeveloperConsole: '',
    evidencias: [],
    herramientaSugerida: '',
    herramientaIncluyePrueba: '',
    referencias: '',
    mitreTactica: '',
    mitreTecnica: '',
    mitreId: '',
    cwe: '',
    fqdn: '',
    ambiente: '',
    cvssScore: 0,
    cvssVector: '',
  });

  const handleAddMultipleRows = (count: number = 5) => {
    if (!selectedSuite) return;
    const currentTests = [...selectedSuite.tests];
    const maxExistingId = currentTests.length > 0 ? Math.max(...currentTests.map((t) => t.id)) : 0;

    for (let i = 1; i <= count; i++) {
      const newId = maxExistingId + i;
      currentTests.push(makeEmptyTestRow(newId, selectedSuite));
    }

    const updated = instances.map((inst) =>
      inst.id === selectedSuiteId ? { ...inst, tests: currentTests } : inst
    );
    saveSuiteInstances(updated);
    setStatusFilter('ALL');
    setSearchTests('');

    showDebugLog(`➕ AGREGADAS ${count} NUEVAS FILAS. Total filas actual: ${currentTests.length}`);

    setTimeout(() => {
      focusCell(currentTests.length - 1, 5);
    }, 50);
  };

  const performPasteBlock = useCallback((startRowIndex: number, startColIndex: number, forceInsert: boolean = false) => {
    if (!selectedSuite) return;

    const executeBlockPaste = (rawText: string) => {
      const pasteText =
        rawText !== undefined && rawText !== null && rawText.trim() !== ''
          ? rawText
          : clipboardMemoryRef.current;

      if (!pasteText || pasteText.trim() === '') {
        showDebugLog('⚠️ PEGAR CANCELADO: Portapapeles vacío.');
        return;
      }

      // Split lines cleanly without stripping internal/empty tab columns
      const rawLines = pasteText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      if (rawLines.length > 1 && rawLines[rawLines.length - 1] === '') {
        rawLines.pop();
      }
      if (rawLines.length === 0) return;

      const grid = rawLines.map((l) => (l.includes('\t') ? l.split('\t') : [l]));

      showDebugLog(`⚡ INTENTANDO PEGAR: ${grid.length} filas x ${Math.max(...grid.map((r) => r.length))} cols. Filas previas: ${selectedSuite.tests.length}`);

      const targetSuite = selectedSuite || instances[0];
      if (!targetSuite) return;
      const targetSuiteId = targetSuite.id;

      let currentSuiteTests = [...targetSuite.tests];
      let maxExistingId =
        currentSuiteTests.length > 0 ? Math.max(...currentSuiteTests.map((t) => t.id)) : 0;

      const safeStartRowIdx = Math.max(0, startRowIndex ?? 0);
      const safeStartColIdx = Math.max(1, startColIndex ?? 1);

      const startTest = sortedTests[safeStartRowIdx];
      const targetSuiteIndex = startTest
        ? currentSuiteTests.findIndex((t) => t.id === startTest.id)
        : currentSuiteTests.length;
      let actualStartRow = targetSuiteIndex >= 0 ? targetSuiteIndex : currentSuiteTests.length;
      if (actualStartRow < 0) actualStartRow = 0;

      // Helper to generate a fresh SecurityTestItem
      const createNewTestRow = (): SecurityTestItem => {
        maxExistingId++;
        return makeEmptyTestRow(maxExistingId, targetSuite);
      };

      const shouldInsert = forceInsert || selectedFullRowIndex !== null;

      const applyCellToTest = (
        testItem: SecurityTestItem,
        targetColIdx: number,
        cellVal: string,
        isSingleCol: boolean
      ) => {
        if (targetColIdx >= 23 && targetColIdx <= 34) {
          const idx = Math.floor((targetColIdx - 23) / 2);
          const isNote = (targetColIdx - 23) % 2 === 1;
          const currentEvs = [...(testItem.evidencias || [])];
          while (currentEvs.length <= idx) {
            currentEvs.push({ imagen: '', nota: '' });
          }
          currentEvs[idx] = {
            ...currentEvs[idx],
            [isNote ? 'nota' : 'imagen']: cellVal,
          };
          testItem.evidencias = currentEvs;
        } else {
          let key = EXCEL_KEYS[targetColIdx];
          if (key === 'id') {
            if (isSingleCol || (cellVal && isNaN(Number(cellVal)))) {
              key = 'idPruebaSeguridad';
            }
          }
          if (key && key !== 'id') {
            (testItem as any)[key] = cellVal;
          }
        }
      };

      if (shouldInsert) {
        // Insert Mode (Shift+Ctrl+V / Menu Insert / Full Row Selection)
        const newRows: SecurityTestItem[] = [];
        for (let i = 0; i < grid.length; i++) {
          const newTestRow = createNewTestRow();
          const rowCells = grid[i];
          const isSingleCol = rowCells.length === 1;
          for (let cOffset = 0; cOffset < rowCells.length; cOffset++) {
            const targetColIdx = safeStartColIdx + cOffset;
            if (targetColIdx > 63) break;
            applyCellToTest(newTestRow, targetColIdx, rowCells[cOffset], isSingleCol);
          }
          newRows.push(newTestRow);
        }
        currentSuiteTests.splice(actualStartRow, 0, ...newRows);
      } else {
        // Standard Paste: Fill starting at actualStartRow & AUTO-EXPAND missing rows if needed
        const neededRowsCount = actualStartRow + grid.length;
        if (neededRowsCount > currentSuiteTests.length) {
          const missingCount = neededRowsCount - currentSuiteTests.length;
          for (let i = 0; i < missingCount; i++) {
            currentSuiteTests.push(createNewTestRow());
          }
        }

        currentSuiteTests = currentSuiteTests.map((t, rIdx) => {
          if (rIdx < actualStartRow || rIdx >= actualStartRow + grid.length) return t;
          const pasteRowIdx = rIdx - actualStartRow;
          const rowCells = grid[pasteRowIdx];
          if (!rowCells) return t;

          const newTest = { ...t };
          const isSingleCol = rowCells.length === 1;
          for (let cOffset = 0; cOffset < rowCells.length; cOffset++) {
            const targetColIdx = safeStartColIdx + cOffset;
            if (targetColIdx > 63) break;
            applyCellToTest(newTest, targetColIdx, rowCells[cOffset], isSingleCol);
          }
          return newTest as SecurityTestItem;
        });
      }

      const nextInstances = instances.map((inst) =>
        inst.id === targetSuiteId ? { ...inst, tests: currentSuiteTests } : inst
      );

      saveSuiteInstances(nextInstances);

      const endRow = actualStartRow + grid.length - 1;
      const maxColLen = Math.max(...grid.map((r) => r.length));
      const endCol = Math.min(63, safeStartColIdx + maxColLen - 1);

      setSelectionRange({
        startRow: actualStartRow,
        endRow,
        startCol: safeStartColIdx,
        endCol,
      });

      setTimeout(() => {
        const totalNow = currentSuiteTests.length;
        showDebugLog(`✅ PEGAZO EXITOSO: ${grid.length} fila(s) pegada(s)! Total filas actual: ${totalNow}.`);
        const lastCellEl = document.getElementById(`cell-${endRow}-${safeStartColIdx}`);
        lastCellEl?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }, 50);

      setStatusFilter('ALL');
      setSearchTests('');
    };

    if (navigator.clipboard?.readText) {
      navigator.clipboard.readText()
        .then((text) => {
          if (text && text.trim() !== '') {
            executeBlockPaste(text);
          } else {
            executeBlockPaste(clipboardMemoryRef.current);
          }
        })
        .catch(() => executeBlockPaste(clipboardMemoryRef.current));
    } else {
      executeBlockPaste(clipboardMemoryRef.current);
    }
  }, [selectedSuite, selectedSuiteId, sortedTests, selectedFullRowIndex, instances]);

  // Dismiss context menus & top menu on click anywhere
  useEffect(() => {
    const handleDismissMenu = () => {
      setRowContextMenu(null);
      setColContextMenu(null);
      setActiveTopMenu(null);
    };
    window.addEventListener('click', handleDismissMenu);
    return () => {
      window.removeEventListener('click', handleDismissMenu);
    };
  }, []);

  // Row and Column Context Menu Actions
  const handleDuplicateRow = (testId: number) => {
    if (!selectedSuite) return;
    const testIdx = selectedSuite.tests.findIndex((t) => t.id === testId);
    if (testIdx < 0) return;
    const targetTest = selectedSuite.tests[testIdx];
    const allIds = selectedSuite.tests.map((t) => t.id);
    const newId = (allIds.length > 0 ? Math.max(...allIds) : 0) + 1;

    const duplicatedTest: SecurityTestItem = {
      ...targetTest,
      id: newId,
      idPruebaSeguridad: `${targetTest.idPruebaSeguridad}_COPY`,
      evidencias: targetTest.evidencias.map((ev) => ({ ...ev })),
    };

    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      const currentTests = [...inst.tests];
      currentTests.splice(testIdx + 1, 0, duplicatedTest);
      return { ...inst, tests: currentTests };
    });

    saveSuiteInstances(updated);
    setRowContextMenu(null);
  };

  const handleInsertRowBelow = (testId: number) => {
    if (!selectedSuite) return;
    const testIdx = selectedSuite.tests.findIndex((t) => t.id === testId);
    if (testIdx < 0) return;
    const allIds = selectedSuite.tests.map((t) => t.id);
    const newId = (allIds.length > 0 ? Math.max(...allIds) : 0) + 1;

    const newTestRow = makeEmptyTestRow(newId, selectedSuite);

    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      const currentTests = [...inst.tests];
      currentTests.splice(testIdx + 1, 0, newTestRow);
      return { ...inst, tests: currentTests };
    });

    saveSuiteInstances(updated);
    setRowContextMenu(null);
  };

  const handleClearRowContent = (testId: number) => {
    if (!selectedSuite) return;
    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) => {
          if (t.id !== testId) return t;
          return {
            ...t,
            nombrePrueba: '',
            resultadoPrueba: 'PENDING',
            comentariosPrueba: '',
            clasificacion: '',
            nombreHallazgo: '',
            descripcionPrueba: '',
            singleTarget: '',
            comandoBulk: '',
            comandoSingle: '',
            filtroBurpHistory: '',
            filtroBurpSearch: '',
            burpSuiteFile: '',
            comandoBurpFile: '',
            snippetDeveloperConsole: '',
            evidencias: [],
            referencias: '',
            fqdn: '',
            cvssScore: 0,
            cvssVector: '',
          } as SecurityTestItem;
        }),
      };
    });

    saveSuiteInstances(updated);
    setRowContextMenu(null);
  };

  const handleDeleteSingleRow = (testId: number) => {
    if (!selectedSuite) return;
    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.filter((t) => t.id !== testId),
      };
    });

    saveSuiteInstances(updated);
    setRowContextMenu(null);
  };

  const handleClearColumnContent = (colIndex: number) => {
    if (!selectedSuite) return;
    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) => {
          if (colIndex >= 23 && colIndex <= 34) {
            const idx = Math.floor((colIndex - 23) / 2);
            const isNote = (colIndex - 23) % 2 === 1;
            const currentEvs = [...t.evidencias];
            if (currentEvs[idx]) {
              currentEvs[idx] = { ...currentEvs[idx], [isNote ? 'nota' : 'imagen']: '' };
            }
            return { ...t, evidencias: currentEvs };
          }
          const key = EXCEL_KEYS[colIndex];
          if (!key || key === 'id') return t;
          return { ...t, [key]: '' };
        }),
      };
    });

    saveSuiteInstances(updated);
    setColContextMenu(null);
  };

  const findExcelJumpTarget = (
    r: number,
    c: number,
    direction: 'Up' | 'Down' | 'Left' | 'Right'
  ): { rowIndex: number; colIndex: number } => {
    const isFilled = (rowIdx: number, colIdx: number) => {
      if (rowIdx < 0 || rowIdx >= sortedTests.length) return false;
      if (colIdx < 2 || colIdx > 63) return false;
      const t = sortedTests[rowIdx];
      if (!t) return false;
      const val = getCellValue(t, colIdx);
      return val !== undefined && val !== null && String(val).trim() !== '';
    };

    const currFilled = isFilled(r, c);

    if (direction === 'Up') {
      const nextFilled = isFilled(r - 1, c);
      if (currFilled && nextFilled) {
        let curr = r - 1;
        while (curr > 0 && isFilled(curr - 1, c)) {
          curr--;
        }
        return { rowIndex: Math.max(0, curr), colIndex: c };
      } else {
        let curr = r - 1;
        while (curr >= 0 && !isFilled(curr, c)) {
          curr--;
        }
        return { rowIndex: Math.max(0, curr), colIndex: c };
      }
    }

    if (direction === 'Down') {
      const maxRow = sortedTests.length - 1;
      const nextFilled = isFilled(r + 1, c);
      if (currFilled && nextFilled) {
        let curr = r + 1;
        while (curr < maxRow && isFilled(curr + 1, c)) {
          curr++;
        }
        return { rowIndex: Math.min(maxRow, curr), colIndex: c };
      } else {
        let curr = r + 1;
        while (curr <= maxRow && !isFilled(curr, c)) {
          curr++;
        }
        return { rowIndex: Math.min(maxRow, curr), colIndex: c };
      }
    }

    if (direction === 'Left') {
      const nextFilled = isFilled(r, c - 1);
      if (currFilled && nextFilled) {
        let curr = c - 1;
        while (curr > 2 && isFilled(r, curr - 1)) {
          curr--;
        }
        return { rowIndex: r, colIndex: Math.max(2, curr) };
      } else {
        let curr = c - 1;
        while (curr >= 2 && !isFilled(r, curr)) {
          curr--;
        }
        return { rowIndex: r, colIndex: Math.max(2, curr) };
      }
    }

    if (direction === 'Right') {
      const maxCol = 63;
      const nextFilled = isFilled(r, c + 1);
      if (currFilled && nextFilled) {
        let curr = c + 1;
        while (curr < maxCol && isFilled(r, curr + 1)) {
          curr++;
        }
        return { rowIndex: r, colIndex: Math.min(maxCol, curr) };
      } else {
        let curr = c + 1;
        while (curr <= maxCol && !isFilled(r, curr)) {
          curr++;
        }
        return { rowIndex: r, colIndex: Math.min(maxCol, curr) };
      }
    }

    return { rowIndex: r, colIndex: c };
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focusedCell) return;
    const { rowIndex, colIndex } = focusedCell;
    const currentTest = sortedTests[rowIndex];

    if (!isEditingCell) {
      if (e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === 'Escape' || e.key === 'Delete' || e.key === 'Backspace' || e.ctrlKey || e.metaKey) {
        e.stopPropagation();
      }
      // Ctrl+C Copy (Single cell or Multi-cell range block)
      if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        executeCopyAction(rowIndex, colIndex);
        return;
      }

      // Ctrl+X Cut
      if ((e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (currentTest) {
          const val = getCellValue(currentTest, colIndex);
          performCut(currentTest.id, colIndex, val, rowIndex);
        }
        return;
      }

      // Ctrl+V Paste
      if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        performPasteBlock(rowIndex, colIndex, e.shiftKey);
        return;
      }

      // Ctrl+Z Undo
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undoMatrixChange();
        return;
      }

      // Delete / Backspace / Supr to clear cell value, range selection, or full row / column
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectionRange && (selectionRange.startRow !== selectionRange.endRow || selectionRange.startCol !== selectionRange.endCol)) {
          const updated = instances.map((inst) => {
            if (inst.id !== activeSuiteId) return inst;
            return {
              ...inst,
              tests: inst.tests.map((t, rIdx) => {
                if (rIdx < selectionRange.startRow || rIdx > selectionRange.endRow) return t;
                let newTest = { ...t };
                for (let cIdx = selectionRange.startCol; cIdx <= selectionRange.endCol; cIdx++) {
                  if (cIdx >= 23 && cIdx <= 34) {
                    const idx = Math.floor((cIdx - 23) / 2);
                    const isNote = (cIdx - 23) % 2 === 1;
                    const currentEvs = [...newTest.evidencias];
                    if (currentEvs[idx]) {
                      currentEvs[idx] = { ...currentEvs[idx], [isNote ? 'nota' : 'imagen']: '' };
                    }
                    newTest.evidencias = currentEvs;
                  } else {
                    const key = EXCEL_KEYS[cIdx];
                    if (key && key !== 'id') {
                      newTest = { ...newTest, [key]: '' };
                    }
                  }
                }
                return newTest as SecurityTestItem;
              }),
            };
          });
          saveSuiteInstances(updated);
          return;
        }
        if (selectedFullRowIndex !== null && sortedTests[selectedFullRowIndex]) {
          handleClearRowContent(sortedTests[selectedFullRowIndex].id);
          return;
        }
        if (selectedFullColIndex !== null) {
          handleClearColumnContent(selectedFullColIndex);
          return;
        }
        if (currentTest) {
          updateCellValue(currentTest.id, colIndex, '');
        }
        return;
      }

      // Shift + Arrow Keys Keyboard Range Selection (Excel & Google Sheets style 2-point vector model)
      if (e.shiftKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const anchor = selectionAnchor || { rowIndex, colIndex };
        const head = selectionHead || { rowIndex, colIndex };

        if (!selectionAnchor) setSelectionAnchor(anchor);

        let newHeadRow = head.rowIndex;
        let newHeadCol = head.colIndex;

        if (e.key === 'ArrowUp') newHeadRow = Math.max(0, head.rowIndex - 1);
        else if (e.key === 'ArrowDown') newHeadRow = Math.min(sortedTests.length - 1, head.rowIndex + 1);
        else if (e.key === 'ArrowLeft') newHeadCol = Math.max(1, head.colIndex - 1);
        else if (e.key === 'ArrowRight') newHeadCol = Math.min(63, head.colIndex + 1);

        const updatedHead = { rowIndex: newHeadRow, colIndex: newHeadCol };
        setSelectionHead(updatedHead);

        const startRow = Math.min(anchor.rowIndex, updatedHead.rowIndex);
        const endRow = Math.max(anchor.rowIndex, updatedHead.rowIndex);
        const startCol = Math.min(anchor.colIndex, updatedHead.colIndex);
        const endCol = Math.max(anchor.colIndex, updatedHead.colIndex);

        setSelectionRange({ startRow, endRow, startCol, endCol });

        const targetEl = document.getElementById(`cell-${updatedHead.rowIndex}-${updatedHead.colIndex}`);
        targetEl?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        return;
      }

      // Normal Arrow navigation (clears multi-cell range selection)
      if (e.key.startsWith('Arrow')) {
        setSelectionAnchor(null);
        setSelectionHead(null);
        setSelectionRange(null);
      }

      // Navigation mode with exact Excel-style Ctrl / Cmd Arrow jumps
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const target = findExcelJumpTarget(rowIndex, colIndex, 'Up');
          focusCell(target.rowIndex, target.colIndex);
        } else {
          focusCell(Math.max(0, rowIndex - 1), colIndex);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const target = findExcelJumpTarget(rowIndex, colIndex, 'Down');
          focusCell(target.rowIndex, target.colIndex);
        } else {
          focusCell(Math.min(sortedTests.length - 1, rowIndex + 1), colIndex);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const target = findExcelJumpTarget(rowIndex, colIndex, 'Left');
          focusCell(target.rowIndex, target.colIndex);
        } else {
          focusCell(rowIndex, Math.max(2, colIndex - 1));
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          const target = findExcelJumpTarget(rowIndex, colIndex, 'Right');
          focusCell(target.rowIndex, target.colIndex);
        } else {
          focusCell(rowIndex, Math.min(63, colIndex + 1));
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          const targetRow = Math.max(0, rowIndex - 1);
          focusCell(targetRow, colIndex);
        } else {
          setIsEditingCell(true);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        (document.activeElement as HTMLElement)?.blur();
        setFocusedCell(null);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Typing a character starts editing
        setIsEditingCell(true);
      }
    } else {
      // Editing mode
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditingCell(false);
        // Refocus the cell so we can navigate
        setTimeout(() => {
          const el = document.getElementById(`cell-${rowIndex}-${colIndex}`);
          el?.focus();
        }, 0);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setIsEditingCell(false);
        // Move up or down like Excel
        const targetRow = e.shiftKey ? Math.max(0, rowIndex - 1) : Math.min(sortedTests.length - 1, rowIndex + 1);
        focusCell(targetRow, colIndex);
      }
    }
  };

  // Global window keydown listener for matrix navigation & shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (detailDrawerTestId !== null) {
        if (e.key === 'Escape') {
          setDetailDrawerTestId(null);
        }
        return;
      }
      if (activeCanvasEvidence || showCreateModal) return;
      if (viewMode !== 'matrix' || isEditingCell) return;

      const activeRowIndex = focusedCell
        ? focusedCell.rowIndex
        : (selectionRange
            ? selectionRange.startRow
            : (selectedFullRowIndex !== null ? selectedFullRowIndex : null));
      const activeColIndex = focusedCell
        ? focusedCell.colIndex
        : (selectionRange
            ? selectionRange.startCol
            : 1);

      if (activeRowIndex === null) return;
      const currentTest = sortedTests[activeRowIndex];

      // Ctrl+C Copy
      if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        executeCopyAction(activeRowIndex, activeColIndex);
        return;
      }

      // Ctrl+X Cut
      if ((e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey)) {
        if (currentTest) {
          e.preventDefault();
          const val = getCellValue(currentTest, activeColIndex);
          performCut(currentTest.id, activeColIndex, val, activeRowIndex);
        }
        return;
      }

      // Ctrl+V Paste
      if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        performPasteBlock(activeRowIndex, activeColIndex, e.shiftKey);
        return;
      }

      // Ctrl+Z Matrix Undo
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        undoMatrixChange();
        return;
      }

      // Delete / Backspace / Supr to clear cell value or full row / column
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (
          selectionRange &&
          (selectionRange.startRow !== selectionRange.endRow || selectionRange.startCol !== selectionRange.endCol)
        ) {
          e.preventDefault();
          const updated = instances.map((inst) => {
            if (inst.id !== activeSuiteId) return inst;
            return {
              ...inst,
              tests: inst.tests.map((t, rIdx) => {
                if (rIdx >= selectionRange.startRow && rIdx <= selectionRange.endRow) {
                  let updatedTest = { ...t };
                  for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
                    const key = EXCEL_KEYS[c];
                    if (key && key !== 'id') {
                      (updatedTest as any)[key] = '';
                    }
                  }
                  return updatedTest;
                }
                return t;
              }),
            };
          });
          saveSuiteInstances(updated);
          return;
        }

        if (currentTest && focusedCell) {
          e.preventDefault();
          updateCellValue(currentTest.id, activeColIndex, '');
          return;
        }
      }

      // Arrow Keys & Navigation (Excel style continuous step 1 cell by 1 cell, or Ctrl/Cmd + Arrow to jump)
      if (focusedCell || selectionRange || selectedFullRowIndex !== null) {
        const r = activeRowIndex;
        const c = activeColIndex;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            const target = findExcelJumpTarget(r, c, 'Up');
            focusCell(target.rowIndex, target.colIndex);
          } else {
            focusCell(Math.max(0, r - 1), c);
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            const target = findExcelJumpTarget(r, c, 'Down');
            focusCell(target.rowIndex, target.colIndex);
          } else {
            focusCell(Math.min(sortedTests.length - 1, r + 1), c);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            const target = findExcelJumpTarget(r, c, 'Left');
            focusCell(target.rowIndex, target.colIndex);
          } else {
            focusCell(r, Math.max(1, c - 1));
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            const target = findExcelJumpTarget(r, c, 'Right');
            focusCell(target.rowIndex, target.colIndex);
          } else {
            focusCell(r, Math.min(63, c + 1));
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [focusedCell, isEditingCell, viewMode, sortedTests, activeCanvasEvidence, showCreateModal, detailDrawerTestId, selectionRange, selectedFullRowIndex, performPasteBlock]);

  // Native window paste event handler
  useEffect(() => {
    const handleNativePaste = (e: ClipboardEvent) => {
      if (viewMode !== 'matrix' || isEditingCell || showCreateModal || detailDrawerTestId !== null) return;

      const activeRowIndex = focusedCell
        ? focusedCell.rowIndex
        : (selectionRange
            ? selectionRange.startRow
            : (selectedFullRowIndex !== null ? selectedFullRowIndex : null));
      const activeColIndex = focusedCell
        ? focusedCell.colIndex
        : (selectionRange
            ? selectionRange.startCol
            : 1);

      if (activeRowIndex === null) return;

      const pastedData = e.clipboardData?.getData('text');
      if (pastedData) {
        e.preventDefault();
        performPasteBlock(activeRowIndex, activeColIndex, (e as any).shiftKey || selectedFullRowIndex !== null);
      }
    };

    window.addEventListener('paste', handleNativePaste);
    return () => window.removeEventListener('paste', handleNativePaste);
  }, [viewMode, isEditingCell, showCreateModal, detailDrawerTestId, focusedCell, selectionRange, selectedFullRowIndex, performPasteBlock]);

  // Handle click header sorting
  const handleSort = (colIndex: number) => {
    if (colIndex === 0) return; // Checkbox column is not sortable
    const key = EXCEL_KEYS[colIndex];
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Drag-to-Resize Column handler
  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = colWidths[index] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(30, startWidth + (moveEvent.pageX - startX));
      setColWidths((prev) => {
        const updated = [...prev];
        updated[index] = newWidth;
        return updated;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Substitute target in command templates dynamically
  const substituteCommand = (rawCommand: string, target: string, file: string) => {
    if (!rawCommand) return '';
    let cmd = rawCommand;
    if (file) {
      cmd = cmd.replace(/BurpItems\.txt/g, file);
    }
    if (target) {
      cmd = cmd.replace(/\{\{TARGET\}\}/g, target);
    }
    return cmd;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Select rows helper
  const isAllSelected = sortedTests.length > 0 && selectedTestIds.length === sortedTests.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTestIds([]);
    } else {
      setSelectedTestIds(sortedTests.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkStatusChange = (status: string) => {
    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) =>
          selectedTestIds.includes(t.id) ? ({ ...t, resultadoPrueba: status } as SecurityTestItem) : t
        ),
      };
    });
    saveSuiteInstances(updated);
    setSelectedTestIds([]);
  };

  const handleBulkDelete = () => {
    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.filter((t) => !selectedTestIds.includes(t.id)),
      };
    });
    saveSuiteInstances(updated);
    setSelectedTestIds([]);
  };

  // Add Custom Row directly inside spreadsheet Matrix
  const handleAddMatrixRow = () => {
    if (!selectedSuite) return;
    const newId = Math.max(...selectedSuite.tests.map((t) => t.id), 0) + 1;
    const newTestRow: SecurityTestItem = {
      id: newId,
      idServicio: selectedSuite.projectName,
      plataforma: 'NETWORK',
      servicioTecnologico: 'HTTP/HTTPS',
      idPruebaSeguridad: `CUSTOM-TEST-${newId}`,
      evaluacionAsociada: selectedSuite.framework,
      categoria: 'Custom_Scans',
      nombrePrueba: 'Prueba ofensiva manual personalizada',
      resultadoPrueba: 'PENDING',
      comentariosPrueba: '',
      clasificacion: '',
      nombreHallazgo: '',
      descripcionPrueba: 'Descripción del análisis ofensivo realizado.',
      singleTarget: '',
      comandoBulk: '',
      targetsFile: 'BurpItems.txt',
      comandoSingle: '',
      filtroBurpHistory: '',
      filtroBurpSearch: '',
      burpSuiteFile: '',
      comandoBurpFile: '',
      snippetDeveloperConsole: '',
      evidencias: [],
      herramientaSugerida: 'Manual',
      herramientaIncluyePrueba: 'Spectre API',
      referencias: 'N/A',
      mitreTactica: 'Discovery',
      mitreTecnica: 'Manual Analysis',
      mitreId: 'T1018',
      cwe: 'CWE-200',
      fqdn: '',
      ambiente: 'Desarrollo',
      cvssScore: 0,
      cvssVector: '',
    };

    const updated = instances.map((inst) => {
      if (inst.id !== activeSuiteId) return inst;
      return {
        ...inst,
        tests: [...inst.tests, newTestRow],
      };
    });
    saveSuiteInstances(updated);
  };

  // CSV Export for Excel Matrix View
  const handleExportCSV = () => {
    if (!selectedSuite) return;
    const headers = [
      'Id',
      'ID de Servicio',
      'Plataforma',
      'Servicio Tecnológico',
      'ID Prueba Seguridad',
      'Nombre de Prueba',
      'Resultado/Estado',
      'Target',
      'Targets File',
      'Hallazgo',
      'CVSS Score',
      'Comentarios',
    ];

    const rows = selectedSuite.tests.map((t) => [
      t.id,
      t.idServicio,
      t.plataforma,
      t.servicioTecnologico,
      t.idPruebaSeguridad,
      t.nombrePrueba,
      t.resultadoPrueba,
      t.singleTarget,
      t.targetsFile,
      t.nombreHallazgo,
      t.cvssScore,
      t.comentariosPrueba,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedSuite.name.replace(/\s+/g, '_')}_matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const EXCEL_HEADERS = [
    '✓', // Column 0: Checkbox
    'Id',
    'Id de Servicio',
    'Plataforma',
    'Servicio Tecnológico',
    'Id de Prueba de Seguridad',
    'Evaluación Asociada',
    'Categoria',
    'Nombre de la Prueba',
    'Resultado de la Prueba / Estado de la Prueba',
    'Comentarios de la Prueba',
    'Clasificación',
    'Nombre de Hallazgo',
    'Descripción de la Prueba',
    'Single Target',
    'Prueba con Comando de Terminal Sugerido Para Bulk Targets',
    'Targets File',
    'Prueba con Comando de Terminal Sugerido Para Single Target',
    'Verificación con Filtro de BurpSuite HTTP History Sugerido',
    'Verificación con Filtro de BurpSuite Search Sugerido',
    'BurpSuite File',
    'Verificación con Comándo de Terminal Sugerido Para BurpSuite File',
    'Verificación con Snippet de Consola de Desarrollador en Navegador con Archivo HAR',
    'Evidencia 1 Imagen', 'Evidencia 1 Nota',
    'Evidencia 2 Imagen', 'Evidencia 2 Nota',
    'Evidencia 3 Imagen', 'Evidencia 3 Nota',
    'Evidencia 4 Imagen', 'Evidencia 4 Nota',
    'Evidencia 5 Imagen', 'Evidencia 5 Nota',
    'Evidencia 6 Imagen', 'Evidencia 6 Nota',
    'Herramienta Sugerida',
    'Herramienta que Incluye la Prueba',
    'Referencias',
    'Táctica MITRE',
    'Técnica MITRE',
    'ID MITRE',
    'Folio2',
    'Fecha de detección',
    'Nombre de activo tecnológico',
    'Servicio de seguridad asociado',
    'Tipo de revisión',
    'Activo objetivo de prueba de seguridad',
    'Nombre de prueba seguridad',
    'Descripción de la prueba de seguridad',
    'Resultado de la prueba2',
    'Evidencia principal',
    'Notas de la prueba de seguridad',
    'Evidencia complementaria 1',
    'Evidencia complementaria 2',
    'Evidencia complementaria 3',
    'Descripción',
    'Amenaza',
    'Recomendaciones',
    'Prueba de Concepto',
    'CWE',
    'FQDN',
    'Ambiente',
    'CVSS Score',
    'CVSS Vector',
  ];

  // Active Suite statistics
  const suiteStats = useMemo(() => {
    if (!selectedSuite) return { testsCount: 0, passedCount: 0, failedCount: 0, progressPercent: 0 };
    const testsCount = selectedSuite.tests.length;
    const passedCount = selectedSuite.tests.filter((t) => t.resultadoPrueba === 'PASSED').length;
    const failedCount = selectedSuite.tests.filter((t) => t.resultadoPrueba === 'FAILED').length;
    const progressPercent = testsCount > 0 ? Math.round(((passedCount + failedCount) / testsCount) * 100) : 0;
    return { testsCount, passedCount, failedCount, progressPercent };
  }, [selectedSuite]);

  return (
    <div className={cn(
      "p-2 md:p-3 max-w-[100%] mx-auto space-y-1.5 flex flex-col",
      embedded ? "min-h-[650px]" : "h-screen overflow-hidden"
    )}>
      {/* High-Density Header & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-card/80 border border-border/40 px-3 py-2 rounded-xl shrink-0 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-base font-bold text-foreground flex items-center gap-2 font-mono">
            <Shield className="size-5 text-cyan-500" />
            {embedded ? 'Service Test Execution Grid' : 'Security Test Catalog (Master Repository)'}
          </h1>

          <div className="h-4 w-px bg-border/40" />

          {/* Active Suite Selector */}
          <div className="flex items-center gap-1.5">
            <FolderOpen className="size-3.5 text-cyan-500 shrink-0" />
            <select
              value={selectedSuiteId}
              onChange={(e) => setSelectedSuiteId(e.target.value)}
              className="h-7 rounded border border-border/50 bg-background/60 px-2 text-xs text-foreground font-semibold focus:ring-1 focus:ring-cyan-500 focus:outline-none max-w-[320px] truncate"
            >
              {instances.map((inst) => {
                const displayName = inst.name === 'SCT' ? 'OWASP Web Security Suite' : inst.name;
                return (
                  <option key={inst.id} value={inst.id}>
                    {displayName} ({inst.framework || inst.projectName})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Live Row Count Badge */}
          <div className="px-2.5 py-1 bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold rounded-lg flex items-center gap-1.5 shadow-sm">
            <span className="size-2 rounded-full bg-cyan-400 animate-ping" />
            ⚡ Filas: {selectedSuite?.tests.length || 0}
          </div>

          <Button
            onClick={() => handleAddMultipleRows(5)}
            variant="outline"
            className="h-7 border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-400 font-semibold text-[11px] px-2.5 rounded flex items-center gap-1"
          >
            <Plus className="size-3.5 text-cyan-400" />
            +5 Filas
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-7 bg-cyan-600/90 hover:bg-cyan-600 text-white font-semibold text-[11px] px-2.5 rounded flex items-center gap-1"
          >
            <Plus className="size-3.5" />
            Nueva Suite
          </Button>

          {selectedSuite && (
            <button
              onClick={() => handleDeleteSuite(selectedSuite.id)}
              className="h-7 text-rose-400 hover:bg-rose-500/10 text-[10px] font-semibold flex items-center gap-1 px-2 rounded border border-rose-500/20 transition-all"
              title="Eliminar Suite activa"
            >
              <Trash2 className="size-3" />
              Eliminar
            </button>
          )}
        </div>

        {/* Right Stats & View Mode Badges */}
        <div className="flex items-center gap-3 font-mono text-[11px]">
          {selectedSuite && (
            <div className="flex items-center gap-2 bg-muted/30 px-2.5 py-1 rounded border border-border/30">
              <span className="text-muted-foreground text-[10px]">Total: <strong className="text-foreground">{suiteStats.testsCount}</strong></span>
              <span className="text-emerald-400 font-bold text-[10px]">PASSED: {suiteStats.passedCount}</span>
              <span className="text-rose-400 font-bold text-[10px]">FAILED: {suiteStats.failedCount}</span>
              <span className="text-cyan-400 font-bold text-[10px]">{suiteStats.progressPercent}%</span>
            </div>
          )}

          <div className="flex border border-border/40 bg-muted/40 rounded p-0.5 text-xs font-sans">
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all text-[11px] ${
                viewMode === 'matrix' ? 'bg-cyan-600 text-white font-semibold' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Table className="size-3" />
              Matriz Excel
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all text-[11px] ${
                viewMode === 'cards' ? 'bg-cyan-600 text-white font-semibold' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <LayoutGrid className="size-3" />
              Tarjetas
            </button>
          </div>
        </div>
      </div>

      {/* Google Sheets Attached Contextual Menu Toolbar (Directly attached above grid) */}
      <div
        className="bg-card dark:bg-[#090d16] border-t border-x border-border/40 rounded-t-xl px-2 py-1 flex flex-wrap items-center justify-between gap-2 text-xs select-none z-30 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Google Sheets Operative Menu Bar */}
        <div className="flex items-center gap-0.5 text-muted-foreground font-medium text-[11px]">
          {/* Archivo Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveTopMenu(activeTopMenu === 'archivo' ? null : 'archivo')}
              className={`px-2 py-0.5 rounded hover:bg-muted/80 hover:text-foreground transition-colors ${
                activeTopMenu === 'archivo' ? 'bg-muted text-foreground font-semibold' : ''
              }`}
            >
              Archivo
            </button>
            {activeTopMenu === 'archivo' && (
              <div className="absolute left-0 top-full mt-1 bg-card dark:bg-[#0c121e] border border-border rounded-lg shadow-xl p-1 min-w-56 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    handleExportZip();
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-emerald-500/10 hover:text-emerald-400 text-left font-semibold"
                >
                  <Download className="size-3.5 text-emerald-500" />
                  Exportar Matriz + Evidencias (.zip)
                </button>
                <button
                  onClick={() => {
                    setShowThemeModal(true);
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left font-semibold text-cyan-400"
                >
                  <Palette className="size-3.5 text-cyan-500" />
                  Configurar Tema de Exportación Excel
                </button>
                <button
                  onClick={() => {
                    handleExportCSV();
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <Table className="size-3.5 text-cyan-500" />
                  Exportar CSV
                </button>
                <div className="h-px bg-border/40 my-1" />
                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <Plus className="size-3.5 text-cyan-500" />
                  Nueva Suite
                </button>
              </div>
            )}
          </div>

          {/* Editar Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveTopMenu(activeTopMenu === 'editar' ? null : 'editar')}
              className={`px-2 py-0.5 rounded hover:bg-muted/80 hover:text-foreground transition-colors ${
                activeTopMenu === 'editar' ? 'bg-muted text-foreground font-semibold' : ''
              }`}
            >
              Editar
            </button>
            {activeTopMenu === 'editar' && (
              <div className="absolute left-0 top-full mt-1 bg-card dark:bg-[#0c121e] border border-border rounded-lg shadow-xl p-1 min-w-56 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    undoMatrixChange();
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="size-3.5 text-cyan-500" />
                    Deshacer
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Ctrl+Z</span>
                </button>
                <div className="h-px bg-border/40 my-1" />
                <button
                  onClick={() => {
                    if (focusedCell && sortedTests[focusedCell.rowIndex]) {
                      const t = sortedTests[focusedCell.rowIndex];
                      performCopy(getCellValue(t, focusedCell.colIndex), focusedCell.rowIndex, focusedCell.colIndex);
                    }
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <span className="flex items-center gap-2">
                    <Copy className="size-3.5 text-cyan-500" />
                    Copiar
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Ctrl+C</span>
                </button>
                <button
                  onClick={() => {
                    if (focusedCell && sortedTests[focusedCell.rowIndex]) {
                      const t = sortedTests[focusedCell.rowIndex];
                      performCut(t.id, focusedCell.colIndex, getCellValue(t, focusedCell.colIndex), focusedCell.rowIndex);
                    }
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <span className="flex items-center gap-2">
                    <Scissors className="size-3.5 text-cyan-500" />
                    Cortar
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Ctrl+X</span>
                </button>
                <button
                  onClick={() => {
                    if (focusedCell) {
                      performPasteBlock(focusedCell.rowIndex, focusedCell.colIndex);
                    }
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <span className="flex items-center gap-2">
                    <Clipboard className="size-3.5 text-cyan-500" />
                    Pegar
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Ctrl+V</span>
                </button>
                <button
                  onClick={() => {
                    if (focusedCell) {
                      performPasteBlock(focusedCell.rowIndex, focusedCell.colIndex, true);
                    }
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-muted text-left text-cyan-400"
                >
                  <span className="flex items-center gap-2">
                    <ClipboardPaste className="size-3.5 text-cyan-400" />
                    Pegar e Insertar Filas
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Shift+Ctrl+V</span>
                </button>
                <button
                  onClick={() => {
                    if (focusedCell && sortedTests[focusedCell.rowIndex]) {
                      const t = sortedTests[focusedCell.rowIndex];
                      updateCellValue(t.id, focusedCell.colIndex, '');
                    }
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-amber-500/10 text-amber-400 text-left"
                >
                  <span className="flex items-center gap-2">
                    <Trash2 className="size-3.5 text-amber-500" />
                    Borrar Contenido
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">Delete</span>
                </button>
                <div className="h-px bg-border/40 my-1" />
                <button
                  onClick={() => {
                    if (focusedCell && sortedTests[focusedCell.rowIndex]) {
                      handleDuplicateRow(sortedTests[focusedCell.rowIndex].id);
                    }
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <Copy className="size-3.5 text-cyan-500" />
                  Duplicar Fila Enfocada
                </button>
                <button
                  onClick={() => {
                    if (focusedCell && sortedTests[focusedCell.rowIndex]) {
                      handleInsertRowBelow(sortedTests[focusedCell.rowIndex].id);
                    }
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left"
                >
                  <Plus className="size-3.5 text-cyan-500" />
                  Insertar Fila Abajo
                </button>
              </div>
            )}
          </div>

          {/* Ver Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveTopMenu(activeTopMenu === 'ver' ? null : 'ver')}
              className={`px-2 py-0.5 rounded hover:bg-muted/80 hover:text-foreground transition-colors ${
                activeTopMenu === 'ver' ? 'bg-muted text-foreground font-semibold' : ''
              }`}
            >
              Ver
            </button>
            {activeTopMenu === 'ver' && (
              <div className="absolute left-0 top-full mt-1 bg-card dark:bg-[#0c121e] border border-border rounded-lg shadow-xl p-1 min-w-52 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setViewMode('matrix');
                    setActiveTopMenu(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left ${
                    viewMode === 'matrix' ? 'bg-cyan-600/20 text-cyan-400 font-bold' : 'hover:bg-muted'
                  }`}
                >
                  <Table className="size-3.5 text-cyan-500" />
                  Matriz Excel Grid
                </button>
                <button
                  onClick={() => {
                    setViewMode('cards');
                    setActiveTopMenu(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left ${
                    viewMode === 'cards' ? 'bg-cyan-600/20 text-cyan-400 font-bold' : 'hover:bg-muted'
                  }`}
                >
                  <LayoutGrid className="size-3.5 text-cyan-500" />
                  Vista Detallada Tarjetas
                </button>
              </div>
            )}
          </div>

          {/* Insertar Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveTopMenu(activeTopMenu === 'insertar' ? null : 'insertar')}
              className={`px-2 py-0.5 rounded hover:bg-muted/80 hover:text-foreground transition-colors ${
                activeTopMenu === 'insertar' ? 'bg-muted text-foreground font-semibold' : ''
              }`}
            >
              Insertar
            </button>
            {activeTopMenu === 'insertar' && (
              <div className="absolute left-0 top-full mt-1 bg-card dark:bg-[#0c121e] border border-border rounded-lg shadow-xl p-1 min-w-52 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    handleAddMatrixRow();
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left font-semibold"
                >
                  <Plus className="size-3.5 text-cyan-500" />
                  Insertar 1 Nueva Fila
                </button>
                <button
                  onClick={() => {
                    handleAddMultipleRows(5);
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left font-semibold text-cyan-400"
                >
                  <Plus className="size-3.5 text-cyan-500" />
                  Insertar 5 Nuevas Filas
                </button>
                <button
                  onClick={() => {
                    handleAddMultipleRows(10);
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left font-semibold text-cyan-400"
                >
                  <Plus className="size-3.5 text-cyan-500" />
                  Insertar 10 Nuevas Filas
                </button>
              </div>
            )}
          </div>

          {/* Formato Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveTopMenu(activeTopMenu === 'formato' ? null : 'formato')}
              className={`px-2 py-0.5 rounded hover:bg-muted/80 hover:text-foreground transition-colors ${
                activeTopMenu === 'formato' ? 'bg-muted text-foreground font-semibold' : ''
              }`}
            >
              Formato
            </button>
            {activeTopMenu === 'formato' && (
              <div className="absolute left-0 top-full mt-1 bg-card dark:bg-[#0c121e] border border-border rounded-lg shadow-xl p-1 min-w-56 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 mb-1">
                  Formato Condicional Activo
                </div>
                <div className="px-2.5 py-1 flex items-center gap-2 text-emerald-400 font-semibold">
                  <span className="size-2 rounded-full bg-emerald-500" /> PASSED: Verde Emerald (#dcfce7)
                </div>
                <div className="px-2.5 py-1 flex items-center gap-2 text-rose-400 font-semibold">
                  <span className="size-2 rounded-full bg-rose-500" /> FAILED: Rojo Crimson (#fee2e2)
                </div>
                <div className="px-2.5 py-1 flex items-center gap-2 text-purple-400 font-semibold">
                  <span className="size-2 rounded-full bg-purple-500" /> Evidencias: Hipervínculos Azules (#0000FF)
                </div>
              </div>
            )}
          </div>

          {/* Datos Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveTopMenu(activeTopMenu === 'datos' ? null : 'datos')}
              className={`px-2 py-0.5 rounded hover:bg-muted/80 hover:text-foreground transition-colors ${
                activeTopMenu === 'datos' ? 'bg-muted text-foreground font-semibold' : ''
              }`}
            >
              Datos
            </button>
            {activeTopMenu === 'datos' && (
              <div className="absolute left-0 top-full mt-1 bg-card dark:bg-[#0c121e] border border-border rounded-lg shadow-xl p-1 min-w-52 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setStatusFilter('ALL');
                    setActiveTopMenu(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left ${
                    statusFilter === 'ALL' ? 'bg-cyan-600/20 text-cyan-400 font-bold' : 'hover:bg-muted'
                  }`}
                >
                  <Filter className="size-3.5 text-cyan-500" />
                  Mostrar Todas ({selectedSuite?.tests.length || 0})
                </button>
                <div className="h-px bg-border/40 my-1" />
                <button
                  onClick={() => {
                    setStatusFilter('PASSED');
                    setActiveTopMenu(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-emerald-400 font-semibold ${
                    statusFilter === 'PASSED' ? 'bg-emerald-500/20' : 'hover:bg-muted'
                  }`}
                >
                  ✅ Filtrar PASSED ({suiteStats.passedCount})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('FAILED');
                    setActiveTopMenu(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-rose-400 font-semibold ${
                    statusFilter === 'FAILED' ? 'bg-rose-500/20' : 'hover:bg-muted'
                  }`}
                >
                  ❌ Filtrar FAILED ({suiteStats.failedCount})
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('PENDING');
                    setActiveTopMenu(null);
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-amber-400 font-semibold ${
                    statusFilter === 'PENDING' ? 'bg-amber-500/20' : 'hover:bg-muted'
                  }`}
                >
                  ⏳ Filtrar PENDING
                </button>
              </div>
            )}
          </div>

          {/* Ayuda Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveTopMenu(activeTopMenu === 'ayuda' ? null : 'ayuda')}
              className={`px-2 py-0.5 rounded hover:bg-muted/80 hover:text-foreground transition-colors ${
                activeTopMenu === 'ayuda' ? 'bg-muted text-foreground font-semibold' : ''
              }`}
            >
              Ayuda
            </button>
            {activeTopMenu === 'ayuda' && (
              <div className="absolute left-0 top-full mt-1 bg-card dark:bg-[#0c121e] border border-border rounded-lg shadow-xl p-1 min-w-56 z-50 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    setShowShortcutsModal(true);
                    setActiveTopMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-muted text-left font-semibold"
                >
                  <HelpCircle className="size-3.5 text-cyan-500" />
                  Atajos de Teclado & Guía Excel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Search & Export ZIP */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-3 absolute left-2 top-1.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrar casos..."
              value={searchTests}
              onChange={(e) => setSearchTests(e.target.value)}
              className="h-6 pl-7 pr-2 w-32 sm:w-44 rounded bg-background/60 border border-border/50 text-[10px] focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            />
          </div>

          <Button
            onClick={handleExportZip}
            disabled={isExporting}
            className="h-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] flex items-center gap-1 px-2.5 rounded transition-all shadow-sm"
            title="Exportar Matriz completa a Excel y carpeta de evidencias comprimida (.zip)"
          >
            <Download className="size-3" />
            {isExporting ? 'Exportando...' : 'Exportar ZIP'}
          </Button>
        </div>
      </div>

      {/* Bulk Actions Toolbar (Only when rows are selected) */}
      {selectedTestIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-cyan-600/10 border border-cyan-500/30 p-3 rounded-xl animate-in slide-in-from-top duration-300 w-full text-xs font-sans">
          <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono pr-2">
            [{selectedTestIds.length}] Filas Seleccionadas:
          </span>
          <Button
            onClick={() => handleBulkStatusChange('PASSED')}
            className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2.5 rounded"
          >
            Marcar PASSED
          </Button>
          <Button
            onClick={() => handleBulkStatusChange('FAILED')}
            className="h-7 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] px-2.5 rounded"
          >
            Marcar FAILED
          </Button>
          <Button
            onClick={() => handleBulkStatusChange('PENDING')}
            className="h-7 bg-slate-600 hover:bg-slate-700 text-white font-semibold text-[10px] px-2.5 rounded"
          >
            Marcar PENDING
          </Button>
          <Button
            onClick={handleBulkDelete}
            className="h-7 bg-rose-500/10 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 font-semibold text-[10px] px-2.5 rounded border border-rose-500/20 dark:border-rose-500/30 ml-auto flex items-center gap-1"
          >
            <Trash2 className="size-3" />
            Eliminar Filas
          </Button>
        </div>
      )}

      {/* Main Suite Content (Full Width) */}
      {selectedSuite ? (
        <div className="flex-1 min-h-0 flex flex-col w-full overflow-hidden space-y-1.5">

          {/* Render view mode */}
          {viewMode === 'cards' ? (
            /* CARD VIEW ACCORDION - FULL WIDTH */
            <div className="overflow-auto flex-1 min-h-0 space-y-3 w-full">
              {sortedTests.map((test) => {
                const isExpanded = expandedTestId === test.id;
                const isEditing = editingTestId === test.id;

                return (
                  <Card
                    key={test.id}
                    className={`border-border/40 hover:border-cyan-500/30 bg-card/50 transition-all rounded-xl overflow-hidden shadow-sm ${
                      isExpanded ? 'ring-1 ring-cyan-500/20' : ''
                    }`}
                  >
                    <div
                      onClick={() => !isEditing && setExpandedTestId(isExpanded ? null : test.id)}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          test.resultadoPrueba === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-500'
                            : test.resultadoPrueba === 'PASSED'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          <Shield className="size-4" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-mono text-[10px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                              {test.idPruebaSeguridad}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {test.servicioTecnologico} · {test.plataforma}
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-foreground truncate max-w-[280px] sm:max-w-[500px]">
                            {test.nombrePrueba}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                          test.resultadoPrueba === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                            : test.resultadoPrueba === 'PASSED'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {test.resultadoPrueba}
                        </span>

                        {!isExpanded && <ChevronRight className="size-4 text-muted-foreground" />}
                        {isExpanded && <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border/20 p-5 bg-muted/10 space-y-6 text-xs text-muted-foreground">
                        {/* Action panel */}
                        <div className="flex justify-between items-center bg-background/50 border border-border/30 rounded-lg p-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                            {isEditing ? 'Modo de Edición Activo' : 'Detalles de Ejecución'}
                          </span>
                          {isEditing ? (
                            <Button
                              onClick={saveEdit}
                              className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] flex items-center gap-1 py-1 rounded"
                            >
                              <Save className="size-3" />
                              Guardar Cambios
                            </Button>
                          ) : (
                            <Button
                              onClick={() => startEditing(test)}
                              className="h-7 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-[10px] flex items-center gap-1 py-1 rounded"
                            >
                              <Edit2 className="size-3" />
                              Editar Prueba
                            </Button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5">
                                Resultado / Estado de Prueba:
                                <select
                                  value={editForm.resultadoPrueba || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, resultadoPrueba: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="PASSED">PASSED</option>
                                  <option value="FAILED">FAILED</option>
                                  <option value="Out Of Scope">Out Of Scope</option>
                                </select>
                              </label>

                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5">
                                Nombre del Hallazgo (si aplica):
                                <input
                                  type="text"
                                  value={editForm.nombreHallazgo || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, nombreHallazgo: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>

                              <label className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 flex flex-col gap-1.5">
                                Target (Objetivo FQDN / IP):
                                <input
                                  type="text"
                                  value={editForm.singleTarget || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, singleTarget: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>

                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5">
                                Targets File (Archivo bulk):
                                <input
                                  type="text"
                                  value={editForm.targetsFile || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, targetsFile: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>

                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5 md:col-span-2">
                                Comentarios / Descargos de la Prueba:
                                <textarea
                                  rows={2}
                                  value={editForm.comentariosPrueba || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, comentariosPrueba: e.target.value }))}
                                  className="p-2 rounded border border-input bg-background/60 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>
                            </div>

                            {/* Evidences list */}
                            <div className="space-y-3 pt-3 border-t border-border/20">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase text-foreground">Evidencias Adjuntas</span>
                                <Button
                                  type="button"
                                  onClick={addEvidence}
                                  className="h-6 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-600 dark:text-cyan-400 text-[10px] px-2 py-0.5 rounded border border-cyan-500/20"
                                >
                                  + Agregar Evidencia
                                </Button>
                              </div>

                              <div className="space-y-2">
                                {(editForm.evidencias || []).map((ev, idx) => (
                                  <div key={idx} className="p-3 bg-background/40 border border-border/40 rounded-xl space-y-2 flex flex-col">
                                    <div className="flex items-center justify-between gap-3">
                                      <label className="text-[9px] font-bold text-muted-foreground grow">
                                        Archivo de Imagen:
                                        <input
                                          type="text"
                                          value={ev.imagen}
                                          onChange={(e) => updateEvidence(idx, 'imagen', e.target.value)}
                                          className="h-7 w-full rounded border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none mt-1"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => removeEvidence(idx)}
                                        className="p-1.5 text-muted-foreground hover:text-rose-500 border border-border/40 rounded bg-background/20 mt-4"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    </div>

                                    <label className="text-[9px] font-bold text-muted-foreground">
                                      Comentarios de Evidencia:
                                      <input
                                        type="text"
                                        value={ev.nota}
                                        onChange={(e) => updateEvidence(idx, 'nota', e.target.value)}
                                        className="h-7 w-full rounded border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none mt-1"
                                      />
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Metadata summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border/20 pb-4">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-bold text-foreground block">General</span>
                                <p><span className="font-semibold">Servicio:</span> {test.idServicio}</p>
                                <p><span className="font-semibold">Categoría:</span> {test.categoria}</p>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-bold text-foreground block">Hallazgo</span>
                                {test.nombreHallazgo ? (
                                  <>
                                    <p className="font-bold text-foreground/95">{test.nombreHallazgo}</p>
                                    <p><span className="font-semibold">CWE:</span> {test.cwe}</p>
                                  </>
                                ) : (
                                  <p className="italic">Sin hallazgos</p>
                                )}
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-bold text-foreground block">Target</span>
                                <p><span className="font-semibold">Target (Single):</span> <span className="text-cyan-500 font-bold">{test.singleTarget || '—'}</span></p>
                                <p><span className="font-semibold">Targets File (Bulk):</span> <span className="text-indigo-600 dark:text-indigo-400 font-mono">{test.targetsFile || '—'}</span></p>
                              </div>
                            </div>

                            {test.comentariosPrueba && (
                              <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                                <span className="font-bold text-[10px] text-foreground block">Comentarios:</span>
                                <p className="text-foreground leading-relaxed mt-1">{test.comentariosPrueba}</p>
                              </div>
                            )}

                            {/* Commands list */}
                            {(test.comandoSingle || test.comandoBulk) && (
                              <div className="space-y-4 font-mono text-[11px]">
                                <span className="text-[10px] font-sans font-bold uppercase text-foreground block">
                                  Snippets de Consola Dinámicos (Copiables)
                                </span>

                                {test.comandoSingle && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-sans text-muted-foreground">
                                      <span>Comando Unitario ({test.singleTarget || 'Sin target'}):</span>
                                      <button
                                        onClick={() =>
                                          copyToClipboard(
                                            substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile),
                                            `s-${test.id}`
                                          )
                                        }
                                        className="inline-flex items-center gap-1 hover:text-cyan-500 transition-colors bg-background/60 border border-border/40 rounded px-1.5 py-0.5"
                                      >
                                        <Copy className="size-3" />
                                        {copiedId === `s-${test.id}` ? 'Copiado!' : 'Copiar'}
                                      </button>
                                    </div>
                                    <pre className="bg-[#0f141c] text-[#a5b4fc] p-3 rounded-lg overflow-x-auto select-all">
                                      {substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile)}
                                    </pre>
                                  </div>
                                )}

                                {test.comandoBulk && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-sans text-muted-foreground">
                                      <span>Comando Bulk ({test.targetsFile || 'Sin archivo'}):</span>
                                      <button
                                        onClick={() =>
                                          copyToClipboard(
                                            substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile),
                                            `b-${test.id}`
                                          )
                                        }
                                        className="inline-flex items-center gap-1 hover:text-cyan-500 transition-colors bg-background/60 border border-border/40 rounded px-1.5 py-0.5"
                                      >
                                        <Copy className="size-3" />
                                        {copiedId === `b-${test.id}` ? 'Copiado!' : 'Copiar'}
                                      </button>
                                    </div>
                                    <pre className="bg-[#0f141c] text-[#a5b4fc] p-3 rounded-lg overflow-x-auto select-all">
                                      {substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Evidences screenshots */}
                            {test.evidencias.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase text-foreground block">Evidencias Adjuntas</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {test.evidencias.map((ev, idx) => (
                                    <div key={idx} className="p-3 border border-border bg-background/50 rounded-xl flex items-start gap-2.5">
                                      <ImageIcon className="size-4 text-cyan-500 shrink-0 mt-0.5" />
                                      <div className="min-w-0">
                                        <p className="font-mono font-bold text-[10px] text-foreground truncate">{ev.imagen}</p>
                                        <p className="text-muted-foreground text-[11px] mt-1 break-words">{ev.nota || 'Sin comentarios'}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            /* EXCEL MATRIX VIEW GRID COMPRISING ALL 62 COLUMNS - FULL WIDTH & INTERACTIVE */
            <Card className="border-border/40 bg-card dark:bg-[#070b11]/85 backdrop-blur rounded-b-xl overflow-hidden shadow-2xl w-full border flex-1 min-h-0 flex flex-col">
              <div className="overflow-auto flex-1 min-h-0 max-w-full relative shadow-inner">
                <table
                  onKeyDown={handleKeyDown}
                  className="w-full text-left border-collapse text-[10px] whitespace-nowrap table-layout-fixed"
                >
                  <thead className="sticky top-0 z-30">
                    <tr className="border-b border-border/30 bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground select-none">
                      {EXCEL_HEADERS.map((h, i) => {
                        const isSorted = sortConfig && sortConfig.key === EXCEL_KEYS[i];
                        const categoryStyle = getHeaderCategoryStyle(i);

                        return (
                          <th
                            key={i}
                            style={{
                              minWidth: colWidths[i] || 150,
                              width: colWidths[i] || 150,
                            }}
                            onClick={() => {
                              if (i > 0) {
                                setSelectedFullColIndex(i);
                                setSelectedFullRowIndex(null);
                              }
                            }}
                            onContextMenu={(e) => {
                              if (i > 0) {
                                e.preventDefault();
                                e.stopPropagation();
                                setSelectedFullColIndex(i);
                                setSelectedFullRowIndex(null);
                                setColContextMenu({
                                  x: e.clientX,
                                  y: e.clientY,
                                  colIndex: i,
                                });
                              }
                            }}
                            className={`p-2.5 border-r border-border/20 relative group transition-colors sticky top-0 z-20 ${categoryStyle} ${
                              selectedFullColIndex === i ? 'bg-cyan-600/50 text-cyan-200 ring-2 ring-cyan-400 z-40' : ''
                            } ${
                              i === 1 ? 'sticky left-0 z-30 w-12 text-center' : ''
                            } ${i === 0 ? 'w-10 text-center sticky left-0 z-40' : ''}`}
                          >
                            {i === 0 ? (
                              <button
                                onClick={toggleSelectAll}
                                className="focus:outline-none inline-flex items-center justify-center"
                              >
                                {isAllSelected ? (
                                  <CheckSquare className="size-3.5 text-cyan-500" />
                                ) : (
                                  <Square className="size-3.5 text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <div
                                onClick={() => handleSort(i)}
                                className="flex items-center gap-1.5 cursor-pointer justify-between pr-2"
                              >
                                <span className="truncate pr-1 block">{h}</span>
                                {i > 0 && EXCEL_KEYS[i] !== 'id' && (
                                  <span className="text-muted-foreground shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                                    {isSorted ? (
                                      sortConfig?.direction === 'asc' ? (
                                        <ChevronUp className="size-3 text-cyan-400" />
                                      ) : (
                                        <ChevronDown className="size-3 text-cyan-400" />
                                      )
                                    ) : (
                                      <ChevronsUpDown className="size-2.5" />
                                    )}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Drag to Resize border handler */}
                            <div
                              onMouseDown={(e) => handleMouseDown(i, e)}
                              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/60 z-20"
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-mono">
                    {sortedTests.map((test, rowIndex) => (
                      <MatrixRow
                        key={test.id}
                        rowIndex={rowIndex}
                        test={test}
                        isSelected={selectedTestIds.includes(test.id)}
                        isFullRowSelected={selectedFullRowIndex === rowIndex}
                        focusedColIndex={focusedCell?.rowIndex === rowIndex ? focusedCell.colIndex : null}
                        selectionRange={selectionRange}
                        isEditingCell={isEditingCell}
                        copiedId={copiedId}
                        toggleSelectOne={toggleSelectOne}
                        onRowContextMenu={(e, testId, rIdx) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFullRowIndex(rIdx);
                          setSelectedFullColIndex(null);
                          setRowContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            testId,
                            rowIndex: rIdx,
                          });
                        }}
                        onSelectFullRow={(rIdx) => {
                          setSelectedFullRowIndex(rIdx);
                          setSelectedFullColIndex(null);
                          setFocusedCell({ rowIndex: rIdx, colIndex: 1 });
                        }}
                        onMatrixCellUpdate={handleMatrixCellUpdate}
                        onMatrixEvidenceUpdate={handleMatrixEvidenceUpdate}
                        onSetFocusedCell={setFocusedCell}
                        onCellMouseDown={handleCellMouseDown}
                        onCellMouseEnter={handleCellMouseEnter}
                        onCellClick={handleCellClick}
                        onStartEditing={() => setIsEditingCell(true)}
                        substituteCommand={substituteCommand}
                        onEditEvidence={(testId, idx) => setActiveCanvasEvidence({ testId, evidenceIdx: idx })}
                        setIsEditingCell={setIsEditingCell}
                        copyToClipboard={copyToClipboard}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Footer stats */}
              <div className="p-3 bg-muted/20 border-t border-border/40 text-[9px] text-muted-foreground flex justify-between font-mono">
                <span>Excel Matrix - 62 Columnas técnicas redimensionables e interactivas en tiempo real</span>
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                  {sortedTests.filter((t) => t.resultadoPrueba !== 'PENDING').length} / {sortedTests.length} pruebas gestionadas
                </span>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center border border-dashed border-border rounded-xl p-12 text-muted-foreground italic text-xs w-full">
          Selecciona una suite de pruebas para cargar sus casos activos.
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border bg-card/90 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="size-5 text-cyan-500" />
                Nueva Metodología de Pruebas
              </CardTitle>
              <CardDescription className="text-xs">
                Registra una nueva metodología o suite maestra de pruebas de seguridad en el catálogo.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateSuite}>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Nombre de la Metodología / Suite:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. OWASP Web Application Security Testing (WSTG v2.0)"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </CardContent>
              <div className="p-4 border-t border-border/40 bg-muted/20 flex justify-end gap-2 text-xs">
                <Button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-transparent hover:bg-muted text-muted-foreground font-semibold px-4 py-2 border border-border/40 rounded-lg h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-lg h-9"
                >
                  Crear Metodología
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Evidence Hacker Canvas Modal Editor */}
      {activeCanvasEvidence && (() => {
        const activeTest = selectedSuite?.tests.find((t) => t.id === activeCanvasEvidence.testId);
        const activeEvidence = activeTest?.evidencias[activeCanvasEvidence.evidenceIdx];
        return (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-5xl border-border bg-card dark:bg-[#0b1320] shadow-2xl rounded-xl overflow-hidden flex flex-col h-[90vh]">
              <CardHeader className="border-b border-border/40 pb-4 shrink-0">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Shield className="size-5 text-cyan-500" />
                  Editor de Evidencia Canvas - Caso #{activeTest?.id} (Evidencia {activeCanvasEvidence.evidenceIdx + 1})
                </CardTitle>
                <CardDescription className="text-xs">
                  Añade flechas, recuadros o censura datos sensibles. Guarda para actualizar la matriz.
                </CardDescription>
              </CardHeader>
              <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
                <HackerCanvas
                  initialImage={activeEvidence?.imagen || undefined}
                  initialElements={activeEvidence?.canvasState}
                  onSave={(finalImage, elementsState) => {
                    const updated = instances.map((inst) => {
                      if (inst.id !== activeSuiteId) return inst;
                      return {
                        ...inst,
                        tests: inst.tests.map((t) => {
                          if (t.id !== activeCanvasEvidence.testId) return t;
                          const current = [...(t.evidencias || [])];
                          while (current.length <= activeCanvasEvidence.evidenceIdx) {
                            current.push({ imagen: '', nota: '' });
                          }
                          current[activeCanvasEvidence.evidenceIdx] = {
                            ...current[activeCanvasEvidence.evidenceIdx],
                            imagen: finalImage,
                            canvasState: elementsState,
                          };
                          return { ...t, evidencias: current } as SecurityTestItem;
                        }),
                      };
                    });
                    saveSuiteInstances(updated);
                    setActiveCanvasEvidence(null);
                  }}
                  onCancel={() => setActiveCanvasEvidence(null)}
                />
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Row Context Menu Overlay */}
      {rowContextMenu && (
        <div
          style={{ top: rowContextMenu.y, left: rowContextMenu.x }}
          className="fixed z-50 bg-card/95 backdrop-blur border border-border rounded-xl shadow-2xl p-1.5 min-w-48 text-xs space-y-1 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 mb-1">
            Opciones Caso #{rowContextMenu.testId}
          </div>
          <button
            type="button"
            onClick={() => {
              setDetailDrawerTestId(rowContextMenu.testId);
              setRowContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 hover:from-cyan-500/25 hover:to-indigo-500/25 text-cyan-400 font-bold border border-cyan-500/30 transition-all text-left mb-1 shadow-xs"
          >
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-cyan-400" />
              Ver / Editar Ficha Completa
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono uppercase">Vertical</span>
          </button>
          <button
            type="button"
            onClick={() => handleDuplicateRow(rowContextMenu.testId)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 font-semibold transition-colors text-left"
          >
            <Copy className="size-3.5 text-cyan-500" />
            Duplicar fila
          </button>
          <button
            type="button"
            onClick={() => {
              performPasteBlock(rowContextMenu.rowIndex, 5, true);
              setRowContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors text-left"
          >
            <ClipboardPaste className="size-3.5 text-cyan-500" />
            Pegar e insertar filas
          </button>
          <button
            type="button"
            onClick={() => handleInsertRowBelow(rowContextMenu.testId)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors text-left"
          >
            <Plus className="size-3.5 text-cyan-500" />
            Insertar fila abajo
          </button>
          <button
            type="button"
            onClick={() => handleClearRowContent(rowContextMenu.testId)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/10 hover:text-amber-400 transition-colors text-left"
          >
            <Trash2 className="size-3.5 text-amber-500" />
            Limpiar contenido de la fila
          </button>
          <div className="h-px bg-border/40 my-1" />
          <button
            type="button"
            onClick={() => handleDeleteSingleRow(rowContextMenu.testId)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-left text-rose-400 font-bold"
          >
            <X className="size-3.5 text-rose-500" />
            Eliminar fila
          </button>
        </div>
      )}

      {/* Keyboard Shortcuts Help Modal Overlay */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl border-border bg-card dark:bg-[#0b1320] shadow-2xl rounded-xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HelpCircle className="size-5 text-cyan-500" />
                Guía de Atajos de Teclado & Operación Excel Grid
              </CardTitle>
              <CardDescription className="text-xs">
                Usa los controles estilo Google Sheets / MS Excel para acelerar la gestión de pruebas de seguridad.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-2">
                  <h4 className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <Table className="size-3.5" /> Navegación Rápida
                  </h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">Flechas:</strong> Mover entre celdas</li>
                    <li><strong className="text-foreground">Ctrl + Flechas:</strong> Salto inteligente Excel a final de bloque o borde</li>
                    <li><strong className="text-foreground">Enter:</strong> Entrar a editar celda / Guardar y bajar</li>
                    <li><strong className="text-foreground">Escape:</strong> Cancelar edición / Desenfocar</li>
                  </ul>
                </div>

                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-2">
                  <h4 className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <Copy className="size-3.5" /> Copiar & Pegar
                  </h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">Ctrl + C:</strong> Copiar valor de celda al portapapeles</li>
                    <li><strong className="text-foreground">Ctrl + X:</strong> Cortar celda (copia y vacía)</li>
                    <li><strong className="text-foreground">Ctrl + V:</strong> Pegar contenido en celda enfocada</li>
                    <li><strong className="text-foreground">Ctrl + Z:</strong> Deshacer historial de cambios</li>
                  </ul>
                </div>

                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-2">
                  <h4 className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <Trash2 className="size-3.5" /> Borrado & Selección
                  </h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">Delete / Supr:</strong> Borrar contenido de celda o fila/columna seleccionada</li>
                    <li><strong className="text-foreground">Clic en ID (#21):</strong> Seleccionar fila completa</li>
                    <li><strong className="text-foreground">Clic en Cabecera:</strong> Seleccionar columna completa</li>
                  </ul>
                </div>

                <div className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-2">
                  <h4 className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <Plus className="size-3.5" /> Menú de Contexto
                  </h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">Clic Derecho en ID:</strong> Duplicar fila, Insertar fila abajo, Eliminar</li>
                    <li><strong className="text-foreground">Clic Derecho en Cabecera:</strong> Limpiar valores de columna</li>
                    <li><strong className="text-foreground">Evidencias:</strong> Clic en enlace azul para abrir Canvas Editor</li>
                  </ul>
                </div>
              </div>
            </CardContent>
            <div className="p-3 border-t border-border/40 bg-muted/20 flex justify-end">
              <Button
                onClick={() => setShowShortcutsModal(false)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs h-8 px-4 rounded"
              >
                Entendido
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Excel Export Theme Modal Overlay */}
      {showThemeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-xl border-border bg-card dark:bg-[#0b1320] shadow-2xl rounded-xl overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Palette className="size-5 text-cyan-500" />
                Configurar Tema Visual de Exportación Excel (.xlsx)
              </CardTitle>
              <CardDescription className="text-xs">
                Selecciona la paleta corporativa temática con hipervínculos azules y formato de tabla profesional para los archivos exportados.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(THEME_CONFIGS) as ExcelExportTheme[]).map((themeKey) => {
                  const theme = THEME_CONFIGS[themeKey];
                  const isSelected = excelExportTheme === themeKey;
                  return (
                    <div
                      key={themeKey}
                      onClick={() => setExcelExportTheme(themeKey)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 relative ${
                        isSelected
                          ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500 shadow-md'
                          : 'border-border/40 bg-muted/20 hover:border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">{theme.name}</span>
                        {isSelected && <Check className="size-4 text-cyan-400 font-bold" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{theme.description}</p>
                      
                      {/* Theme color preview swatch */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <div
                          className="h-3 grow rounded-sm"
                          style={{ backgroundColor: theme.headerEvidencias }}
                          title="Cabecera Evidencias"
                        />
                        <div
                          className="h-3 grow rounded-sm"
                          style={{ backgroundColor: theme.headerComandos }}
                          title="Cabecera Comandos"
                        />
                        <div
                          className="h-3 grow rounded-sm"
                          style={{ backgroundColor: theme.headerHallazgos }}
                          title="Cabecera Hallazgos"
                        />
                        <div
                          className="h-3 grow rounded-sm"
                          style={{ backgroundColor: theme.headerGeneral }}
                          title="Cabecera General"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <div className="p-3 border-t border-border/40 bg-muted/20 flex justify-between items-center text-xs">
              <span className="text-muted-foreground text-[11px]">
                Tema activo: <strong className="text-cyan-400">{THEME_CONFIGS[excelExportTheme].name}</strong>
              </span>
              <Button
                onClick={() => setShowThemeModal(false)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs h-8 px-4 rounded"
              >
                Guardar Tema
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Vertical Detail Drawer Sheet (Ficha del Caso de Prueba) */}
      {detailDrawerTestId !== null && (() => {
        const currentTest = selectedSuite?.tests.find((t) => t.id === detailDrawerTestId);
        if (!currentTest) return null;

        return (
          <>
            {/* Backdrop Overlay */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-150"
              onClick={() => setDetailDrawerTestId(null)}
            />

            {/* Slide-Over Panel */}
            <div className="fixed inset-y-0 right-0 w-full sm:w-[580px] md:w-[680px] bg-card dark:bg-[#0d131f] border-l border-border/80 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-xs">
              
              {/* Drawer Header */}
              <div className="p-4 border-b border-border/40 bg-muted/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        Caso #{currentTest.id}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground truncate">
                        {currentTest.idPruebaSeguridad || `CUSTOM-TEST-${currentTest.id}`}
                      </span>
                    </div>
                    <h2 className="text-sm font-bold text-foreground truncate mt-0.5">
                      {currentTest.nombrePrueba || 'Prueba de Seguridad'}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={currentTest.resultadoPrueba}
                    onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'resultadoPrueba', e.target.value)}
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer ${
                      currentTest.resultadoPrueba === 'PASSED'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : currentTest.resultadoPrueba === 'FAILED'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        : currentTest.resultadoPrueba === 'Out Of Scope'
                        ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    <option value="PENDING">⏳ PENDING</option>
                    <option value="PASSED">✅ PASSED</option>
                    <option value="FAILED">❌ FAILED</option>
                    <option value="Out Of Scope">🚫 Out Of Scope</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setDetailDrawerTestId(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Cerrar Ficha (ESC)"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Tab Navigation Bar */}
              <div className="flex items-center gap-1 p-2 bg-muted/20 border-b border-border/40 overflow-x-auto shrink-0">
                {[
                  { id: 'general', label: '📌 General' },
                  { id: 'targets', label: '🎯 Targets & Comandos' },
                  { id: 'burp', label: '🔍 Burp & Tools' },
                  { id: 'mitre', label: '🛡️ MITRE & CVSS' },
                  { id: 'evidencias', label: '📸 Evidencias (6)' },
                  { id: 'extendidos', label: '📋 Ficha Extendida' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDetailTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all text-[11px] flex items-center gap-1.5 ${
                      activeDetailTab === tab.id
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Form Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">

                {/* TAB 1: GENERAL */}
                {activeDetailTab === 'general' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          ID Prueba Seguridad
                        </label>
                        <input
                          type="text"
                          value={currentTest.idPruebaSeguridad || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'idPruebaSeguridad', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-cyan-400 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          ID Servicio
                        </label>
                        <input
                          type="text"
                          value={currentTest.idServicio || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'idServicio', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Nombre de la Prueba
                      </label>
                      <input
                        type="text"
                        value={currentTest.nombrePrueba || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'nombrePrueba', e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-semibold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Plataforma
                        </label>
                        <input
                          type="text"
                          value={currentTest.plataforma || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'plataforma', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Servicio Tecnológico
                        </label>
                        <input
                          type="text"
                          value={currentTest.servicioTecnologico || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'servicioTecnologico', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Categoría
                        </label>
                        <input
                          type="text"
                          value={currentTest.categoria || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'categoria', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Clasificación
                        </label>
                        <input
                          type="text"
                          value={currentTest.clasificacion || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'clasificacion', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Evaluación Asociada (Framework)
                      </label>
                      <input
                        type="text"
                        value={currentTest.evaluacionAsociada || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'evaluacionAsociada', e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 text-muted-foreground focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Nombre del Hallazgo / Vulnerabilidad
                      </label>
                      <input
                        type="text"
                        value={currentTest.nombreHallazgo || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'nombreHallazgo', e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-semibold text-rose-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Descripción de la Prueba
                      </label>
                      <textarea
                        rows={3}
                        value={currentTest.descripcionPrueba || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'descripcionPrueba', e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-background border border-border/60 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y"
                        placeholder="Detalles sobre qué evalúa este caso de prueba..."
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Comentarios y Observaciones
                      </label>
                      <textarea
                        rows={3}
                        value={currentTest.comentariosPrueba || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'comentariosPrueba', e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-background border border-border/60 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-y"
                        placeholder="Notas adicionales o resultados parciales..."
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: TARGETS & COMANDOS */}
                {activeDetailTab === 'targets' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Single Target (URL / IP)
                        </label>
                        <input
                          type="text"
                          value={currentTest.singleTarget || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'singleTarget', e.target.value)}
                          placeholder="https://ejemplo.com"
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-cyan-400 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Targets File Name
                        </label>
                        <input
                          type="text"
                          value={currentTest.targetsFile || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'targetsFile', e.target.value)}
                          placeholder="BurpItems.txt"
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-indigo-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Comando Bulk Sugerido
                        </label>
                        {currentTest.comandoBulk && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(substituteCommand(currentTest.comandoBulk, currentTest.singleTarget, currentTest.targetsFile), `drawer-b-${currentTest.id}`)}
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                          >
                            <Copy className="size-3" /> Copiar Comando Sustituido
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={currentTest.comandoBulk || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'comandoBulk', e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-background border border-border/60 font-mono text-indigo-300 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Comando Single Sugerido
                        </label>
                        {currentTest.comandoSingle && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(substituteCommand(currentTest.comandoSingle, currentTest.singleTarget, currentTest.targetsFile), `drawer-s-${currentTest.id}`)}
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                          >
                            <Copy className="size-3" /> Copiar Comando Sustituido
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={3}
                        value={currentTest.comandoSingle || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'comandoSingle', e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-background border border-border/60 font-mono text-emerald-300 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Snippet Consola Desarrollador (Browser HAR / JS)
                      </label>
                      <textarea
                        rows={3}
                        value={currentTest.snippetDeveloperConsole || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'snippetDeveloperConsole', e.target.value)}
                        className="w-full p-2.5 rounded-lg bg-background border border-border/60 font-mono text-amber-300 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: BURP & TOOLS */}
                {activeDetailTab === 'burp' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Filtro BurpSuite HTTP History
                      </label>
                      <input
                        type="text"
                        value={currentTest.filtroBurpHistory || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'filtroBurpHistory', e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-cyan-300 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Filtro BurpSuite Search
                      </label>
                      <input
                        type="text"
                        value={currentTest.filtroBurpSearch || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'filtroBurpSearch', e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-cyan-300 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          BurpSuite File Name
                        </label>
                        <input
                          type="text"
                          value={currentTest.burpSuiteFile || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'burpSuiteFile', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Comando Burp File
                        </label>
                        <input
                          type="text"
                          value={currentTest.comandoBurpFile || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'comandoBurpFile', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-indigo-300 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Herramienta Sugerida
                        </label>
                        <input
                          type="text"
                          value={currentTest.herramientaSugerida || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'herramientaSugerida', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Herramienta que Incluye Prueba
                        </label>
                        <input
                          type="text"
                          value={currentTest.herramientaIncluyePrueba || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'herramientaIncluyePrueba', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        Referencias & Documentación
                      </label>
                      <input
                        type="text"
                        value={currentTest.referencias || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'referencias', e.target.value)}
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 text-blue-400 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 4: MITRE & CVSS */}
                {activeDetailTab === 'mitre' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          MITRE ID
                        </label>
                        <input
                          type="text"
                          value={currentTest.mitreId || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'mitreId', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-cyan-400 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          CWE
                        </label>
                        <input
                          type="text"
                          value={currentTest.cwe || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'cwe', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-cyan-400 font-bold focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          CVSS Score
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={currentTest.cvssScore ?? 0}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'cvssScore', parseFloat(e.target.value) || 0)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-bold text-rose-400 text-center focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          MITRE Táctica
                        </label>
                        <input
                          type="text"
                          value={currentTest.mitreTactica || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'mitreTactica', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          MITRE Técnica
                        </label>
                        <input
                          type="text"
                          value={currentTest.mitreTecnica || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'mitreTecnica', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                        CVSS Vector
                      </label>
                      <input
                        type="text"
                        value={currentTest.cvssVector || ''}
                        onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'cvssVector', e.target.value)}
                        placeholder="CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
                        className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono text-[10px] text-muted-foreground focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          FQDN / Dominio
                        </label>
                        <input
                          type="text"
                          value={currentTest.fqdn || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'fqdn', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                          Ambiente
                        </label>
                        <input
                          type="text"
                          value={currentTest.ambiente || ''}
                          onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'ambiente', e.target.value)}
                          className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: EVIDENCIAS (1 a 6) */}
                {activeDetailTab === 'evidencias' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 gap-4">
                      {[0, 1, 2, 3, 4, 5].map((idx) => {
                        const ev = currentTest.evidencias[idx];
                        const hasImage = Boolean(ev?.imagen);
                        return (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl bg-background border border-border/60 space-y-2 relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-cyan-400 text-xs">
                                Evidencia #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => setActiveCanvasEvidence({ testId: currentTest.id, evidenceIdx: idx })}
                                className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 text-[10px] flex items-center gap-1.5 transition-colors"
                              >
                                <ImageIcon className="size-3" />
                                {hasImage ? 'Editar en Canvas' : '+ Dibujar / Subir en Canvas'}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">
                                  Ruta / URL de la Imagen
                                </label>
                                <input
                                  type="text"
                                  value={ev?.imagen || ''}
                                  onChange={(e) => handleMatrixEvidenceUpdate(currentTest.id, idx, 'imagen', e.target.value)}
                                  placeholder={`Evidencia_${idx + 1}.png`}
                                  className="w-full h-7 px-2 rounded bg-muted/40 border border-border/40 text-[10px] font-mono focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">
                                  Nota de la Evidencia
                                </label>
                                <input
                                  type="text"
                                  value={ev?.nota || ''}
                                  onChange={(e) => handleMatrixEvidenceUpdate(currentTest.id, idx, 'nota', e.target.value)}
                                  placeholder={`Nota descriptiva ${idx + 1}`}
                                  className="w-full h-7 px-2 rounded bg-muted/40 border border-border/40 text-[10px] focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </div>
                            </div>

                            {hasImage && ev.imagen.startsWith('data:image/') && (
                              <div className="mt-2 rounded-lg overflow-hidden border border-border/40 max-h-32 bg-black/40 flex items-center justify-center">
                                <img src={ev.imagen} alt={`Evidencia ${idx + 1}`} className="max-h-32 object-contain" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 6: FICHA EXTENDIDA */}
                {activeDetailTab === 'extendidos' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Folio 2</label>
                        <input type="text" value={currentTest.folio2 || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'folio2', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60 font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Fecha de Detección</label>
                        <input type="text" value={currentTest.fechaDeteccion || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'fechaDeteccion', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Activo Tecnológico</label>
                        <input type="text" value={currentTest.nombreActivoTecnologico || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'nombreActivoTecnologico', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Servicio Seguridad Asociado</label>
                        <input type="text" value={currentTest.servicioSeguridadAsociado || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'servicioSeguridadAsociado', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Tipo Revisión</label>
                        <input type="text" value={currentTest.tipoRevision || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'tipoRevision', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Activo Objetivo Prueba</label>
                        <input type="text" value={currentTest.activoObjetivoPruebaSeguridad || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'activoObjetivoPruebaSeguridad', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Nombre Prueba Seguridad</label>
                      <input type="text" value={currentTest.nombrePruebaSeguridad || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'nombrePruebaSeguridad', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Descripción Prueba Seguridad</label>
                      <textarea rows={2} value={currentTest.descripcionPruebaSeguridad || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'descripcionPruebaSeguridad', e.target.value)} className="w-full p-2.5 rounded-lg bg-background border border-border/60 resize-y" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Resultado Prueba 2</label>
                      <input type="text" value={currentTest.resultadoPrueba2 || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'resultadoPrueba2', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Evidencia Principal</label>
                      <input type="text" value={currentTest.evidenciaPrincipal || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'evidenciaPrincipal', e.target.value)} className="w-full h-8 px-2.5 rounded-lg bg-background border border-border/60" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Notas Prueba Seguridad</label>
                      <textarea rows={2} value={currentTest.notasPruebaSeguridad || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'notasPruebaSeguridad', e.target.value)} className="w-full p-2.5 rounded-lg bg-background border border-border/60 resize-y" />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Evid. Comp. 1</label>
                        <input type="text" value={currentTest.evidenciaComplementaria1 || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'evidenciaComplementaria1', e.target.value)} className="w-full h-8 px-2 rounded-lg bg-background border border-border/60 text-[10px]" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Evid. Comp. 2</label>
                        <input type="text" value={currentTest.evidenciaComplementaria2 || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'evidenciaComplementaria2', e.target.value)} className="w-full h-8 px-2 rounded-lg bg-background border border-border/60 text-[10px]" />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Evid. Comp. 3</label>
                        <input type="text" value={currentTest.evidenciaComplementaria3 || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'evidenciaComplementaria3', e.target.value)} className="w-full h-8 px-2 rounded-lg bg-background border border-border/60 text-[10px]" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Descripción</label>
                      <textarea rows={2} value={currentTest.descripcion || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'descripcion', e.target.value)} className="w-full p-2.5 rounded-lg bg-background border border-border/60 resize-y" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Amenaza</label>
                      <textarea rows={2} value={currentTest.amenaza || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'amenaza', e.target.value)} className="w-full p-2.5 rounded-lg bg-background border border-border/60 resize-y" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Recomendaciones</label>
                      <textarea rows={2} value={currentTest.recomendaciones || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'recomendaciones', e.target.value)} className="w-full p-2.5 rounded-lg bg-background border border-border/60 resize-y" />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Prueba de Concepto (PoC)</label>
                      <textarea rows={2} value={currentTest.poc || ''} onChange={(e) => handleMatrixCellUpdate(currentTest.id, 'poc', e.target.value)} className="w-full p-2.5 rounded-lg bg-background border border-border/60 font-mono text-cyan-300 resize-y" />
                    </div>
                  </div>
                )}

              </div>

              {/* Footer Actions */}
              <div className="p-3 border-t border-border/40 bg-muted/20 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => handleDuplicateRow(currentTest.id)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 font-bold border border-cyan-500/30 text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="size-3.5" />
                  Duplicar Caso
                </button>

                <button
                  type="button"
                  onClick={() => setDetailDrawerTestId(null)}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  Cerrar Ficha
                </button>
              </div>

            </div>
          </>
        );
      })()}

      {/* Live Debug Log Toast Notification Banner */}
      {debugLogMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-cyan-950/95 border-2 border-cyan-400 text-cyan-200 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="size-4 text-cyan-400 animate-pulse shrink-0" />
          <span className="font-mono font-bold tracking-wide">{debugLogMessage}</span>
        </div>
      )}
    </div>
  );
}

export default SecurityTestsActivePage;
