/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  Terminal,
  Layers,
  FileText,
  Users,
  Database,
  FileCode,
  Download,
  Plus,
  Trash2,
  Edit,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Tag,
  AlertTriangle,
  Upload,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Engagement, Finding } from '@/lib/secops-api';
import { listFindings, createFinding } from '@/lib/secops-api';
import { SecurityTestsActivePage } from '@/app/(secops)/pruebas-seguridad/page';

interface ProjectDetailsFullViewProps {
  engagement: Engagement;
  onBack: () => void;
}

type TabType =
  | 'details'
  | 'eims'
  | 'members'
  | 'methodologies'
  | 'test_cases'
  | 'vulnerabilities'
  | 'evidences'
  | 'report_sections'
  | 'report';

interface SampleMember {
  id: string;
  email: string;
  role: 'OWNER' | 'READER' | 'EDITOR';
}

interface SampleMethodology {
  id: string;
  name: string;
  type: string;
  modifiedAt: string;
}

interface SampleTestCase {
  id: string;
  code: string;
  title: string;
  category: string;
  status: 'Vulnerable' | 'Passed' | 'In Progress';
  command: string;
  derivativeVuln?: string;
}

const OFFICIAL_METHODOLOGIES_CATALOG = [
  {
    id: 'wstg-v2',
    name: 'CROS Web Application Security Testing (WSTG) v2.0.0',
    type: 'Web Application',
    description: 'Guía oficial OWASP para pruebas de penetración y evaluación de seguridad en aplicaciones web.',
  },
  {
    id: 'owasp-api-2023',
    name: 'OWASP API Security Top 10 Assessment v2023',
    type: 'API Testing',
    description: 'Marco de evaluación enfocado en APIs REST/GraphQL (BOLA, Auth Flaws, BFLA, SSRF, Rate Limit).',
  },
  {
    id: 'istg-v1',
    name: 'CROS Infrastructure Security Testing (ISTG) v1.0.0',
    type: 'Infrastructure',
    description: 'Evaluación de seguridad en infraestructura de red, servidores, puertos y servicios expuestos.',
  },
  {
    id: 'mastg-v2',
    name: 'OWASP Mobile Application Security Testing (MASTG) v2.0',
    type: 'Mobile Pentest',
    description: 'Guía de seguridad para aplicaciones móviles Android e iOS (Insecure Storage, Reverse Engineering).',
  },
  {
    id: 'pci-dss-v4',
    name: 'PCI-DSS v4.0 Technical Security Assessment',
    type: 'Compliance & Security',
    description: 'Evaluación técnica de cumplimiento de estándares de seguridad para procesamiento de pagos.',
  },
  {
    id: 'cis-cloud',
    name: 'Cloud Infrastructure Security Assessment (CIS)',
    type: 'Cloud Security',
    description: 'Auditoría de postura de seguridad y configuración en entornos AWS, Azure y Google Cloud.',
  },
];

export function ProjectDetailsFullView({ engagement, onBack }: ProjectDetailsFullViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(true);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  // Persistent Members state per engagement
  const [members, setMembers] = useState<SampleMember[]>(() => {
    if (typeof window !== 'undefined' && engagement.id) {
      const saved = localStorage.getItem(`spectre_engagement_members_${engagement.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (_) {}
      }
    }
    const ownerEmail = engagement.responsable || 'secops@company.com';
    return [{ id: 'm-owner', email: ownerEmail, role: 'OWNER' }];
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && engagement.id) {
      localStorage.setItem(`spectre_engagement_members_${engagement.id}`, JSON.stringify(members));
    }
  }, [members, engagement.id]);

  // Persistent Methodologies state per engagement
  const [methodologies, setMethodologies] = useState<SampleMethodology[]>(() => {
    if (typeof window !== 'undefined' && engagement.id) {
      const saved = localStorage.getItem(`spectre_engagement_methodologies_${engagement.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (_) {}
      }
    }
    const st = (engagement.tipo_servicio || '').toLowerCase();
    const today = new Date().toLocaleDateString('es-ES');
    if (st.includes('api')) {
      return [
        {
          id: 'm-api',
          name: 'OWASP API Security Top 10 Assessment v2023',
          type: 'API Testing',
          modifiedAt: today,
        },
      ];
    }
    if (st.includes('infra') || st.includes('red')) {
      return [
        {
          id: 'm-istg',
          name: 'CROS Infrastructure Security Testing (ISTG) v1.0.0',
          type: 'Infrastructure',
          modifiedAt: today,
        },
      ];
    }
    if (st.includes('movil') || st.includes('mobile') || st.includes('ios') || st.includes('android')) {
      return [
        {
          id: 'm-mastg',
          name: 'OWASP Mobile Application Security Testing (MASTG) v2.0',
          type: 'Mobile Pentest',
          modifiedAt: today,
        },
      ];
    }
    return [
      {
        id: 'm-wstg',
        name: 'CROS Web Application Security Testing (WSTG) v2.0.0',
        type: 'Web Application',
        modifiedAt: today,
      },
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && engagement.id) {
      localStorage.setItem(`spectre_engagement_methodologies_${engagement.id}`, JSON.stringify(methodologies));
    }
  }, [methodologies, engagement.id]);

  const [showAddMethodologyModal, setShowAddMethodologyModal] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState(OFFICIAL_METHODOLOGIES_CATALOG);

  useEffect(() => {
    if (!showAddMethodologyModal) return;
    const fetchCatalogSuites = async () => {
      try {
        const res = await fetch('/api/pruebas-seguridad/suites');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.instances)) {
            const serverItems = data.instances.map((inst: any) => ({
              id: inst.id,
              name: inst.name,
              type: inst.type || 'Custom Pentest Methodology',
              description: inst.description || `Metodología ${inst.name} registrada en el Catálogo de Pruebas de Seguridad.`,
            }));
            const combined = [...OFFICIAL_METHODOLOGIES_CATALOG];
            for (const item of serverItems) {
              if (!combined.some((c) => c.name === item.name)) {
                combined.push(item);
              }
            }
            setCatalogOptions(combined);
          }
        }
      } catch (e) {
        console.warn('Could not fetch server catalog suites:', e);
      }
    };
    fetchCatalogSuites();
  }, [showAddMethodologyModal]);

  const handleAddMethodology = (item: typeof OFFICIAL_METHODOLOGIES_CATALOG[0]) => {
    if (methodologies.some((m) => m.name === item.name)) return;
    const newM: SampleMethodology = {
      id: `m-${Date.now()}`,
      name: item.name,
      type: item.type,
      modifiedAt: new Date().toLocaleDateString('es-ES'),
    };
    setMethodologies((prev) => [...prev, newM]);
  };

  const handleRemoveMethodology = (id: string) => {
    setMethodologies((prev) => prev.filter((m) => m.id !== id));
  };

  // Test Cases state
  const [testCases, setTestCases] = useState<SampleTestCase[]>([
    {
      id: 'tc-1',
      code: 'API1:2023-BOLA',
      title: 'Broken Object Level Authorization (BOLA / IDOR)',
      category: 'OWASP API Security Top 10',
      status: 'Vulnerable',
      command: 'curl -s -X GET "https://target/v1/services/users/1002" -H "Authorization: Bearer TOKEN"',
      derivativeVuln: 'BOLA en Endpoint /v1/services/users',
    },
    {
      id: 'tc-2',
      code: 'API2:2023-AUTH',
      title: 'Broken Authentication & Token Signature Flaws',
      category: 'OWASP API Security Top 10',
      status: 'Passed',
      command: 'jwt_tool TOKEN -X b -I -pc name -pv admin',
    },
    {
      id: 'tc-[#',
      code: 'API3:2023-BFLA',
      title: 'Broken Function Level Authorization',
      category: 'OWASP API Security Top 10',
      status: 'In Progress',
      command: 'curl -s -X POST "https://target/admin/roles" -H "Authorization: Bearer USER_TOKEN"',
    },
  ]);

  // Manual Vulnerability Form Modal State
  const [showAddVulnModal, setShowAddVulnModal] = useState(false);
  const [newVulnTitle, setNewVulnTitle] = useState('');
  const [newVulnSeverity, setNewVulnSeverity] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [newVulnCvss, setNewVulnCvss] = useState(8.5);
  const [newVulnDesc, setNewVulnDesc] = useState('');
  const [associatedTcCode, setAssociatedTcCode] = useState('API1:2023-BOLA');

  useEffect(() => {
    fetchFindings();
  }, [engagement.id]);

  const fetchFindings = async () => {
    setLoadingFindings(true);
    try {
      const data = await listFindings({ engagement_id: engagement.id, limit: 500 });
      setFindings(data);
      if (data.length > 0 && !selectedFindingId) {
        setSelectedFindingId(data[0].id);
      }
    } catch {
      setFindings([]);
    } finally {
      setLoadingFindings(false);
    }
  };

  const handleCreateManualVuln = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVulnTitle.trim()) return;

    try {
      const created = await createFinding({
        engagement_id: engagement.id,
        titulo: newVulnTitle.trim(),
        severidad: newVulnSeverity,
        cvss_score: newVulnCvss,
        descripcion: newVulnDesc.trim(),
        metodo_deteccion: 'Manual Pentest',
      });

      setFindings((prev) => [created, ...prev]);
      setSelectedFindingId(created.id);
      setShowAddVulnModal(false);
      setNewVulnTitle('');
      setNewVulnDesc('');
    } catch (err) {
      console.error('Error creating vulnerability', err);
    }
  };

  const selectedFinding = findings.find((f) => f.id === selectedFindingId) || findings[0];

  return (
    <div className="w-full space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-card border border-border shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted text-foreground transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
          >
            <ArrowLeft className="size-4" />
            <span>Volver a Servicios</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground tracking-tight">
                Project Details: {engagement.nombre_proyecto || engagement.cliente || engagement.id}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {engagement.estado || 'ACTIVE'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Pentest Notebook completo · {engagement.tipo_servicio || 'Penetration Testing'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddVulnModal(true)}
            className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>+ Cargar Vulnerabilidad Manual</span>
          </button>
        </div>
      </div>

      {/* Main Enterprise Tab Bar Navigation */}
      <div className="flex items-center gap-1 px-2 pb-0.5 border-b border-border bg-card/60 rounded-xl overflow-x-auto custom-scrollbar">
        {(
          [
            { id: 'details', label: 'Details', icon: FileText },
            { id: 'eims', label: 'Eims', icon: Database },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'methodologies', label: 'Methodologies', icon: Layers },
            { id: 'test_cases', label: 'Test Cases', icon: Terminal },
            { id: 'vulnerabilities', label: 'Vulnerabilities', icon: ShieldAlert },
            { id: 'evidences', label: 'Evidences', icon: FileCode },
            { id: 'report_sections', label: 'Report Sections', icon: Sparkles },
            { id: 'report', label: 'Report (Word)', icon: Download },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer',
                isActive
                  ? 'border-violet-500 text-violet-400 bg-card shadow-sm font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
              )}
            >
              <Icon className={cn('size-3.5', isActive ? 'text-violet-400' : 'text-muted-foreground')} />
              <span>{tab.label}</span>
              {tab.id === 'vulnerabilities' && findings.length > 0 ? (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {findings.length}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT AREA */}
      <div className="min-h-[500px]">
        {/* TAB 1: DETAILS */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-foreground border-b border-border pb-2">Project Details</h2>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground font-semibold uppercase text-[10px]">Client / Organization</span>
                  <p className="text-foreground font-medium text-sm">{engagement.cliente || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold uppercase text-[10px]">Project Name</span>
                  <p className="text-foreground font-medium text-sm">{engagement.nombre_proyecto || engagement.cliente}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold uppercase text-[10px]">Service Type</span>
                  <p className="text-foreground font-mono">{engagement.tipo_servicio || 'API Pentest'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold uppercase text-[10px]">Analysis Box</span>
                  <p className="text-foreground font-mono">{engagement.tipo || 'Caja Negra'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground font-semibold uppercase text-[10px]">Start Date</span>
                  <p className="text-foreground font-mono">{engagement.fecha_inicio || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
              <h2 className="text-sm font-bold text-foreground border-b border-border pb-2">Report Template</h2>
              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase text-violet-400">ACTIVE TEMPLATE</span>
                <h3 className="text-sm font-bold text-foreground">Penetration Test Report v3.0.1 (CYB001)</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Plantilla estándar corporativa con resumen ejecutivo, métricas CVSS v3.1 y propuesta de remediación.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EIMS */}
        {activeTab === 'eims' && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground border-b border-border pb-2">EIMS Enterprise Mapping</h2>
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2 font-mono text-xs">
              <div><strong className="text-foreground">EIMS ID:</strong> EIMS-99201-GLOBAL</div>
              <div><strong className="text-foreground">Application Category:</strong> Critical Banking Infrastructure</div>
              <div><strong className="text-foreground">Owner Department:</strong> Cyber Security SecOps</div>
            </div>
          </div>
        )}

        {/* TAB 3: MEMBERS */}
        {activeTab === 'members' && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground">Project Member List</h2>
              <button
                type="button"
                onClick={() => {
                  const email = prompt('Email del nuevo miembro:');
                  if (email) {
                    setMembers((prev) => [...prev, { id: `m-${Date.now()}`, email, role: 'READER' }]);
                  }
                }}
                className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Agregar Miembro</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] text-muted-foreground font-mono uppercase">
                    <th className="py-2 px-3">Email</th>
                    <th className="py-2 px-3">Role</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-mono text-foreground flex items-center gap-2">
                        <Users className="size-3.5 text-violet-400" />
                        {m.email}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-mono font-bold',
                          m.role === 'OWNER' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-muted text-muted-foreground'
                        )}>
                          {m.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setMembers((prev) => prev.filter((item) => item.id !== m.id))}
                          className="p-1 rounded text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: METHODOLOGIES */}
        {activeTab === 'methodologies' && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Selected Methodologies ({methodologies.length})</h2>
                <p className="text-xs text-muted-foreground">Metodologías asignadas que definen los casos de prueba del catálogo.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMethodologyModal(true)}
                className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="size-3.5" />
                <span>+ Cargar Metodología del Catálogo</span>
              </button>
            </div>

            {methodologies.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-border space-y-2">
                <Layers className="size-8 mx-auto text-muted-foreground/60" />
                <p className="text-sm font-semibold text-foreground">No hay metodologías asignadas</p>
                <p className="text-xs text-muted-foreground">Haz clic en &quot;+ Cargar Metodología del Catálogo&quot; para asignar una.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] text-muted-foreground font-mono uppercase">
                      <th className="py-2 px-3">Selected Methodologies</th>
                      <th className="py-2 px-3">Methodology Type</th>
                      <th className="py-2 px-3">Modified at</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodologies.map((m) => (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-medium text-foreground flex items-center gap-2">
                          <Layers className="size-3.5 text-violet-400 shrink-0" />
                          {m.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">{m.type}</td>
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">{m.modifiedAt}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ASIGNADA
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveMethodology(m.id)}
                            className="p-1 rounded text-destructive hover:bg-destructive/10"
                            title="Eliminar metodología asignada"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: TEST CASES */}
        {activeTab === 'test_cases' && (
          <div className="p-1 rounded-2xl bg-card border border-border space-y-4 shadow-sm overflow-hidden">
            <SecurityTestsActivePage
              embedded={true}
              serviceType={engagement.tipo_servicio || undefined}
              serviceName={engagement.nombre_proyecto || engagement.cliente || undefined}
            />
          </div>
        )}

        {/* TAB 6: VULNERABILITIES (Matching Screenshot 1) */}
        {activeTab === 'vulnerabilities' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left/Middle: Vulnerabilities Table */}
            <div className="lg:col-span-2 p-4 rounded-2xl bg-card border border-border space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldAlert className="size-4 text-rose-500" />
                  Vulnerabilities Catalog ({findings.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAddVulnModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>Cargar Manual</span>
                </button>
              </div>

              {loadingFindings ? (
                <div className="py-12 text-center space-y-2">
                  <RefreshCw className="size-6 animate-spin mx-auto text-violet-500" />
                  <p className="text-xs text-muted-foreground">Cargando catálogo de vulnerabilidades...</p>
                </div>
              ) : findings.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-border space-y-2">
                  <ShieldAlert className="size-8 mx-auto text-muted-foreground/60" />
                  <p className="text-sm font-semibold text-foreground">No hay vulnerabilidades cargadas</p>
                  <p className="text-xs text-muted-foreground">Haz clic en &quot;+ Cargar Vulnerabilidad Manual&quot; para agregar una.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                        <th className="py-2 px-2">CVSS v2</th>
                        <th className="py-2 px-2">CVSS v3</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {findings.map((f) => {
                        const isSelected = selectedFinding?.id === f.id;
                        const score = f.cvss_score || 7.5;
                        const sev = f.severidad || 'High';
                        return (
                          <tr
                            key={f.id}
                            onClick={() => setSelectedFindingId(f.id)}
                            className={cn(
                              'border-b border-border/50 cursor-pointer transition-all',
                              isSelected ? 'bg-violet-500/15 shadow-[inset_3px_0_0_0] shadow-violet-500' : 'hover:bg-muted/30'
                            )}
                          >
                            {/* CVSS v2 Badge */}
                            <td className="py-2.5 px-2">
                              <span className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                                score >= 9 ? 'bg-rose-900/60 text-rose-200 border border-rose-700' :
                                score >= 7 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                                score >= 4 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                              )}>
                                {sev.toUpperCase()}: {score}
                              </span>
                            </td>

                            {/* CVSS v3 Badge */}
                            <td className="py-2.5 px-2">
                              <span className={cn(
                                'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase',
                                score >= 9 ? 'bg-rose-950 text-rose-400 border border-rose-600 font-extrabold' :
                                score >= 7 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40' :
                                score >= 4 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                                'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                              )}>
                                {score >= 9 ? 'CRITICAL: ' : `${sev.toUpperCase()}: `}{score}
                              </span>
                            </td>

                            {/* Name & Tags */}
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-foreground block">{f.titulo}</span>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-muted text-muted-foreground border border-border">
                                  Business Critical
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/30">
                                  Demo
                                </span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-2.5 px-2">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-muted text-muted-foreground border border-border">
                                {f.status || 'PRESENT'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Vulnerability Details Panel (Matching Screenshot 1) */}
            <div className="p-4 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">DETAILS</span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">COMMENTS</span>
              </div>

              {selectedFinding ? (
                <div className="space-y-4 text-xs">
                  {/* Large Severity Shield */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                    <ShieldAlert className="size-8 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-amber-400 uppercase">{selectedFinding.severidad || 'High'} ({selectedFinding.cvss_score || 7.5})</span>
                      <h3 className="text-sm font-bold text-foreground">{selectedFinding.titulo}</h3>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">CVSS v2 Score</span>
                    <p className="font-mono text-foreground">{selectedFinding.cvss_score || 7.5} / 10.0</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">CVSS v3 Score</span>
                    <p className="font-mono text-foreground">{selectedFinding.cvss_score || 7.5} (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N)</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Description</span>
                    <p className="text-muted-foreground leading-relaxed">{selectedFinding.descripcion || 'Sin descripción ingresada.'}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Impact</span>
                    <p className="text-muted-foreground leading-relaxed">{selectedFinding.explicacion_tecnica || 'Posible compromiso de confidencialidad e integridad de datos.'}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Solution</span>
                    <p className="text-muted-foreground leading-relaxed">{selectedFinding.propuesta_remediacion || 'Implementar validación rigurosa en servidor.'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-8 text-center">Selecciona una vulnerabilidad para ver detalles.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: EVIDENCES */}
        {activeTab === 'evidences' && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground border-b border-border pb-2">Evidences & Proof of Concept Files</h2>
            <p className="text-xs text-muted-foreground">Archivos de captura, capturas de pantalla y trazas HTTP asociadas.</p>
          </div>
        )}

        {/* TAB 8: REPORT SECTIONS */}
        {activeTab === 'report_sections' && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-foreground border-b border-border pb-2">Report Sections Config</h2>
            <p className="text-xs text-muted-foreground">Configuración de secciones ejecutivas del informe.</p>
          </div>
        )}

        {/* TAB 9: REPORT (WORD) */}
        {activeTab === 'report' && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground">Generación de Reporte Word (.docx)</h2>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="size-4" />
                <span>Generar e Imprimir Informe Word</span>
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Genera el documento Word profesional con la plantilla CYB001 incluyendo el resumen de vulnerabilidades, evidencias y recomendaciones.
            </p>
          </div>
        )}
      </div>

      {/* MANUAL VULNERABILITY CREATION MODAL */}
      {showAddVulnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Plus className="size-4 text-violet-400" />
                Cargar Vulnerabilidad Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowAddVulnModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualVuln} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Título de la Vulnerabilidad</label>
                <input
                  type="text"
                  required
                  value={newVulnTitle}
                  onChange={(e) => setNewVulnTitle(e.target.value)}
                  placeholder="Ej: Broken Object Level Authorization en /api/v1/users"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Severidad</label>
                  <select
                    value={newVulnSeverity}
                    onChange={(e) => setNewVulnSeverity(e.target.value as any)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-violet-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Puntaje CVSS v3.1</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={newVulnCvss}
                    onChange={(e) => setNewVulnCvss(parseFloat(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono text-foreground focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Test Case Asociado (Opcional)</label>
                <select
                  value={associatedTcCode}
                  onChange={(e) => setAssociatedTcCode(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-violet-500 font-mono text-xs"
                >
                  <option value="API1:2023-BOLA">API1:2023-BOLA - Broken Object Level Authorization</option>
                  <option value="API2:2023-AUTH">API2:2023-AUTH - Broken Authentication</option>
                  <option value="API3:2023-BFLA">API3:2023-BFLA - Broken Function Level Authorization</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Descripción</label>
                <textarea
                  rows={3}
                  value={newVulnDesc}
                  onChange={(e) => setNewVulnDesc(e.target.value)}
                  placeholder="Detalles de la vulnerabilidad encontrada..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:border-violet-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddVulnModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-border text-muted-foreground hover:bg-muted text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-md"
                >
                  Guardar Vulnerabilidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* METHODOLOGY CATALOG SELECTION MODAL */}
      {showAddMethodologyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-5 text-violet-400" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Catálogo Oficial de Metodologías Pentest</h3>
                  <p className="text-xs text-muted-foreground">Selecciona una metodología para vincular sus casos de prueba al servicio.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMethodologyModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 custom-scrollbar">
              {catalogOptions.map((cat) => {
                const isAssigned = methodologies.some((m) => m.name === cat.name);
                return (
                  <div
                    key={cat.id}
                    className={cn(
                      'p-3.5 rounded-xl border transition-all flex items-start justify-between gap-4',
                      isAssigned ? 'bg-violet-500/10 border-violet-500/40' : 'bg-muted/20 border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          {cat.type}
                        </span>
                        <h4 className="text-xs font-bold text-foreground">{cat.name}</h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{cat.description}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isAssigned}
                      onClick={() => {
                        handleAddMethodology(cat);
                        setShowAddMethodologyModal(false);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer',
                        isAssigned
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                          : 'bg-violet-600 hover:bg-violet-500 text-white shadow-sm'
                      )}
                    >
                      {isAssigned ? '✓ Asignada' : '+ Asignar'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-border bg-muted/20 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddMethodologyModal(false)}
                className="px-4 py-1.5 rounded-xl border border-border text-foreground hover:bg-muted text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
