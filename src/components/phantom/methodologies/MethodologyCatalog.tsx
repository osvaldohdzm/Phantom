/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  Download,
  Upload,
  Copy,
  Trash2,
  ExternalLink,
  Shield,
  FolderTree,
  CheckCircle2,
  Layers,
  Sparkles,
  BookOpen,
  Terminal,
  Filter,
  FileCode,
  Tag,
  Star,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Methodology, MethodologyCategory, CatalogViewMode, POLNode } from './types';

interface MethodologyCatalogProps {
  methodologies: Methodology[];
  onSelectMethodology: (id: string) => void;
  onCreateMethodology: (newMeth: Partial<Methodology>, preset: string) => void;
  onDuplicateMethodology: (id: string) => void;
  onDeleteMethodology: (id: string) => void;
  onImportMethodology: (file: File) => void;
  onExportMethodology: (id: string) => void;
}

const CATEGORIES: MethodologyCategory[] = [
  'Infrastructure & AD',
  'Web Applications (OWASP)',
  'Cloud Security (AWS/Azure)',
  'Mobile Penetration Testing',
  'Red Team & Adversary',
  'Compliance & Audits',
  'Custom',
];

export function MethodologyCatalog({
  methodologies,
  onSelectMethodology,
  onCreateMethodology,
  onDuplicateMethodology,
  onDeleteMethodology,
  onImportMethodology,
  onExportMethodology,
}: MethodologyCatalogProps) {
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New methodology form state
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState<MethodologyCategory>('Infrastructure & AD');
  const [newPreset, setNewPreset] = useState<string>('ad');

  // Filtered methodologies
  const filtered = useMemo(() => {
    return methodologies.filter((m) => {
      const matchQuery =
        !searchQuery ||
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCat = selectedCategory === 'all' || m.category === selectedCategory;

      return matchQuery && matchCat;
    });
  }, [methodologies, searchQuery, selectedCategory]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onCreateMethodology(
      {
        title: newTitle.trim(),
        code: newCode.trim() || newTitle.substring(0, 4).toUpperCase(),
        description: newDesc.trim() || 'Metodología de seguridad Phantom.',
        category: newCat,
        tags: [newCat.split(' ')[0].toLowerCase(), 'phantom', 'pol'],
      },
      newPreset
    );

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewCode('');
    setNewDesc('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportMethodology(file);
      e.target.value = '';
    }
  };

  // Helper to count total nodes and completed checks
  const getStats = (nodes: POLNode[]) => {
    const total = nodes.length;
    const checks = nodes.filter((n) => n.kind === 'check' || n.kind === 'command');
    const done = checks.filter((n) => n.status === 'done').length;
    const percent = checks.length > 0 ? Math.round((done / checks.length) * 100) : 0;
    const phases = nodes.filter((n) => n.kind === 'phase').length;
    return { total, checks: checks.length, done, percent, phases };
  };

  return (
    <div className="w-full flex flex-col gap-6 p-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <FolderTree className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Methodologies Phantom
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 font-mono">
                  POL Core v2.5
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Catálogo estructurado de metodologías pentest, árboles de ejecución (POL) y checklists adaptables.
              </p>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="size-3.5" />
            Importar JSON
            <input type="file" accept=".json" onChange={handleFileChange} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="size-4" />
            Nueva Metodología
          </button>
        </div>
      </div>

      {/* Catalog Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Metodologías</p>
            <p className="text-2xl font-bold text-foreground mt-1">{methodologies.length}</p>
          </div>
          <div className="size-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <BookOpen className="size-4.5" />
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Fases & Servicios</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {methodologies.reduce((acc, m) => acc + m.nodes.filter((n) => n.kind === 'phase' || n.kind === 'service').length, 0)}
            </p>
          </div>
          <div className="size-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Layers className="size-4.5" />
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Comandos & Checks</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {methodologies.reduce((acc, m) => acc + m.nodes.filter((n) => n.kind === 'check' || n.kind === 'command').length, 0)}
            </p>
          </div>
          <div className="size-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Terminal className="size-4.5" />
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Categorías Activas</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {new Set(methodologies.map((m) => m.category)).size}
            </p>
          </div>
          <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Shield className="size-4.5" />
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Category Filters, and View Switcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card/60 border border-border/50 rounded-2xl p-3 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar metodología por nombre, tag, código..."
            className="w-full bg-background border border-border/60 rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all',
              selectedCategory === 'all'
                ? 'bg-violet-500/15 border border-violet-500/30 text-violet-400 font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            Todas ({methodologies.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = methodologies.filter((m) => m.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5',
                  selectedCategory === cat
                    ? 'bg-violet-500/15 border border-violet-500/30 text-violet-400 font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <span>{cat}</span>
                <span className="text-[10px] opacity-70 px-1.5 py-0.2 rounded-full bg-muted">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Grid vs List View Mode Switcher */}
        <div className="flex items-center gap-1 border border-border/60 rounded-xl bg-background p-1 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            title="Vista Grid Tarjetas"
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              viewMode === 'grid'
                ? 'bg-violet-500/20 text-violet-400 font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            title="Vista Lista Compacta"
            className={cn(
              'p-1.5 rounded-lg text-xs transition-colors',
              viewMode === 'list'
                ? 'bg-violet-500/20 text-violet-400 font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Catalog Section */}
      {filtered.length === 0 ? (
        <div className="bg-card/40 border border-dashed border-border/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <BookOpen className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No se encontraron metodologías</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            Prueba ajustando los filtros de búsqueda o crea una nueva metodología utilizando el botón superior.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="text-xs text-violet-400 hover:underline mt-1 font-medium"
          >
            Limpiar filtros
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((meth) => {
            const stats = getStats(meth.nodes);
            return (
              <div
                key={meth.id}
                className="group bg-card hover:bg-muted/20 border border-border/60 hover:border-violet-500/40 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between gap-4 shadow-sm hover:shadow-violet-500/5 relative overflow-hidden"
              >
                {/* Background glow accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-colors pointer-events-none" />

                <div>
                  {/* Top metadata row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      {meth.code}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">{meth.category}</span>
                  </div>

                  {/* Title & Description */}
                  <h3
                    onClick={() => onSelectMethodology(meth.id)}
                    className="text-base font-semibold text-foreground group-hover:text-violet-400 transition-colors cursor-pointer line-clamp-1"
                  >
                    {meth.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                    {meth.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {meth.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Progress and Node Breakdown */}
                <div className="border-t border-border/40 pt-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1.5">
                      <FolderTree className="size-3.5 text-violet-400" />
                      {stats.total} nodos ({stats.phases} fases)
                    </span>
                    <span>{stats.percent}% completado</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-violet-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${stats.percent}%` }}
                    />
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => onSelectMethodology(meth.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <span>Abrir Metodología</span>
                      <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onExportMethodology(meth.id)}
                        title="Exportar JSON"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Download className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateMethodology(meth.id)}
                        title="Duplicar Metodología"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(meth.id)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT LIST VIEW */
        <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border/60 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Metodología</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3 text-center">Nodos</th>
                  <th className="px-4 py-3">Progreso</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((meth) => {
                  const stats = getStats(meth.nodes);
                  return (
                    <tr
                      key={meth.id}
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                      onClick={() => onSelectMethodology(meth.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px]">
                          {meth.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground group-hover:text-violet-400 transition-colors">
                          {meth.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">{meth.description}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-medium">
                        {meth.category}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-medium">
                        {stats.total}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-violet-500 h-full rounded-full transition-all"
                              style={{ width: `${stats.percent}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">{stats.percent}%</span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectMethodology(meth.id)}
                            className="px-2.5 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 font-semibold text-[11px] transition-colors"
                          >
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateMethodology(meth.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Copy className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(meth.id)}
                            className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE METHODOLOGY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                <Sparkles className="size-4 text-violet-400" />
                <span>Crear Nueva Metodología Phantom</span>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Nombre de la Metodología</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ej: Active Directory Internal Pentest 2026"
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Código / Referencia</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="Ej: AD-POL-01"
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Categoría</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value as MethodologyCategory)}
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-violet-500"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Descripción</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Resumen del alcance, objetivo y framework utilizado..."
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Preset de Estructura Inicial</label>
                <select
                  value={newPreset}
                  onChange={(e) => setNewPreset(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-violet-500"
                >
                  <option value="ad">Infrastructure & Active Directory Pentest</option>
                  <option value="owasp">OWASP Web Applications Security Audit</option>
                  <option value="cloud">Cloud Infrastructure & Kubernetes Security</option>
                  <option value="empty">Estructura Vacía (Personalizada)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md transition-colors"
                >
                  Crear Metodología
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-foreground">¿Eliminar Metodología?</h3>
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. Se eliminarán todos los nodos y configuraciones de esta metodología.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteMethodology(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
              >
                Confirmar Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
