'use client';

import { useState, useMemo } from 'react';
import { ClipboardList, Search, Filter, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EVALUACIONES_INITIAL, type EvaluacionItem } from '@/lib/data-evaluaciones';

export default function EvaluationsCatalogPage() {
  const [items] = useState<EvaluacionItem[]>(EVALUACIONES_INITIAL);
  const [search, setSearch] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedPhase, setSelectedPhase] = useState('all');

  // Dropdown list options
  const services = useMemo(() => {
    return ['all', ...Array.from(new Set(items.map((i) => i.servicio)))];
  }, [items]);

  const types = useMemo(() => {
    return ['all', ...Array.from(new Set(items.map((i) => i.tipo)))];
  }, [items]);

  const phases = useMemo(() => {
    return ['all', ...Array.from(new Set(items.map((i) => i.fase)))];
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.folio.toLowerCase().includes(search.toLowerCase()) ||
        item.actividad.toLowerCase().includes(search.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(search.toLowerCase());

      const matchesService = selectedService === 'all' || item.servicio === selectedService;
      const matchesType = selectedType === 'all' || item.tipo === selectedType;
      const matchesPhase = selectedPhase === 'all' || item.fase === selectedPhase;

      return matchesSearch && matchesService && matchesType && matchesPhase;
    });
  }, [items, search, selectedService, selectedType, selectedPhase]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="size-8 text-cyan-500" />
            Catálogo de Evaluaciones (Plantilla)
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-xs">
            Listado completo de actividades predefinidas disponibles para instanciar en las evaluaciones activas del sistema.
          </p>
        </div>
      </div>

      {/* Filters Box */}
      <Card className="border-border/40 bg-card/60 shadow-sm rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <Filter className="size-4 text-cyan-500" />
            Filtros y Búsqueda del Catálogo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative col-span-1 sm:col-span-2">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por Folio, Actividad o Descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>

            {/* Servicio */}
            <label className="text-[10px] text-muted-foreground flex flex-col gap-1.5">
              Servicio:
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              >
                {services.map((s) => (
                  <option key={s} value={s}>
                    {s === 'all' ? 'Todos los Servicios' : s}
                  </option>
                ))}
              </select>
            </label>

            {/* Tipo */}
            <label className="text-[10px] text-muted-foreground flex flex-col gap-1.5">
              Tipo:
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t === 'all' ? 'Todos los Tipos' : t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Table Box */}
      <Card className="border-border/40 bg-card/60 shadow-md rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground select-none">
                <th className="p-3 text-center w-12">Id</th>
                <th className="p-3 w-40">Folio</th>
                <th className="p-3 w-24">Servicio</th>
                <th className="p-3 w-36">Tipo</th>
                <th className="p-3 w-40">Fase</th>
                <th className="p-3 w-40">Sub Fase</th>
                <th className="p-3 w-32">Aplicabilidad</th>
                <th className="p-3 w-40">Actividad / Herramienta</th>
                <th className="p-3 min-w-[280px]">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20 text-xs">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-muted-foreground italic">
                    No se encontraron evaluaciones con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/15 transition-colors">
                    {/* Id */}
                    <td className="p-3 text-center font-mono text-[10px] text-muted-foreground">
                      {item.id}
                    </td>

                    {/* Folio */}
                    <td className="p-3 font-semibold text-foreground font-mono text-[10px]">
                      {item.folio}
                    </td>

                    {/* Servicio */}
                    <td className="p-3">
                      <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-medium font-mono text-muted-foreground">
                        {item.servicio}
                      </span>
                    </td>

                    {/* Tipo */}
                    <td className="p-3 text-muted-foreground">{item.tipo}</td>

                    {/* Fase */}
                    <td className="p-3 text-foreground font-medium">{item.fase}</td>

                    {/* Sub Fase */}
                    <td className="p-3 text-muted-foreground">{item.subFase}</td>

                    {/* Aplicabilidad */}
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.aplicabilidad === 'Obligatorio'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                        }`}
                      >
                        {item.aplicabilidad}
                      </span>
                    </td>

                    {/* Actividad */}
                    <td className="p-3 font-semibold text-foreground">{item.actividad}</td>

                    {/* Descripción */}
                    <td className="p-3 text-muted-foreground leading-relaxed">
                      {item.descripcion}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
