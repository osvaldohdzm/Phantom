'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ClipboardCheck,
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
  Sparkles,
  Target,
  FileCode,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EVALUACIONES_INITIAL, type EvaluacionItem } from '@/lib/data-evaluaciones';
import { PRUEBAS_INITIAL, type SecurityTestItem } from '@/lib/data-pruebas';

interface ActiveEvaluationInstance {
  id: string;
  name: string;
  projectName: string;
  type: 'Web' | 'Infraestructura' | 'Infraestructura en Nube';
  createdAt: string;
  tasks: EvaluacionItem[];
  // Target credentials/details linked
  singleTarget?: string;
  targetsFile?: string;
}

export default function EvaluationsActivePage() {
  const [instances, setInstances] = useState<ActiveEvaluationInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchChecklist, setSearchChecklist] = useState('');

  // Form State for new instance
  const [newInstName, setNewInstName] = useState('');
  const [newInstProject, setNewInstProject] = useState('');
  const [newInstType, setNewInstType] = useState<'Web' | 'Infraestructura' | 'Infraestructura en Nube'>('Web');
  const [newInstTarget, setNewInstTarget] = useState('');
  const [newInstTargetsFile, setNewInstTargetsFile] = useState('BurpItems.txt');

  // Load state on mount from localStorage
  useEffect(() => {
    const savedEval = localStorage.getItem('spectre_active_evaluations');
    if (savedEval) {
      try {
        const parsed = JSON.parse(savedEval);
        setInstances(parsed);
        if (parsed.length > 0) {
          setSelectedInstanceId(parsed[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed default evaluations
      const defaults: ActiveEvaluationInstance[] = [
        {
          id: 'inst-1',
          name: 'Auditoría Externa de Red Q3',
          projectName: 'Digital Banking Platform (EIM ID – 9847446)',
          type: 'Infraestructura',
          createdAt: '2026-07-01',
          singleTarget: '10.100.20.14',
          targetsFile: 'InfrastructureTargets.txt',
          tasks: EVALUACIONES_INITIAL.filter((item) => item.tipo === 'Infraestructura').map((t, idx) => ({
            ...t,
            enAlcance: idx < 12,
            completado: idx < 5,
          })),
        },
        {
          id: 'inst-2',
          name: 'Análisis Web DAST - Portal Cliente',
          projectName: 'Client Portal App (COMET ID 152318)',
          type: 'Web',
          createdAt: '2026-07-05',
          singleTarget: 'clientportal.spectre.local',
          targetsFile: 'BurpItems.txt',
          tasks: EVALUACIONES_INITIAL.filter((item) => item.tipo === 'Web').map((t, idx) => ({
            ...t,
            enAlcance: true,
            completado: idx < 3,
          })),
        },
      ];
      setInstances(defaults);
      setSelectedInstanceId(defaults[0].id);
      localStorage.setItem('spectre_active_evaluations', JSON.stringify(defaults));
    }
  }, []);

  const selectedInstance = useMemo(() => {
    return instances.find((inst) => inst.id === selectedInstanceId) || instances[0];
  }, [instances, selectedInstanceId]);

  const saveInstances = (newInsts: ActiveEvaluationInstance[]) => {
    setInstances(newInsts);
    localStorage.setItem('spectre_active_evaluations', JSON.stringify(newInsts));
  };

  // Create active instance from catalog template
  const handleCreateInstance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstName.trim() || !newInstProject.trim()) return;

    // Filter matching checklist tasks from templates to seed this instance's tasks
    const templateTasks = EVALUACIONES_INITIAL.filter(
      (item) => item.tipo === newInstType
    ).map((t) => ({
      ...t,
      enAlcance: true, // Default template tasks to active
      completado: false,
    }));

    const instId = `inst-${Date.now()}`;
    const newInst: ActiveEvaluationInstance = {
      id: instId,
      name: newInstName,
      projectName: newInstProject,
      type: newInstType,
      createdAt: new Date().toISOString().split('T')[0],
      singleTarget: newInstTarget || '127.0.0.1',
      targetsFile: newInstTargetsFile || 'BurpItems.txt',
      tasks: templateTasks,
    };

    // Save active evaluation
    const updatedEvaluations = [newInst, ...instances];
    saveInstances(updatedEvaluations);

    // AUTOMATICALLY CREATE THE CORRESPONDING ACTIVE SECURITY TEST SUITE!
    // Since evaluations map to technical test cases, we seed them dynamically.
    const savedTestSuites = localStorage.getItem('spectre_active_test_suites');
    let currentSuites = [];
    if (savedTestSuites) {
      try {
        currentSuites = JSON.parse(savedTestSuites);
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed default suite if not found
      currentSuites = [
        {
          id: 'suite-1',
          name: 'Prueba de Pentest WSTG - Banco Digital',
          projectName: 'Digital Banking Portal (EIM ID – 9847446)',
          framework: 'CROS Web Application Security Testing (WSTG) v2.0.0',
          createdAt: '2026-07-02',
          tests: PRUEBAS_INITIAL.map((t) => ({ ...t })),
        },
      ];
    }

    const testSuiteId = `suite-${Date.now()}`;
    const mappedTests: SecurityTestItem[] = PRUEBAS_INITIAL.map((t) => {
      // Tailor the test cases to match the type of evaluation
      const updatedTest = { ...t };
      updatedTest.idServicio = `${newInstProject} - Service Suite`;
      updatedTest.singleTarget = newInstTarget || '';
      updatedTest.targetsFile = newInstTargetsFile || 'BurpItems.txt';

      if (newInstType === 'Infraestructura') {
        updatedTest.plataforma = 'NETWORK';
        updatedTest.evaluacionAsociada = 'CROS Infrastructure & Service Testing v2.0.0';
      } else if (newInstType === 'Infraestructura en Nube') {
        updatedTest.plataforma = 'CLOUD';
        updatedTest.evaluacionAsociada = 'CROS Cloud CSPM Audit Checklists v1.0.0';
      } else {
        updatedTest.plataforma = 'WEB';
        updatedTest.evaluacionAsociada = 'CROS Web Application Security Testing (WSTG) v2.0.0';
      }

      return updatedTest;
    });

    const newTestSuite = {
      id: testSuiteId,
      name: `Pruebas Técnicas - ${newInstName}`,
      projectName: newInstProject,
      framework: newInstType === 'Web'
        ? 'CROS Web Application Security Testing (WSTG) v2.0.0'
        : newInstType === 'Infraestructura'
          ? 'CROS Infrastructure & Service Testing v2.0.0'
          : 'CROS Cloud CSPM Audit Checklists v1.0.0',
      createdAt: new Date().toISOString().split('T')[0],
      tests: mappedTests,
    };

    const updatedSuites = [newTestSuite, ...currentSuites];
    localStorage.setItem('spectre_active_test_suites', JSON.stringify(updatedSuites));

    // Reset Form
    setSelectedInstanceId(newInst.id);
    setShowCreateModal(false);
    setNewInstName('');
    setNewInstProject('');
    setNewInstTarget('');
    setNewInstTargetsFile('BurpItems.txt');
  };

  // Toggle tasks in active instance
  const handleToggleScope = (taskId: number) => {
    const updated = instances.map((inst) => {
      if (inst.id !== selectedInstanceId) return inst;
      return {
        ...inst,
        tasks: inst.tasks.map((t) => (t.id === taskId ? { ...t, enAlcance: !t.enAlcance } : t)),
      };
    });
    saveInstances(updated);
  };

  const handleToggleCompleted = (taskId: number) => {
    const updated = instances.map((inst) => {
      if (inst.id !== selectedInstanceId) return inst;
      return {
        ...inst,
        tasks: inst.tasks.map((t) => (t.id === taskId ? { ...t, completado: !t.completado } : t)),
      };
    });
    saveInstances(updated);
  };

  const handleDeleteInstance = (id: string) => {
    const remaining = instances.filter((inst) => inst.id !== id);
    saveInstances(remaining);
    if (selectedInstanceId === id && remaining.length > 0) {
      setSelectedInstanceId(remaining[0].id);
    }
  };

  // Filter tasks inside the checklist
  const filteredTasks = useMemo(() => {
    if (!selectedInstance) return [];
    return selectedInstance.tasks.filter((t) => {
      return (
        t.folio.toLowerCase().includes(searchChecklist.toLowerCase()) ||
        t.actividad.toLowerCase().includes(searchChecklist.toLowerCase()) ||
        t.descripcion.toLowerCase().includes(searchChecklist.toLowerCase())
      );
    });
  }, [selectedInstance, searchChecklist]);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="size-8 text-cyan-500 animate-pulse" />
            Evaluaciones Activas
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-xs">
            Crea y ejecuta listas de verificación de seguridad instanciadas desde el Catálogo de Evaluaciones. Al crear una evaluación, sus Pruebas de Seguridad técnicas se instanciarán de forma automática con los targets indicados.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center gap-1 px-4 py-2 rounded-lg"
        >
          <Plus className="size-4" />
          Nueva Instancia
        </Button>
      </div>

      {/* Main Grid: Left sidebar with active checklist cards, Right details view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Instantiated Runs List */}
        <div className="space-y-4 col-span-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instancias en Ejecución</h2>
          {instances.length === 0 ? (
            <Card className="border-border/40 p-8 text-center text-muted-foreground text-xs italic">
              No hay instancias activas creadas. Crea una nueva usando el botón superior.
            </Card>
          ) : (
            instances.map((inst) => {
              const completedCount = inst.tasks.filter((t) => t.enAlcance && t.completado).length;
              const inScopeCount = inst.tasks.filter((t) => t.enAlcance).length;
              const percent = inScopeCount > 0 ? Math.round((completedCount / inScopeCount) * 100) : 0;
              const isSelected = inst.id === selectedInstanceId;

              return (
                <div
                  key={inst.id}
                  onClick={() => setSelectedInstanceId(inst.id)}
                  className={`p-4 border rounded-xl cursor-pointer transition-all duration-300 relative group flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-cyan-500/50 bg-cyan-500/5 shadow-md shadow-cyan-500/5'
                      : 'border-border/40 bg-card/40 hover:bg-muted/15'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                        {inst.type}
                      </span>
                      <h3 className="text-xs font-bold text-foreground mt-2 leading-snug">{inst.name}</h3>
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-1">{inst.projectName}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteInstance(inst.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-500 rounded transition-all shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  {/* Targets Metadata badge */}
                  {inst.singleTarget && (
                    <div className="text-[9px] text-cyan-400/90 font-mono flex items-center gap-1.5 bg-cyan-500/5 px-2 py-1 rounded border border-cyan-500/10 self-start">
                      <Target className="size-3" />
                      <span>{inst.singleTarget}</span>
                    </div>
                  )}

                  {/* Progress Meter */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                      <span>Checklist Progreso:</span>
                      <span>
                        {completedCount}/{inScopeCount} ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Detailed Checklist and Activities */}
        {selectedInstance ? (
          <Card className="lg:col-span-2 border-border/40 bg-card/60 rounded-xl overflow-hidden flex flex-col">
            <CardHeader className="border-b border-border/40 pb-4 bg-muted/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="size-5 text-cyan-500 animate-spin" style={{ animationDuration: '3s' }} />
                    {selectedInstance.name}
                  </CardTitle>
                  <CardDescription className="text-xs font-mono mt-1 text-muted-foreground">
                    Proyecto: {selectedInstance.projectName} | Creado: {selectedInstance.createdAt}
                  </CardDescription>
                </div>
              </div>
              {/* Target information display */}
              <div className="grid grid-cols-2 gap-4 mt-3 bg-background/50 p-2.5 rounded-lg border border-border/40 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground block">TARGET OBJETIVO:</span>
                  <span className="text-cyan-400 font-bold font-mono">{selectedInstance.singleTarget || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground block">ARCHIVO DE TARGETS:</span>
                  <span className="text-indigo-400 font-bold font-mono">{selectedInstance.targetsFile || '—'}</span>
                </div>
              </div>
            </CardHeader>

            {/* Checklist Search and Stats */}
            <div className="p-4 border-b border-border/20 bg-muted/10 flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrar checklist..."
                  value={searchChecklist}
                  onChange={(e) => setSearchChecklist(e.target.value)}
                  className="w-full h-8 pl-8 pr-4 rounded-lg border border-input bg-background/50 text-[11px] focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
                <span>
                  Alcance:{' '}
                  <strong className="text-foreground">
                    {selectedInstance.tasks.filter((t) => t.enAlcance).length}
                  </strong>
                </span>
                <span>|</span>
                <span>
                  Completados:{' '}
                  <strong className="text-emerald-500">
                    {selectedInstance.tasks.filter((t) => t.enAlcance && t.completado).length}
                  </strong>
                </span>
              </div>
            </div>

            {/* Checklist Scrollable Table */}
            <div className="overflow-x-auto grow">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/30 bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground select-none">
                    <th className="p-3 w-10 text-center">Id</th>
                    <th className="p-3 w-32">Folio</th>
                    <th className="p-3 w-28 text-center">En Alcance</th>
                    <th className="p-3 w-32">Fase</th>
                    <th className="p-3 w-36">Actividad</th>
                    <th className="p-3 w-24 text-center">Completado</th>
                    <th className="p-3 min-w-[200px]">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-xs">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-muted-foreground italic">
                        No hay actividades que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((task) => (
                      <tr
                        key={task.id}
                        className={`hover:bg-muted/10 transition-colors ${
                          !task.enAlcance
                            ? 'opacity-40 bg-muted/5'
                            : task.completado
                              ? 'bg-emerald-500/5'
                              : 'bg-background/20'
                        }`}
                      >
                        {/* ID */}
                        <td className="p-3 text-center text-[10px] font-mono text-muted-foreground">
                          {task.id}
                        </td>

                        {/* Folio */}
                        <td className="p-3 font-mono font-bold text-[10px]">{task.folio}</td>

                        {/* Toggle En Alcance */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleScope(task.id)}
                            className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                              task.enAlcance
                                ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                                : 'bg-muted text-muted-foreground border-border/40 hover:bg-muted/80'
                            }`}
                          >
                            {task.enAlcance ? 'Sí' : 'No'}
                          </button>
                        </td>

                        {/* Fase */}
                        <td className="p-3 font-semibold text-foreground/80">{task.fase}</td>

                        {/* Actividad */}
                        <td className="p-3 font-bold">{task.actividad}</td>

                        {/* Toggle Completado */}
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            disabled={!task.enAlcance}
                            onClick={() => handleToggleCompleted(task.id)}
                            className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all disabled:opacity-20 ${
                              task.completado
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                : 'bg-muted text-muted-foreground border-border/40 hover:bg-muted/80'
                            }`}
                          >
                            <Check className={`size-3 ${task.completado ? 'opacity-100' : 'opacity-20'}`} />
                          </button>
                        </td>

                        {/* Descripción */}
                        <td className="p-3 text-muted-foreground font-light leading-relaxed">
                          {task.descripcion}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center border border-dashed border-border rounded-xl p-12 text-muted-foreground italic text-xs">
            Selecciona una instancia a la izquierda para ver su lista de verificación.
          </div>
        )}
      </div>

      {/* Instantiation Dialog/Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border bg-card/90 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ClipboardCheck className="size-5 text-cyan-500" />
                Instanciar Evaluación desde Plantilla
              </CardTitle>
              <CardDescription className="text-xs">
                Selecciona una plantilla del catálogo de evaluaciones. Los targets ingresados se configurarán en sus pruebas de seguridad automáticamente.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateInstance}>
              <CardContent className="space-y-4 p-5">
                {/* Instance Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Nombre de la Instancia:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pentest Web OWASP Portal"
                    value={newInstName}
                    onChange={(e) => setNewInstName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Project Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Nombre del Proyecto / Servicio de Seguridad:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Digital Banking Platform (EIM 9847)"
                    value={newInstProject}
                    onChange={(e) => setNewInstProject(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Plantilla / Type Select */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Plantilla de Catálogo (Tipo):
                  </label>
                  <select
                    value={newInstType}
                    onChange={(e) =>
                      setNewInstType(e.target.value as 'Web' | 'Infraestructura' | 'Infraestructura en Nube')
                    }
                    className="w-full h-9 px-2 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  >
                    <option value="Web">Web (Sección Acunetix, Burp, Wappalyzer)</option>
                    <option value="Infraestructura">Infraestructura (Sección Netdiscover, Nmap, Nessus)</option>
                    <option value="Infraestructura en Nube">Infraestructura en Nube (Sección Cloud, CSPM)</option>
                  </select>
                </div>

                {/* Dynamic Target Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                    <Target className="size-3.5" />
                    Target Objetivo (Single):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. digitalbanking.spectre.local o 10.0.0.1"
                    value={newInstTarget}
                    onChange={(e) => setNewInstTarget(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                {/* Dynamic Targets File Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                    <FileCode className="size-3.5" />
                    Archivo de Targets (Bulk):
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. BurpItems.txt"
                    value={newInstTargetsFile}
                    onChange={(e) => setNewInstTargetsFile(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </CardContent>

              {/* Actions footer */}
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
                  Crear Instancia
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
