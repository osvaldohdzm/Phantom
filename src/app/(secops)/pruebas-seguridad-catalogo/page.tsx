'use client';

import { useState, useMemo } from 'react';
import {
  Shield,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Play,
  ClipboardList,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PRUEBAS_INITIAL, type SecurityTestItem } from '@/lib/data-pruebas';
import { SecurityTestsActivePage } from '@/app/(secops)/pruebas-seguridad/page';
import { cn } from '@/lib/utils';

export default function SecurityTestsCatalogPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'active'>('catalog');
  const [items] = useState<SecurityTestItem[]>(PRUEBAS_INITIAL);
  const [search, setSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedService, setSelectedService] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Lists for dropdown options
  const platforms = useMemo(() => {
    return ['all', ...Array.from(new Set(items.map((i) => i.plataforma)))];
  }, [items]);

  const services = useMemo(() => {
    return ['all', ...Array.from(new Set(items.map((i) => i.servicioTecnologico)))];
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.idPruebaSeguridad.toLowerCase().includes(search.toLowerCase()) ||
        item.nombrePrueba.toLowerCase().includes(search.toLowerCase()) ||
        item.descripcionPrueba.toLowerCase().includes(search.toLowerCase());

      const matchesPlatform = selectedPlatform === 'all' || item.plataforma === selectedPlatform;
      const matchesService = selectedService === 'all' || item.servicioTecnologico === selectedService;

      return matchesSearch && matchesPlatform && matchesService;
    });
  }, [items, search, selectedPlatform, selectedService]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="size-8 text-cyan-500" />
            Catálogo de Pruebas de Seguridad
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-xs">
            Casos de prueba base y guías técnicas de ejecución para instanciar en auditorías de seguridad activas.
          </p>
        </div>

        {/* View Mode Toggle Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-card border border-border/60 shadow-sm shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer',
              activeTab === 'catalog'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            <ClipboardList className="size-3.5" />
            <span>Plantillas & Catálogo Maestro</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer',
              activeTab === 'active'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
            )}
          >
            <Play className="size-3.5" />
            <span>Ejecución de Pruebas Activas</span>
          </button>
        </div>
      </div>

      {activeTab === 'active' && (
        <div className="animate-in fade-in duration-150">
          <SecurityTestsActivePage />
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Filters Card */}
          <Card className="border-border/40 bg-card/60 shadow-sm rounded-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Filter className="size-4 text-cyan-500" />
                Filtros y Búsqueda del Catálogo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Search */}
                <div className="relative col-span-1 sm:col-span-2">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Buscar por ID de prueba, nombre o descripción..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Plataforma */}
                <label className="text-[10px] text-muted-foreground flex flex-col gap-1.5">
                  Plataforma:
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  >
                    {platforms.map((p) => (
                      <option key={p} value={p}>
                        {p === 'all' ? 'Todas las Plataformas' : p}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Servicio */}
                <label className="text-[10px] text-muted-foreground flex flex-col gap-1.5">
                  Servicio Tecnológico:
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
              </div>
            </CardContent>
          </Card>

          {/* Tests Catalog Table / Accordion */}
          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <Card className="border-border/40 p-12 text-center text-muted-foreground italic text-xs">
                No se encontraron pruebas de seguridad con los filtros aplicados
              </Card>
            ) : (
              filteredItems.map((test) => {
                const isExpanded = expandedId === test.id;
                return (
                  <Card
                    key={test.id}
                    className={`border-border/40 hover:border-cyan-500/50 bg-card/60 transition-all duration-300 rounded-xl overflow-hidden shadow-sm ${
                      isExpanded ? 'ring-1 ring-cyan-500/20' : ''
                    }`}
                  >
                    {/* Header Summary Row */}
                    <div
                      onClick={() => toggleExpand(test.id)}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg shrink-0 bg-muted text-muted-foreground">
                          <Shield className="size-5" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-mono text-xs font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                              {test.idPruebaSeguridad}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                              {test.servicioTecnologico} · {test.plataforma}
                            </span>
                          </div>
                          <h3 className="text-xs font-semibold text-foreground truncate max-w-[320px] sm:max-w-[450px]">
                            {test.nombrePrueba}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Expand Arrow */}
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Details Section */}
                    {isExpanded && (
                      <div className="border-t border-border/20 p-5 bg-muted/10 space-y-6 text-xs text-muted-foreground leading-relaxed">
                        {/* Test Info Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Platform details */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Asociaciones</span>
                            <p><span className="font-medium text-foreground/80">Evaluación Asociada:</span> {test.evaluacionAsociada}</p>
                            <p><span className="font-medium text-foreground/80">Categoría:</span> {test.categoria}</p>
                          </div>

                          {/* Mappings */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Estándares & MITRE</span>
                            {test.cwe && <p><span className="font-medium text-foreground/80">CWE:</span> {test.cwe}</p>}
                            {test.mitreTactica && (
                              <>
                                <p><span className="font-medium text-foreground/80">Táctica:</span> {test.mitreTactica}</p>
                                <p><span className="font-medium text-foreground/80">Técnica:</span> {test.mitreTecnica} ({test.mitreId})</p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Detailed Purpose */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground block">Descripción de la Prueba</span>
                          <p className="text-foreground">{test.descripcionPrueba}</p>
                        </div>

                        {/* Commands section */}
                        {(test.comandoBulk || test.comandoSingle || test.targetsFile) && (
                          <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3 font-mono text-[11px] leading-relaxed">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground block font-sans">
                              Comandos de Comprobación Sugeridos
                            </span>
                            {test.targetsFile && (
                              <p className="text-foreground"><span className="text-muted-foreground font-sans">Archivo de targets:</span> {test.targetsFile}</p>
                            )}
                            {test.comandoSingle && (
                              <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground font-sans block">Comando para un solo target:</span>
                                <pre className="bg-[#0f141c] text-[#a5b4fc] p-3 rounded-lg overflow-x-auto select-all">{test.comandoSingle}</pre>
                              </div>
                            )}
                            {test.comandoBulk && (
                              <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground font-sans block">Comando Bulk (varios targets):</span>
                                <pre className="bg-[#0f141c] text-[#a5b4fc] p-3 rounded-lg overflow-x-auto select-all">{test.comandoBulk}</pre>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Burp Suite filters */}
                        {(test.filtroBurpHistory || test.filtroBurpSearch || test.snippetDeveloperConsole) && (
                          <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3 font-mono text-[11px] leading-relaxed">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground block font-sans">
                              Filtros de Verificación Sugeridos (Burp Suite / Consola)
                            </span>
                            {test.filtroBurpHistory && (
                              <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground font-sans block">Filtro de Burp Suite HTTP History:</span>
                                <pre className="bg-[#0f141c] text-indigo-300 p-3 rounded-lg overflow-x-auto select-all">{test.filtroBurpHistory}</pre>
                              </div>
                            )}
                            {test.filtroBurpSearch && (
                              <div className="space-y-1">
                                <span className="text-[10px] text-muted-foreground font-sans block">Expresión Regular para Burp Suite Search:</span>
                                <pre className="bg-[#0f141c] text-indigo-300 p-3 rounded-lg overflow-x-auto select-all">{test.filtroBurpSearch}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
