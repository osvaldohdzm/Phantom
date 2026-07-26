/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Plus,
  AlertCircle,
  CheckCircle2,
  Filter,
  Search,
  X,
  Sparkles,
  ExternalLink,
  ChevronRight,
  FileText,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PhantomService,
  ServiceVulnerability,
  VulnerabilitySeverity,
  SecurityTestCase,
} from './types';
import { computeEmbeddedCommand } from './SecurityTestsTab';

interface VulnerabilitiesTabProps {
  service: PhantomService;
  onUpdateVulnerabilities: (vulns: ServiceVulnerability[]) => void;
  onAddTestCaseAndLink: (testCase: SecurityTestCase, vuln: ServiceVulnerability) => void;
}

export function VulnerabilitiesTab({
  service,
  onUpdateVulnerabilities,
  onAddTestCaseAndLink,
}: VulnerabilitiesTabProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<VulnerabilitySeverity>('High');
  const [cvss, setCvss] = useState<number>(7.5);
  const [description, setDescription] = useState('');
  const [remediation, setRemediation] = useState('');
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string>('new_from_catalog');
  const [selectedCatalogCode, setSelectedCatalogCode] = useState<string>('API1:2023-BOLA');

  const handleCreateVulnerability = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let targetTestCaseId = selectedTestCaseId;
    let targetTestCaseTitle = '';

    const newVuln: ServiceVulnerability = {
      id: `vuln-${Date.now()}`,
      code: `VULN-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title.trim(),
      severity,
      cvss,
      testCaseId: targetTestCaseId,
      testCaseTitle: targetTestCaseTitle,
      affectedTarget: service.scope.singleTarget || service.scope.targetsFileName || 'Target Scope',
      description: description.trim(),
      remediation: remediation.trim() || 'Implementar validaciones y control de acceso adecuado.',
      createdAt: new Date().toISOString().split('T')[0],
    };

    if (selectedTestCaseId === 'new_from_catalog') {
      // Auto-create test case from catalog for full audit traceability!
      const autoTestCase: SecurityTestCase = {
        id: `tc-auto-${Date.now()}`,
        code: selectedCatalogCode,
        title: `Prueba de Seguridad: ${selectedCatalogCode}`,
        category: 'Catálogo de Pruebas',
        serviceType: service.type,
        description: `Caso de prueba generado automáticamente al registrar la vulnerabilidad: ${title}`,
        status: 'vulnerable',
        commandTemplate: 'curl -s -X GET "{TARGET}/test"',
        computedCommand: computeEmbeddedCommand('curl -s -X GET "{TARGET}/test"', service.scope),
        derivedVulnerabilitiesCount: 1,
      };

      newVuln.testCaseId = autoTestCase.id;
      newVuln.testCaseTitle = autoTestCase.title;

      onAddTestCaseAndLink(autoTestCase, newVuln);
    } else {
      const existingTC = service.testCases.find((tc) => tc.id === selectedTestCaseId);
      if (existingTC) {
        newVuln.testCaseTitle = existingTC.title;
      }
      onUpdateVulnerabilities([newVuln, ...service.vulnerabilities]);
    }

    setIsCreateModalOpen(false);
    setTitle('');
    setDescription('');
    setRemediation('');
  };

  const getSeverityBadgeClass = (sev: VulnerabilitySeverity) => {
    switch (sev) {
      case 'Critical':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'High':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      case 'Medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'Info':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/60 border border-border/60 rounded-2xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-red-400" />
            <h3 className="text-sm font-bold text-foreground">
              Vulnerabilidades ({service.vulnerabilities.length})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Hallazgos de seguridad registrados bajo este servicio. Toda vulnerabilidad está trazada directamente a su caso de prueba.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-[1.02] shrink-0"
        >
          <Plus className="size-4" />
          <span>Registrar Vulnerabilidad</span>
        </button>
      </div>

      {/* Vulnerabilities List */}
      {service.vulnerabilities.length === 0 ? (
        <div className="bg-card/40 border border-dashed border-border/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground">
            <ShieldAlert className="size-6 text-red-400" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">Sin vulnerabilidades registradas</h4>
          <p className="text-xs text-muted-foreground max-w-sm">
            Puedes registrar vulnerabilidades derivadas de la pestaña de Pruebas de Seguridad o crear una nueva con trazabilidad al catálogo.
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold mt-2"
          >
            Registrar Primera Vulnerabilidad
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {service.vulnerabilities.map((vuln) => (
            <div
              key={vuln.id}
              className="bg-card border border-border/60 rounded-2xl p-5 space-y-4 shadow-sm hover:border-red-500/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md border uppercase',
                      getSeverityBadgeClass(vuln.severity)
                    )}
                  >
                    {vuln.severity} ({vuln.cvss})
                  </span>
                  <h4 className="text-sm font-bold text-foreground">{vuln.title}</h4>
                </div>

                <div className="text-xs font-mono text-muted-foreground flex items-center gap-1.5 bg-muted/30 px-3 py-1 rounded-xl border border-border/40">
                  <Link2 className="size-3.5 text-violet-400" />
                  <span>Prueba Vinculada:</span>
                  <strong className="text-foreground">{vuln.testCaseTitle || 'Caso de Prueba'}</strong>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">{vuln.description}</p>

              {/* Remediation Box */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Recomendación de Remediación
                </span>
                <p className="text-xs text-emerald-300 font-mono">{vuln.remediation}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE VULNERABILITY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="size-4 text-red-400" />
                Registrar Vulnerabilidad con Trazabilidad
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVulnerability} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-foreground mb-1">Título de la Vulnerabilidad</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Broken Object Level Authorization (BOLA) en /api/v1/users/{id}"
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-foreground mb-1">Severidad</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as VulnerabilitySeverity)}
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-red-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Info">Info</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-foreground mb-1">CVSS v3.1</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={cvss}
                    onChange={(e) => setCvss(parseFloat(e.target.value))}
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              {/* Strict Traceability Selector */}
              <div>
                <label className="block font-medium text-foreground mb-1">Asociar a Prueba de Seguridad</label>
                <select
                  value={selectedTestCaseId}
                  onChange={(e) => setSelectedTestCaseId(e.target.value)}
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-red-500 font-mono"
                >
                  <option value="new_from_catalog">
                    + Seleccionar del Catálogo {service.type} (Auto-crea el Caso de Prueba)
                  </option>
                  {service.testCases.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      [{tc.code}] {tc.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTestCaseId === 'new_from_catalog' && (
                <div>
                  <label className="block font-medium text-foreground mb-1">Código del Catálogo {service.type}</label>
                  <select
                    value={selectedCatalogCode}
                    onChange={(e) => setSelectedCatalogCode(e.target.value)}
                    className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-red-500 font-mono"
                  >
                    <option value="API1:2023-BOLA">API1:2023 - Broken Object Level Authorization (BOLA)</option>
                    <option value="API2:2023-AUTH">API2:2023 - Broken Authentication & Token Flaws</option>
                    <option value="API3:2023-BFLA">API3:2023 - Broken Object Property Authorization</option>
                    <option value="API4:2023-RESOURCE">API4:2023 - Unrestricted Resource Consumption</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-medium text-foreground mb-1">Descripción del Hallazgo</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalles del vector de ataque y respuesta devuelta por el API..."
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Recomendaciones de Remediación</label>
                <textarea
                  rows={2}
                  value={remediation}
                  onChange={(e) => setRemediation(e.target.value)}
                  placeholder="Medidas correctivas para el equipo de desarrollo..."
                  className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-500 resize-none"
                />
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
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold shadow-md transition-colors"
                >
                  Guardar Vulnerabilidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
