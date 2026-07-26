/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ArrowLeft,
  ShieldAlert,
  Code,
  Globe,
  FileArchive,
  Workflow,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PhantomService,
  ServiceType,
  ScopeType,
  ServicesCatalogViewMode,
  SecurityTestCase,
  ServiceVulnerability,
} from './types';
import { SecurityTestsTab, computeEmbeddedCommand } from './SecurityTestsTab';
import { VulnerabilitiesTab } from './VulnerabilitiesTab';

// Pre-seeded default sample services
const SEED_SERVICES: PhantomService[] = [
  {
    id: 'srv-api-01',
    code: 'SRV-API-99',
    name: 'API Banking Gateway Pentest',
    clientName: 'Banco Banorte',
    type: 'API Testing',
    status: 'in_progress',
    executionMode: 'manual',
    createdAt: '2026-07-20',
    updatedAt: '2026-07-25',
    scope: {
      type: 'single',
      singleTarget: 'https://api.banorte.com/v1/services',
      targetsFileName: 'targets.txt',
    },
    testCases: [
      {
        id: 'tc-seed-1',
        code: 'API1:2023-BOLA',
        title: 'Broken Object Level Authorization (BOLA / IDOR)',
        category: 'OWASP API Security Top 10',
        serviceType: 'API Testing',
        description: 'Verificar acceso no autorizado a recursos de otros usuarios en /v1/services/{id}.',
        status: 'vulnerable',
        commandTemplate: 'curl -s -X GET "{TARGET}/users/1002" -H "Authorization: Bearer {TOKEN}"',
        computedCommand: 'curl -s -X GET "https://api.banorte.com/v1/services/users/1002" -H "Authorization: Bearer {TOKEN}"',
        derivedVulnerabilitiesCount: 1,
        evidenceNotes: 'Petición devuelta con HTTP 200 OK expuso datos de cuenta ajena.',
      },
      {
        id: 'tc-seed-2',
        code: 'API2:2023-AUTH',
        title: 'Broken Authentication & Token Flaws',
        category: 'OWASP API Security Top 10',
        serviceType: 'API Testing',
        description: 'Verificar vulnerabilidades en firmas JWT y algoritmo de encriptación.',
        status: 'passed',
        commandTemplate: 'jwt_tool {TOKEN} -X b -I -pc name -pv admin',
        computedCommand: 'jwt_tool {TOKEN} -X b -I -pc name -pv admin',
        derivedVulnerabilitiesCount: 0,
      },
    ],
    vulnerabilities: [
      {
        id: 'vuln-seed-1',
        code: 'VULN-8821',
        title: 'Broken Object Level Authorization (BOLA) en Endpoint /v1/services/users',
        severity: 'High',
        cvss: 8.5,
        testCaseId: 'tc-seed-1',
        testCaseTitle: 'Broken Object Level Authorization (BOLA / IDOR)',
        affectedTarget: 'https://api.banorte.com/v1/services',
        description: 'Se constató que al modificar el ID numérico de usuario en la URI del API REST, el servidor retorna la estructura JSON con información financiera confidencial de otro cliente sin validar la pertenencia del token JWT.',
        remediation: 'Implementar control de acceso a nivel de objeto validando el ID extraído del contexto de sesión del JWT contra la base de datos.',
        createdAt: '2026-07-22',
      },
    ],
  },
  {
    id: 'meth-web-02',
    code: 'SRV-WEB-02',
    name: 'Auditoría Web Portal Clientes',
    clientName: 'Empresa Global SA',
    type: 'Web Application Testing (OWASP)',
    status: 'in_progress',
    executionMode: 'manual',
    createdAt: '2026-07-15',
    updatedAt: '2026-07-24',
    scope: {
      type: 'multiple',
      multipleTargets: ['192.168.1.10', '192.168.1.11', 'app.empresa.com'],
      targetsFileName: 'targets.txt',
    },
    testCases: [
      {
        id: 'tc-web-1',
        code: 'WSTG-INJV-01',
        title: 'Testing for SQL Injection (SQLi)',
        category: 'WSTG - Injection',
        serviceType: 'Web Application Testing (OWASP)',
        description: 'Auditar parámetros de formulario de búsqueda y login ante inyección de código SQL.',
        status: 'passed',
        commandTemplate: 'sqlmap -u "{TARGET}/search?item=test" --batch --dbs',
        computedCommand: 'sqlmap -u "-iL targets.txt/search?item=test" --batch --dbs',
        derivedVulnerabilitiesCount: 0,
      },
    ],
    vulnerabilities: [],
  },
];

export function PhantomServicesManager() {
  const [services, setServices] = useState<PhantomService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ServicesCatalogViewMode>('grid');
  const [activeTab, setActiveTab] = useState<'tests' | 'vulnerabilities' | 'tools'>('tests');

  // New Service Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newServiceType, setNewServiceType] = useState<ServiceType>('API Testing');
  const [newScopeType, setNewScopeType] = useState<ScopeType>('single');
  const [newSingleTarget, setNewSingleTarget] = useState('');
  const [newMultipleTargets, setNewMultipleTargets] = useState('');
  const [newExecutionMode, setNewExecutionMode] = useState<'tools_file' | 'manual'>('manual');
  const [sastArchiveFile, setSastArchiveFile] = useState<File | null>(null);

  // Load state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('phantom_services_list');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setServices(parsed);
          } else {
            setServices(SEED_SERVICES);
          }
        } catch {
          setServices(SEED_SERVICES);
        }
      } else {
        setServices(SEED_SERVICES);
      }
    }
  }, []);

  // Save state on change
  useEffect(() => {
    if (services.length > 0) {
      localStorage.setItem('phantom_services_list', JSON.stringify(services));
    }
  }, [services]);

  const activeService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    const targetsList = newMultipleTargets
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    const newService: PhantomService = {
      id: `srv-${Date.now()}`,
      code: `SRV-${Math.floor(100 + Math.random() * 900)}`,
      name: newServiceName.trim(),
      clientName: newClientName.trim() || 'Cliente Corporativo',
      type: newServiceType,
      status: 'in_progress',
      executionMode: newExecutionMode,
      scope: {
        type: newScopeType,
        singleTarget: newSingleTarget.trim() || 'https://api.target.com/v1',
        multipleTargets: targetsList.length > 0 ? targetsList : ['192.168.1.1', 'target.com'],
        targetsFileName: 'targets.txt',
        sastArchiveName: sastArchiveFile ? sastArchiveFile.name : undefined,
      },
      testCases: [],
      vulnerabilities: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setServices((prev) => [newService, ...prev]);
    setSelectedServiceId(newService.id);
    setIsCreateModalOpen(false);
    setNewServiceName('');
    setNewClientName('');
    setNewSingleTarget('');
    setNewMultipleTargets('');
  };

  const handleUpdateTestCases = (newTestCases: SecurityTestCase[]) => {
    if (!selectedServiceId) return;
    setServices((prev) =>
      prev.map((s) => (s.id === selectedServiceId ? { ...s, testCases: newTestCases, updatedAt: new Date().toISOString() } : s))
    );
  };

  const handleUpdateVulnerabilities = (newVulns: ServiceVulnerability[]) => {
    if (!selectedServiceId) return;
    setServices((prev) =>
      prev.map((s) => (s.id === selectedServiceId ? { ...s, vulnerabilities: newVulns, updatedAt: new Date().toISOString() } : s))
    );
  };

  const handleAddTestCaseAndLink = (testCase: SecurityTestCase, vuln: ServiceVulnerability) => {
    if (!activeService) return;
    const updatedTestCases = [testCase, ...activeService.testCases];
    const updatedVulns = [vuln, ...activeService.vulnerabilities];
    setServices((prev) =>
      prev.map((s) => (s.id === selectedServiceId ? { ...s, testCases: updatedTestCases, vulnerabilities: updatedVulns } : s))
    );
  };

  return (
    <div className="w-full flex-1 flex flex-col p-6 max-w-[1600px] mx-auto min-h-screen">
      {/* Catalog Services Screen (When no service selected) */}
      {!activeService ? (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Workflow className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Gestor de Servicios de Seguridad
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-400 font-mono">
                    Phantom SoW Core
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Crea y gestiona servicios de API Testing, Web OWASP, SAST e Infraestructura con SoW de targets embebidos.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20 transition-all hover:scale-[1.02] shrink-0"
            >
              <Plus className="size-4" />
              Crear Nuevo Servicio
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Servicios Activos ({services.length})
            </h3>

            <div className="flex items-center gap-1 border border-border/60 rounded-xl bg-background p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-lg text-xs transition-colors',
                  viewMode === 'grid' ? 'bg-violet-500/20 text-violet-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-lg text-xs transition-colors',
                  viewMode === 'list' ? 'bg-violet-500/20 text-violet-400 font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          {/* Services Content Grid vs List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  onClick={() => setSelectedServiceId(srv.id)}
                  className="group bg-card hover:bg-muted/20 border border-border/60 hover:border-violet-500/40 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between gap-4 cursor-pointer shadow-sm hover:shadow-violet-500/5 relative overflow-hidden"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {srv.code}
                      </span>
                      <span className="text-[11px] font-semibold text-foreground truncate">{srv.type}</span>
                    </div>

                    <h3 className="text-base font-semibold text-foreground group-hover:text-violet-400 transition-colors line-clamp-1">
                      {srv.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{srv.clientName}</p>
                  </div>

                  <div className="border-t border-border/40 pt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                      <span>SoW Target:</span>
                      <strong className="text-foreground truncate max-w-[160px]">
                        {srv.scope.type === 'single' ? srv.scope.singleTarget : `Múltiple (${srv.scope.targetsFileName})`}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                      <span>Pruebas / Vulns:</span>
                      <strong className="text-violet-400">
                        {srv.testCases.length} pruebas | {srv.vulnerabilities.length} vulns
                      </strong>
                    </div>

                    <div className="pt-2 flex items-center justify-end">
                      <span className="text-xs font-semibold text-violet-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Gestionar Servicio
                        <ChevronRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 font-semibold text-muted-foreground uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Servicio</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">SoW Scope Target</th>
                    <th className="px-4 py-3 text-center">Pruebas</th>
                    <th className="px-4 py-3 text-center">Vulns</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {services.map((srv) => (
                    <tr
                      key={srv.id}
                      onClick={() => setSelectedServiceId(srv.id)}
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-violet-400">{srv.code}</td>
                      <td className="px-4 py-3 font-bold text-foreground group-hover:text-violet-400">
                        {srv.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-semibold">{srv.type}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground truncate max-w-[200px]">
                        {srv.scope.type === 'single' ? srv.scope.singleTarget : `-iL ${srv.scope.targetsFileName}`}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">{srv.testCases.length}</td>
                      <td className="px-4 py-3 text-center font-mono text-red-400 font-bold">{srv.vulnerabilities.length}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-3 py-1 rounded-xl bg-violet-500/10 text-violet-400 font-semibold text-[11px]">
                          Abrir
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Detailed Service Screen with Top Tabs */
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedServiceId(null)}
                className="px-3 py-1.5 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                <span>Volver a Servicios</span>
              </button>

              <div className="h-5 w-px bg-border/60" />

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.2 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    {activeService.code}
                  </span>
                  <h2 className="text-base font-bold text-foreground">{activeService.name}</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {activeService.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  SoW Scope Target:{' '}
                  <strong>
                    {activeService.scope.type === 'single'
                      ? activeService.scope.singleTarget
                      : `Múltiple (-iL ${activeService.scope.targetsFileName})`}
                  </strong>
                </p>
              </div>
            </div>

            {/* Top Tabs Switcher */}
            <div className="flex items-center gap-1 border border-border/70 rounded-xl bg-background p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('tests')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all',
                  activeTab === 'tests' ? 'bg-violet-500/20 text-violet-400 font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Shield className="size-3.5" />
                <span>Pruebas de Seguridad ({activeService.testCases.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vulnerabilities')}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all',
                  activeTab === 'vulnerabilities' ? 'bg-red-500/20 text-red-400 font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ShieldAlert className="size-3.5" />
                <span>Vulnerabilidades ({activeService.vulnerabilities.length})</span>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'tests' && (
            <SecurityTestsTab
              service={activeService}
              onUpdateTestCases={handleUpdateTestCases}
              onDeriveVulnerability={(tc) => {
                setActiveTab('vulnerabilities');
              }}
            />
          )}

          {activeTab === 'vulnerabilities' && (
            <VulnerabilitiesTab
              service={activeService}
              onUpdateVulnerabilities={handleUpdateVulnerabilities}
              onAddTestCaseAndLink={handleAddTestCaseAndLink}
            />
          )}
        </div>
      )}

      {/* CREATE NEW SERVICE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="size-4 text-violet-400" />
                Crear Nuevo Servicio de Seguridad (Phantom SoW)
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Nombre del Servicio</label>
                <input
                  type="text"
                  required
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Ej: API Gateway Banking Pentest 2026"
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Cliente / Organización</label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Ej: Banorte"
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">Tipo de Servicio</label>
                  <select
                    value={newServiceType}
                    onChange={(e) => setNewServiceType(e.target.value as ServiceType)}
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-violet-500 font-semibold"
                  >
                    <option value="API Testing">API Testing (REST / SOAP / GraphQL)</option>
                    <option value="Web Application Testing (OWASP)">Web Application Testing (OWASP WSTG)</option>
                    <option value="Infrastructure Pentest">Infrastructure & AD Pentest</option>
                    <option value="SAST Static Analysis">SAST Static Analysis (Código Fuente)</option>
                    <option value="Cloud & Container Security">Cloud & Container Security</option>
                  </select>
                </div>
              </div>

              {/* SAST SPECIAL CASE: PROJECT SOURCE CODE ARCHIVE UPLOAD */}
              {newServiceType === 'SAST Static Analysis' && (
                <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl space-y-2">
                  <label className="block font-semibold text-violet-300 flex items-center gap-1.5">
                    <FileArchive className="size-4 text-violet-400" />
                    Cargar Proyecto de Código Fuente (.zip / .tar / .rar)
                  </label>
                  <input
                    type="file"
                    accept=".zip,.tar,.tar.gz,.rar"
                    onChange={(e) => setSastArchiveFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500"
                  />
                  {sastArchiveFile && (
                    <p className="text-[11px] font-mono text-emerald-400">
                      Archivo cargado: {sastArchiveFile.name} ({(sastArchiveFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              )}

              {/* SoW Scope Definition (Single vs Multiple Targets) */}
              <div className="p-4 bg-muted/20 border border-border/60 rounded-xl space-y-3">
                <label className="block font-bold text-foreground">Definición de Alcance (SoW Scope / Targets)</label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewScopeType('single')}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                      newScopeType === 'single'
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    <span>Single Target (Un Solo Objetivo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewScopeType('multiple')}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                      newScopeType === 'multiple'
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    <span>Multiple Targets (Archivo targets.txt)</span>
                  </button>
                </div>

                {newScopeType === 'single' ? (
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Target Concreto (URL / IP / Host FQDN)
                    </label>
                    <input
                      type="text"
                      value={newSingleTarget}
                      onChange={(e) => setNewSingleTarget(e.target.value)}
                      placeholder="Ej: https://api.banorte.com/v1 u 192.168.1.100"
                      className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 font-mono text-foreground focus:outline-none focus:border-violet-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                      Listado de Targets (IPs, CIDRs, FQDNs, URLs uno por línea)
                    </label>
                    <textarea
                      rows={3}
                      value={newMultipleTargets}
                      onChange={(e) => setNewMultipleTargets(e.target.value)}
                      placeholder={"192.168.1.1\n192.168.1.0/24\napi.empresa.com\nhttps://app.empresa.com"}
                      className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 font-mono text-foreground focus:outline-none focus:border-violet-500 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Execution Mode Selection */}
              <div>
                <label className="block font-medium text-foreground mb-1">Modo de Ejecución de Pruebas</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewExecutionMode('manual')}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                      newExecutionMode === 'manual'
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    <span>Comenzar Pruebas Manuales</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewExecutionMode('tools_file')}
                    className={cn(
                      'p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all',
                      newExecutionMode === 'tools_file'
                        ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                        : 'border-border bg-background text-muted-foreground'
                    )}
                  >
                    <span>Cargar Archivos de Herramientas</span>
                  </button>
                </div>
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
                  Crear Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
