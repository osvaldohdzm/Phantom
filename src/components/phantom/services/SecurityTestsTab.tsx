/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Shield,
  Search,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Terminal,
  FileText,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  X,
  ShieldAlert,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PhantomService,
  SecurityTestCase,
  TestCaseStatus,
  ServiceVulnerability,
} from './types';

interface SecurityTestsTabProps {
  service: PhantomService;
  onUpdateTestCases: (testCases: SecurityTestCase[]) => void;
  onDeriveVulnerability: (testCase: SecurityTestCase) => void;
}

// Master Security Testing Guide Catalog filtered by Service Type
const TESTING_GUIDE_CATALOG: Omit<SecurityTestCase, 'id' | 'status' | 'computedCommand' | 'derivedVulnerabilitiesCount'>[] = [
  // --- API TESTING CATALOG (OWASP API Security Top 10) ---
  {
    code: 'API1:2023-BOLA',
    title: 'Broken Object Level Authorization (BOLA / IDOR)',
    category: 'OWASP API Security Top 10',
    serviceType: 'API Testing',
    description: 'Verificar si el usuario A puede acceder a objetos de datos pertenecientes al usuario B cambiando el identificador (ID) en los parámetros de la URL o payload.',
    commandTemplate: 'curl -s -X GET "{TARGET}/users/1002" -H "Authorization: Bearer {TOKEN}"',
  },
  {
    code: 'API2:2023-AUTH',
    title: 'Broken Authentication & Token Flaws',
    category: 'OWASP API Security Top 10',
    serviceType: 'API Testing',
    description: 'Evaluar debilidades en firmas JWT, expiración de tokens, reutilización de refresh tokens y endpoints de autenticación sin rate-limiting.',
    commandTemplate: 'jwt_tool {TOKEN} -X b -I -pc name -pv admin',
  },
  {
    code: 'API3:2023-BFLA',
    title: 'Broken Object Property Level Authorization (Mass Assignment)',
    category: 'OWASP API Security Top 10',
    serviceType: 'API Testing',
    description: 'Verificar si el API permite modificar propiedades sensibles (ej: isAdmin, role, balance) mediante asignación masiva en peticiones PUT/POST.',
    commandTemplate: 'curl -s -X PUT "{TARGET}/profile" -H "Content-Type: application/json" -d \'{"role":"admin"}\'',
  },
  {
    code: 'API4:2023-RESOURCE',
    title: 'Unrestricted Resource Consumption (Rate Limiting & DoS)',
    category: 'OWASP API Security Top 10',
    serviceType: 'API Testing',
    description: 'Pruebas de denegación de servicio por agotamiento de recursos enviando ráfagas masivas de peticiones sin bloqueo de IP ni throttling.',
    commandTemplate: 'ffuf -u "{TARGET}/search?q=FUZZ" -w {TARGETS_FILE} -p 0.01 -mc 429,500',
  },
  {
    code: 'API5:2023-BFLA',
    title: 'Broken Function Level Authorization (Admin Endpoints)',
    category: 'OWASP API Security Top 10',
    serviceType: 'API Testing',
    description: 'Comprobar si usuarios sin privilegios pueden invocar endpoints administrativos (ej: /api/v1/admin/users, /api/v1/export).',
    commandTemplate: 'curl -s -X DELETE "{TARGET}/admin/users/1" -H "Authorization: Bearer {USER_TOKEN}"',
  },

  // --- WEB OWASP CATALOG ---
  {
    code: 'WSTG-INJV-01',
    title: 'Testing for SQL Injection (SQLi)',
    category: 'WSTG - Injection',
    serviceType: 'Web Application Testing (OWASP)',
    description: 'Inyección de payloads SQL en parámetros GET/POST y headers HTTP para validar extracción de datos o bypass de login.',
    commandTemplate: 'sqlmap -u "{TARGET}/search?item=test" --batch --dbs',
  },
  {
    code: 'WSTG-CLNT-01',
    title: 'Testing for Reflected & Stored XSS',
    category: 'WSTG - Client Side',
    serviceType: 'Web Application Testing (OWASP)',
    description: 'Verificar si las entradas de usuario se reflejan sin sanitización en la respuesta HTML ejecutando JavaScript arbitrario.',
    commandTemplate: 'dalfox url "{TARGET}/search?q=test"',
  },

  // --- INFRASTRUCTURE PENTEST CATALOG ---
  {
    code: 'INF-RECON-01',
    title: 'Nmap TCP Full Port Scan & Service Detection',
    category: 'Infrastructure Recon',
    serviceType: 'Infrastructure Pentest',
    description: 'Descubrimiento de servicios y versiones activas en los objetivos del alcance.',
    commandTemplate: 'nmap -sV -sC -T4 -p- {TARGET}',
  },
];

// Helper to calculate target-embedded command
export function computeEmbeddedCommand(template: string, scope: PhantomService['scope']): string {
  const targetStr =
    scope.type === 'single'
      ? scope.singleTarget || 'http://127.0.0.1'
      : scope.targetsFileName || 'targets.txt';

  const targetsFileArg = scope.type === 'multiple' ? `-iL ${scope.targetsFileName || 'targets.txt'}` : targetStr;

  return template
    .replace(/\{TARGET\}/g, targetStr)
    .replace(/\{TARGETS_FILE\}/g, targetsFileArg);
}

export function SecurityTestsTab({
  service,
  onUpdateTestCases,
  onDeriveVulnerability,
}: SecurityTestsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter testing guide catalog by current service type
  const availableCatalogItems = useMemo(() => {
    return TESTING_GUIDE_CATALOG.filter((item) => item.serviceType === service.type);
  }, [service.type]);

  const handleAddTestFromCatalog = (catalogItem: typeof TESTING_GUIDE_CATALOG[number]) => {
    const computedCmd = computeEmbeddedCommand(catalogItem.commandTemplate, service.scope);
    const newTest: SecurityTestCase = {
      id: `tc-${Date.now()}`,
      code: catalogItem.code,
      title: catalogItem.title,
      category: catalogItem.category,
      serviceType: catalogItem.serviceType,
      description: catalogItem.description,
      status: 'pending',
      commandTemplate: catalogItem.commandTemplate,
      computedCommand: computedCmd,
      derivedVulnerabilitiesCount: 0,
    };

    onUpdateTestCases([newTest, ...service.testCases]);
    setIsCatalogModalOpen(false);
  };

  const handleUpdateStatus = (testId: string, status: TestCaseStatus) => {
    const updated = service.testCases.map((tc) => (tc.id === testId ? { ...tc, status } : tc));
    onUpdateTestCases(updated);
  };

  const handleUpdateEvidence = (testId: string, notes: string) => {
    const updated = service.testCases.map((tc) => (tc.id === testId ? { ...tc, evidenceNotes: notes } : tc));
    onUpdateTestCases(updated);
  };

  const handleCopyCommand = (testId: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(testId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTestCases = useMemo(() => {
    return service.testCases.filter((tc) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        tc.title.toLowerCase().includes(q) ||
        tc.code.toLowerCase().includes(q) ||
        tc.category.toLowerCase().includes(q)
      );
    });
  }, [service.testCases, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 border border-border/60 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-violet-400" />
            <h3 className="text-sm font-bold text-foreground">
              Pruebas de Seguridad ({service.testCases.length})
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/30">
              Guiadas por {service.type}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Lista de escenarios de prueba seleccionados desde el catálogo oficial de {service.type}. Cada prueba incluye comandos con targets embebidos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCatalogModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-[1.02] shrink-0"
        >
          <Plus className="size-4" />
          <span>Añadir desde Catálogo ({availableCatalogItems.length})</span>
        </button>
      </div>

      {/* Target SoW Summary Hint */}
      <div className="p-3 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-between text-xs font-mono">
        <span className="text-muted-foreground flex items-center gap-2">
          <Terminal className="size-4 text-amber-400" />
          <span>Target SoW Embebido:</span>
          <strong className="text-foreground">
            {service.scope.type === 'single'
              ? service.scope.singleTarget || 'Single Target'
              : `Listado Múltiple (-iL ${service.scope.targetsFileName || 'targets.txt'})`}
          </strong>
        </span>
        <span className="text-[11px] text-violet-400">Modo: {service.executionMode === 'manual' ? 'Pruebas Manuales' : 'Archivos de Herramientas'}</span>
      </div>

      {/* Test Cases List */}
      {filteredTestCases.length === 0 ? (
        <div className="bg-card/40 border border-dashed border-border/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <ClipboardCheck className="size-6 text-violet-400" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">Sin pruebas asignadas a este servicio</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Las pruebas deben seleccionarse siempre desde el **Catálogo de Pruebas de Seguridad** filtrado para {service.type}.
          </p>
          <button
            onClick={() => setIsCatalogModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold mt-2"
          >
            Abrir Catálogo de Pruebas {service.type}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTestCases.map((tc) => (
            <div
              key={tc.id}
              className="bg-card border border-border/60 rounded-2xl p-5 space-y-4 shadow-sm hover:border-violet-500/40 transition-colors"
            >
              {/* Top Row: Code, Title, Category, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/30">
                    {tc.code}
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{tc.title}</h4>
                    <span className="text-[11px] text-muted-foreground font-mono">{tc.category}</span>
                  </div>
                </div>

                {/* Status Selector Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(['pending', 'running', 'passed', 'vulnerable', 'skipped'] as TestCaseStatus[]).map((st) => {
                    const active = tc.status === st;
                    return (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(tc.id, st)}
                        className={cn(
                          'px-2.5 py-1 rounded-xl text-[11px] font-mono uppercase font-bold transition-all',
                          active
                            ? st === 'vulnerable'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                              : st === 'passed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : st === 'running'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-violet-500/20 text-violet-400 border border-violet-500/40'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                        )}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">{tc.description}</p>

              {/* Command Box with Embedded Target */}
              <div className="bg-black/60 border border-amber-500/30 rounded-xl p-3 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="size-3.5" />
                    Comando de Ejecución (Target Embebido)
                  </span>
                  <button
                    onClick={() => handleCopyCommand(tc.id, tc.computedCommand)}
                    className="text-amber-300 hover:text-amber-200 flex items-center gap-1 hover:underline"
                  >
                    {copiedId === tc.id ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    <span>{copiedId === tc.id ? '¡Copiado!' : 'Copiar Comando'}</span>
                  </button>
                </div>
                <code className="block break-all text-amber-200">{tc.computedCommand}</code>
              </div>

              {/* Footer Actions & Evidence */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/40">
                {/* Evidence Input */}
                <input
                  type="text"
                  value={tc.evidenceNotes || ''}
                  onChange={(e) => handleUpdateEvidence(tc.id, e.target.value)}
                  placeholder="Notas de evidencia, respuesta HTTP o hallazgo de la prueba..."
                  className="flex-1 bg-background border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-violet-500"
                />

                {/* Derive Vulnerability Button */}
                <button
                  type="button"
                  onClick={() => onDeriveVulnerability(tc)}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <AlertTriangle className="size-3.5 text-red-400" />
                  <span>Derivar Vulnerabilidad</span>
                  {tc.derivedVulnerabilitiesCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px]">
                      {tc.derivedVulnerabilitiesCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TESTING GUIDE CATALOG PICKER MODAL */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Shield className="size-4 text-violet-400" />
                  Catálogo de Pruebas de Seguridad ({service.type})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecciona una prueba oficial para añadir al servicio. Filtradas para {service.type}.
                </p>
              </div>
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {availableCatalogItems.map((item) => (
                <div
                  key={item.code}
                  className="bg-background border border-border/60 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-violet-500/50 transition-colors group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/30">
                        {item.code}
                      </span>
                      <span className="text-xs font-bold text-foreground">{item.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddTestFromCatalog(item)}
                    className="px-3.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shrink-0 shadow transition-colors"
                  >
                    Seleccionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
