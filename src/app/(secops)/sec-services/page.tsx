'use client';

import Link from 'next/link';
import {
  ShieldCheck,
  Server,
  ArrowDownToLine,
  Network,
  Workflow,
  FileText,
  Code,
  Globe,
  Boxes,
  Box,
  Cloud,
  BarChart4,
  BrainCircuit,
  UserCheck,
  ClipboardList,
  LineChart,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ServiceStatus = 'live' | 'partial' | 'planned';

interface ServiceItem {
  name: string;
  purpose: string;
  status: ServiceStatus;
  href?: string;
  iconName: string;
}

const ICONS: Record<string, any> = {
  ShieldCheck,
  Server,
  ArrowDownToLine,
  Network,
  Workflow,
  FileText,
  Code,
  Globe,
  Boxes,
  Box,
  Cloud,
  BarChart4,
  BrainCircuit,
  UserCheck,
  ClipboardList,
  LineChart,
  ShieldAlert,
};

const catalog: ServiceItem[] = [
  {
    name: 'Core & Plataforma',
    purpose: 'Infraestructura base multi-inquilino, control de accesos basado en roles (RBAC) y bitácoras de auditoría centralizadas.',
    status: 'partial',
    href: '/admin',
    iconName: 'ShieldCheck',
  },
  {
    name: 'Gestión de Activos (Asset Management)',
    purpose: 'Inventario inteligente de hosts, aplicaciones web, direccionamiento IP, FQDNs externos y superficies expuestas.',
    status: 'partial',
    href: '/assets',
    iconName: 'Server',
  },
  {
    name: 'Ingesta y Normalización',
    purpose: 'Carga de reportes Nessus/Nmap mediante parser universal y deduplicación inteligente de vulnerabilidades.',
    status: 'partial',
    href: '/vul-mgmt/ingesta',
    iconName: 'ArrowDownToLine',
  },
  {
    name: 'Análisis de Red y Puertos',
    purpose: 'Escaneos de red automatizados e integración de firmas Nessus/Nmap para análisis de servicios abiertos.',
    status: 'partial',
    href: '/tools/nmap',
    iconName: 'Network',
  },
  {
    name: 'Ciclo de Pentesting Automatizado',
    purpose: 'Flujo de pentest completo en 7 pasos (alcance, credenciales, ejecución, catalogación, evidencias, retests y reportes).',
    status: 'live',
    href: '/reports',
    iconName: 'Workflow',
  },
  {
    name: 'Reportes y Entregables',
    purpose: 'Generación y exportación automatizada de reportes Word ejecutivos y técnicos alineados al estándar CYB001.',
    status: 'partial',
    href: '/reports',
    iconName: 'FileText',
  },
  {
    name: 'Análisis Estático (SAST)',
    purpose: 'Inspección estática de código de software para identificar fallos de seguridad y bugs en el código fuente.',
    status: 'partial',
    href: '/reports',
    iconName: 'Code',
  },
  {
    name: 'Análisis Dinámico (DAST)',
    purpose: 'Pruebas de caja negra en aplicaciones web en ejecución simulando ataques reales (integración Acunetix y Burp).',
    status: 'partial',
    href: '/reports',
    iconName: 'Globe',
  },
  {
    name: 'Análisis de Dependencias (SCA)',
    purpose: 'Inventario y análisis de bibliotecas de terceros y dependencias de código abierto con vulnerabilidades conocidas.',
    status: 'planned',
    iconName: 'Boxes',
  },
  {
    name: 'Seguridad de Contenedores',
    purpose: 'Análisis automatizado de vulnerabilidades en imágenes de Docker e Infraestructura como Código (IaC) vía Trivy.',
    status: 'planned',
    iconName: 'Box',
  },
  {
    name: 'Seguridad en la Nube (CSPM)',
    purpose: 'Monitoreo de postura de seguridad y configuración de infraestructura en nubes públicas (AWS, GCP, Azure).',
    status: 'planned',
    iconName: 'Cloud',
  },
  {
    name: 'Priorización y Risk Scoring',
    purpose: 'Puntuación y priorización inteligente de severidades utilizando métricas CVSS v3, EPSS y KEV del CISA.',
    status: 'partial',
    href: '/vul-mgmt/dashboard',
    iconName: 'BarChart4',
  },
  {
    name: 'Triage Asistido por Inteligencia Artificial',
    purpose: 'Revisión y resumen automatizado de hallazgos mediante modelos de lenguaje (Gemini AI) y catálogo inteligente.',
    status: 'partial',
    href: '/vulns-catalog',
    iconName: 'BrainCircuit',
  },
  {
    name: 'Portal de Clientes',
    purpose: 'Vista dedicada para clientes con dashboards ejecutivos, tendencias de remediación e informes técnicos.',
    status: 'partial',
    href: '/portal',
    iconName: 'UserCheck',
  },
  {
    name: 'Ciclo de Remediación y Retests',
    purpose: 'Seguimiento de estados de remediación de vulnerabilidades, control de SLAs y flujos de re-evaluación.',
    status: 'partial',
    href: '/vul-mgmt',
    iconName: 'ClipboardList',
  },
  {
    name: 'Métricas e Indicadores (KPIs)',
    purpose: 'Monitoreo en tiempo real de métricas críticas de ciberseguridad, tendencias de severidad y tasas de remediación.',
    status: 'partial',
    href: '/vul-mgmt/dashboard',
    iconName: 'LineChart',
  },
  {
    name: 'Cumplimiento y Regulaciones (Compliance)',
    purpose: 'Mapeo automatizado de vulnerabilidades y controles hacia estándares de la industria (PCI, ISO 27001, NIST, OWASP).',
    status: 'partial',
    href: '/compliance',
    iconName: 'ShieldAlert',
  },
];

export default function SecServicesPage() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Catálogo de Servicios</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-xs">
            Catálogo completo de los servicios operativos e integraciones de ciberseguridad en la plataforma Spectre.
            Utiliza los accesos directos para acceder a las herramientas activas de pentest, SAST, DAST y auditoría de cumplimiento.
          </p>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center justify-center rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 text-xs font-semibold shadow transition-all duration-200"
        >
          Ir a Pentest Flow
          <ArrowUpRight className="size-4 ml-1.5" />
        </Link>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {catalog.map((service) => {
          const IconComponent = ICONS[service.iconName] || ShieldCheck;
          const isPlanned = service.status === 'planned';

          return (
            <Card
              key={service.name}
              className={`flex flex-col justify-between border-border/40 bg-card/60 hover:border-cyan-500/50 hover:bg-muted/10 transition-all duration-300 shadow-sm rounded-xl ${
                isPlanned ? 'opacity-75' : ''
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Card Header Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <IconComponent className="size-5" />
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${
                      service.status === 'live'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                        : service.status === 'partial'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {service.status === 'live'
                      ? 'Operativo'
                      : service.status === 'partial'
                        ? 'Parcial'
                        : 'Planeado'}
                  </span>
                </div>

                {/* Service Details */}
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-foreground leading-snug">{service.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed min-h-[48px]">{service.purpose}</p>
                </div>
              </div>

              {/* Card Action */}
              <div className="px-5 pb-5 pt-1 mt-auto">
                {service.href && !isPlanned ? (
                  <Link
                    href={service.href}
                    className="inline-flex w-full items-center justify-between rounded-lg border border-border bg-background/50 hover:bg-muted/50 px-3 py-2 text-xs font-semibold text-foreground transition-all duration-200"
                  >
                    <span>Acceder al Servicio</span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
                  </Link>
                ) : (
                  <div className="w-full text-center rounded-lg border border-dashed border-border/60 bg-muted/20 py-2 text-xs font-semibold text-muted-foreground select-none">
                    Próximamente
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
