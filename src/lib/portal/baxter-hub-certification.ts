/**
 * Baxter Innovation HUB certification workflows for the Phantom client portal.
 * ServiceNow / Freshservice–style multi-stage tickets (manual + automated).
 */

export const WEB_APP_HUB_CHECK_ID = 'baxter_hub_web_application_check';
export const MEDICAL_DEVICE_HUB_CHECK_ID = 'baxter_hub_medical_device_check';

export type TicketUrgency = 'Low' | 'Medium' | 'High';
export type TicketStatus = 'PENDIENTE' | 'EN PROGRESO' | 'APROBADO' | 'COMPLETADO';
export type StageMode = 'manual' | 'automated' | 'hybrid';
export type StageStatus = 'queued' | 'in_progress' | 'completed' | 'blocked';

export interface ServiceCatalogItem {
  id: string;
  name: string;
  desc: string;
  defaultUrgency: TicketUrgency;
}

export interface CertificationStageDefinition {
  key: string;
  label: string;
  description: string;
  mode: StageMode;
  standardRef?: string;
}

export interface CertificationStageInstance extends CertificationStageDefinition {
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  note?: string;
  actor?: string;
}

export interface TicketUpdate {
  id: string;
  at: string;
  actor: string;
  message: string;
  stageKey?: string;
}

export interface CertificationTicket {
  id: string;
  type: string;
  target: string;
  urgency: TicketUrgency;
  status: TicketStatus;
  createdAt: string;
  description: string;
  workflowId: string;
  currentStageKey: string | null;
  stages: CertificationStageInstance[];
  updates: TicketUpdate[];
}

export interface CertificationTemplate {
  id: string;
  name: string;
  stages: CertificationStageDefinition[];
}

export const BAXTER_HUB_CATALOG: ServiceCatalogItem[] = [
  {
    id: WEB_APP_HUB_CHECK_ID,
    name: 'Web Application Baxter HUB Check',
    desc: 'Certificación por etapas para aplicaciones web del Baxter Innovation HUB: inventario, puertos, enumeración de rutas, DAST, pentest manual y sign-off.',
    defaultUrgency: 'High',
  },
  {
    id: MEDICAL_DEVICE_HUB_CHECK_ID,
    name: 'Medical Device Baxter HUB Check',
    desc: 'Certificación por etapas para dispositivos médicos del HUB: clasificación, segmentación, SBOM/firmware, pruebas de interfaz, riesgo clínico y sign-off.',
    defaultUrgency: 'High',
  },
];

const WEB_APP_STAGES: CertificationStageDefinition[] = [
  {
    key: 'intake_scoping',
    label: 'Intake & Scope Definition',
    description: 'Registro de alcance, contactos, ambientes y reglas de engagement alineadas al Baxter Innovation HUB.',
    mode: 'manual',
    standardRef: 'OWASP SAMM / ISO 27001 A.8',
  },
  {
    key: 'asset_discovery',
    label: 'Asset Discovery & Inventory',
    description: 'Inventario de hosts, certificados, dependencias y superficie expuesta del activo.',
    mode: 'automated',
    standardRef: 'CIS Controls 1–2',
  },
  {
    key: 'port_scan',
    label: 'Network Port Scanning',
    description: 'Descubrimiento de puertos y servicios TCP/UDP en alcance autorizado.',
    mode: 'automated',
    standardRef: 'NIST SP 800-115',
  },
  {
    key: 'route_enumeration',
    label: 'Web Route Enumeration',
    description: 'Mapeo de rutas, endpoints API y recursos ocultos de la aplicación web.',
    mode: 'automated',
    standardRef: 'OWASP WSTG-INFO',
  },
  {
    key: 'auth_mapping',
    label: 'Authenticated Application Mapping',
    description: 'Recorrido autenticado de roles, sesiones y flujos de negocio críticos.',
    mode: 'hybrid',
    standardRef: 'OWASP WSTG-ATHN/ATHZ',
  },
  {
    key: 'dast',
    label: 'Dynamic Application Security Testing (DAST)',
    description: 'Escaneo dinámico de vulnerabilidades en runtime (inyección, XSS, misconfig, etc.).',
    mode: 'automated',
    standardRef: 'OWASP ASVS L2 / WSTG',
  },
  {
    key: 'manual_pentest',
    label: 'Manual Penetration Testing',
    description: 'Explotación controlada y validación manual de hallazgos de alto impacto.',
    mode: 'manual',
    standardRef: 'PTES / OWASP Testing Guide',
  },
  {
    key: 'vuln_triage',
    label: 'Vulnerability Triage & Risk Rating',
    description: 'Clasificación CVSS/negocio, falsos positivos y plan de remediación priorizado.',
    mode: 'manual',
    standardRef: 'CVSS 3.1 / Baxter risk matrix',
  },
  {
    key: 'remediation_retest',
    label: 'Remediation Validation / Retest',
    description: 'Re-prueba de fixes y evidencia de cierre antes de la certificación.',
    mode: 'hybrid',
    standardRef: 'ISO 27001 A.8.8',
  },
  {
    key: 'certification_signoff',
    label: 'Baxter HUB Certification Sign-off',
    description: 'Emisión del dictamen de certificación HUB y paquete de evidencia para el cliente.',
    mode: 'manual',
    standardRef: 'Baxter Innovation HUB gate',
  },
];

const MEDICAL_DEVICE_STAGES: CertificationStageDefinition[] = [
  {
    key: 'device_classification',
    label: 'Device Classification & Scope',
    description: 'Clase del dispositivo, entorno clínico, interfaces y límites del engagement.',
    mode: 'manual',
    standardRef: 'IEC 62304 / FDA Premarket Cybersecurity',
  },
  {
    key: 'architecture_dataflow',
    label: 'Architecture & Data-Flow Review',
    description: 'Revisión de arquitectura, trust boundaries y flujos de PHI/datos clínicos.',
    mode: 'manual',
    standardRef: 'IEC 62443-3-2',
  },
  {
    key: 'network_segmentation_scan',
    label: 'Network Segmentation & Port Scan',
    description: 'Validación de segmentación y descubrimiento de superficie de red del dispositivo.',
    mode: 'automated',
    standardRef: 'IEC 62443-3-3 / NIST 800-82',
  },
  {
    key: 'interface_protocol_testing',
    label: 'Interface & Protocol Security Testing',
    description: 'Pruebas de interfaces clínicas (HL7/FHIR/DICOM), APIs y protocolos propietarios.',
    mode: 'hybrid',
    standardRef: 'IEC 80001 / HL7 security',
  },
  {
    key: 'firmware_sbom_review',
    label: 'Firmware / SBOM Review',
    description: 'Análisis de firmware, componentes de terceros y lista de materiales de software (SBOM).',
    mode: 'manual',
    standardRef: 'NTIA SBOM / FDA guidance',
  },
  {
    key: 'auth_access_control',
    label: 'Authentication & Access Control Review',
    description: 'Cuentas locales, roles clínicos, credenciales por defecto y endurecimiento.',
    mode: 'manual',
    standardRef: 'IEC 62443-4-2',
  },
  {
    key: 'vulnerability_assessment',
    label: 'Vulnerability Assessment',
    description: 'Escaneo y correlación de CVEs aplicables a SO, stack y componentes del dispositivo.',
    mode: 'automated',
    standardRef: 'NIST SP 800-40',
  },
  {
    key: 'medical_device_pentest',
    label: 'Medical Device Penetration Testing',
    description: 'Pentest manual enfocado en seguridad del paciente, disponibilidad y abuso de interfaz.',
    mode: 'manual',
    standardRef: 'AAMI TIR57 / PTES',
  },
  {
    key: 'clinical_risk_assessment',
    label: 'Clinical Risk & Residual Risk Assessment',
    description: 'Evaluación de riesgo clínico residual y controles compensatorios documentados.',
    mode: 'manual',
    standardRef: 'ISO 14971 / AAMI TIR57',
  },
  {
    key: 'device_certification_signoff',
    label: 'Baxter HUB Device Certification Sign-off',
    description: 'Dictamen de certificación del dispositivo médico en el Innovation HUB.',
    mode: 'manual',
    standardRef: 'Baxter Innovation HUB gate',
  },
];

export const CERTIFICATION_TEMPLATES: Record<string, CertificationTemplate> = {
  [WEB_APP_HUB_CHECK_ID]: {
    id: WEB_APP_HUB_CHECK_ID,
    name: 'Web Application Baxter HUB Check',
    stages: WEB_APP_STAGES,
  },
  [MEDICAL_DEVICE_HUB_CHECK_ID]: {
    id: MEDICAL_DEVICE_HUB_CHECK_ID,
    name: 'Medical Device Baxter HUB Check',
    stages: MEDICAL_DEVICE_STAGES,
  },
};

const NAME_TO_WORKFLOW: Record<string, string> = {
  'web application baxter hub check': WEB_APP_HUB_CHECK_ID,
  'medical device baxter hub check': MEDICAL_DEVICE_HUB_CHECK_ID,
  [WEB_APP_HUB_CHECK_ID]: WEB_APP_HUB_CHECK_ID,
  [MEDICAL_DEVICE_HUB_CHECK_ID]: MEDICAL_DEVICE_HUB_CHECK_ID,
};

export function isBaxterHubCertificationService(serviceIdOrName: string): boolean {
  if (!serviceIdOrName) return false;
  const lower = serviceIdOrName.toLowerCase().trim();
  if (NAME_TO_WORKFLOW[lower]) return true;
  return (
    lower.includes('baxter hub check') ||
    lower.includes('baxter_hub_web') ||
    lower.includes('baxter_hub_medical')
  );
}

export function resolveWorkflowId(serviceIdOrName: string): string | null {
  if (!serviceIdOrName) return null;
  const lower = serviceIdOrName.toLowerCase().trim();
  if (NAME_TO_WORKFLOW[lower]) return NAME_TO_WORKFLOW[lower];
  if (CERTIFICATION_TEMPLATES[serviceIdOrName]) return serviceIdOrName;
  if (lower.includes('medical device') && lower.includes('hub')) return MEDICAL_DEVICE_HUB_CHECK_ID;
  if (lower.includes('web application') && lower.includes('hub')) return WEB_APP_HUB_CHECK_ID;
  if (isBaxterHubCertificationService(serviceIdOrName)) {
    return lower.includes('medical') ? MEDICAL_DEVICE_HUB_CHECK_ID : WEB_APP_HUB_CHECK_ID;
  }
  return null;
}

export function getTemplateForService(serviceIdOrName: string): CertificationTemplate | null {
  const id = resolveWorkflowId(serviceIdOrName);
  return id ? CERTIFICATION_TEMPLATES[id] ?? null : null;
}

function nowIsoDate(): string {
  return new Date().toISOString().split('T')[0];
}

function makeUpdate(partial: Omit<TicketUpdate, 'id'> & { id?: string }): TicketUpdate {
  return {
    id: partial.id ?? `UPD-${Math.floor(1000 + Math.random() * 9000)}`,
    at: partial.at,
    actor: partial.actor,
    message: partial.message,
    stageKey: partial.stageKey,
  };
}

export function instantiateStages(defs: CertificationStageDefinition[]): CertificationStageInstance[] {
  return defs.map((def, index) => ({
    ...def,
    status: index === 0 ? 'in_progress' : 'queued',
    startedAt: index === 0 ? nowIsoDate() : undefined,
  }));
}

export function resolveTicketStatusFromStages(stages: CertificationStageInstance[]): TicketStatus {
  if (!stages.length) return 'PENDIENTE';
  if (stages.every((s) => s.status === 'completed')) return 'COMPLETADO';
  if (stages.some((s) => s.status === 'in_progress' || s.status === 'completed')) return 'EN PROGRESO';
  return 'PENDIENTE';
}

export function getCertificationProgress(ticket: Pick<CertificationTicket, 'stages'>) {
  const total = ticket.stages.length;
  const completed = ticket.stages.filter((s) => s.status === 'completed').length;
  const current = ticket.stages.find((s) => s.status === 'in_progress');
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return {
    completed,
    total,
    percent,
    currentLabel: current?.label ?? (percent === 100 ? 'Certification complete' : 'Queued'),
  };
}

export function buildCertificationTicket(input: {
  id: string;
  serviceId: string;
  serviceName: string;
  target: string;
  urgency: TicketUrgency;
  description: string;
  createdAt: string;
  actor?: string;
}): CertificationTicket {
  const template = getTemplateForService(input.serviceId) ?? getTemplateForService(input.serviceName);
  if (!template) {
    throw new Error(`No Baxter HUB certification template for ${input.serviceId}`);
  }

  const stages = instantiateStages(template.stages);
  const actor = input.actor ?? 'client';
  const first = stages[0];

  return {
    id: input.id,
    type: input.serviceName,
    target: input.target,
    urgency: input.urgency,
    status: 'EN PROGRESO',
    createdAt: input.createdAt,
    description: input.description,
    workflowId: template.id,
    currentStageKey: first?.key ?? null,
    stages,
    updates: [
      makeUpdate({
        at: input.createdAt,
        actor,
        message: `Solicitud de certificación creada — etapa inicial: ${first?.label ?? 'N/A'}.`,
        stageKey: first?.key,
      }),
    ],
  };
}

export function advanceCertificationStage(
  ticket: CertificationTicket,
  opts: { note: string; actor: string; at?: string } = { note: '', actor: 'system' },
): CertificationTicket {
  const at = opts.at ?? nowIsoDate();
  const idx = ticket.stages.findIndex((s) => s.status === 'in_progress');
  if (idx < 0) {
    if (ticket.stages.every((s) => s.status === 'completed')) return ticket;
    return ticket;
  }

  const stages = ticket.stages.map((s, i) => {
    if (i === idx) {
      return {
        ...s,
        status: 'completed' as StageStatus,
        completedAt: at,
        note: opts.note || s.note,
        actor: opts.actor,
      };
    }
    if (i === idx + 1) {
      return {
        ...s,
        status: 'in_progress' as StageStatus,
        startedAt: at,
      };
    }
    return s;
  });

  const completedStage = stages[idx];
  const next = stages[idx + 1];
  const status = resolveTicketStatusFromStages(stages);

  const updates = [
    ...ticket.updates,
    makeUpdate({
      at,
      actor: opts.actor,
      message: opts.note?.trim()
        ? `Etapa completada: ${completedStage.label}. ${opts.note.trim()}`
        : `Etapa completada: ${completedStage.label}.`,
      stageKey: completedStage.key,
    }),
  ];

  if (next) {
    updates.push(
      makeUpdate({
        at,
        actor: opts.actor,
        message: `Etapa en curso: ${next.label} (${next.mode}).`,
        stageKey: next.key,
      }),
    );
  } else {
    updates.push(
      makeUpdate({
        at,
        actor: opts.actor,
        message: 'Certificación Baxter HUB completada. Dictamen listo para el cliente.',
        stageKey: completedStage.key,
      }),
    );
  }

  return {
    ...ticket,
    stages,
    status,
    currentStageKey: next?.key ?? null,
    updates,
  };
}

/** Advance N stages (used for dummy seeds and demos). */
export function advanceCertificationStages(
  ticket: CertificationTicket,
  count: number,
  opts: { note: string; actor: string; at?: string },
): CertificationTicket {
  let current = ticket;
  for (let i = 0; i < count; i++) {
    current = advanceCertificationStage(current, {
      note: `${opts.note} (${i + 1})`,
      actor: opts.actor,
      at: opts.at,
    });
  }
  return current;
}

export function createDummyBaxterHubTickets(): CertificationTicket[] {
  const web = buildCertificationTicket({
    id: 'TK-HUB-2401',
    serviceId: WEB_APP_HUB_CHECK_ID,
    serviceName: 'Web Application Baxter HUB Check',
    target: 'innovation-hub.baxter.example',
    urgency: 'High',
    description: 'Certificación web del portal de innovación Baxter HUB (ambiente QA).',
    createdAt: '2026-08-12',
    actor: 'cliente@demo.local',
  });

  const webInProgress = advanceCertificationStages(web, 3, {
    note: 'Avance automático de demo — evidencia registrada en Phantom',
    actor: 'analyst@Phantom.local',
    at: '2026-08-18',
  });

  const device = buildCertificationTicket({
    id: 'TK-HUB-2402',
    serviceId: MEDICAL_DEVICE_HUB_CHECK_ID,
    serviceName: 'Medical Device Baxter HUB Check',
    target: 'infusion-pump-lab.hub.baxter.com',
    urgency: 'High',
    description: 'Certificación de bomba de infusión en laboratorio del Innovation HUB.',
    createdAt: '2026-08-10',
    actor: 'cliente@demo.local',
  });

  const deviceFurther = advanceCertificationStages(device, 6, {
    note: 'Validación de laboratorio HUB',
    actor: 'lead@Phantom.local',
    at: '2026-08-19',
  });

  return [webInProgress, deviceFurther];
}

export function mergeBaxterHubCatalog(existing: ServiceCatalogItem[]): ServiceCatalogItem[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const item of BAXTER_HUB_CATALOG) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  // Prefer Baxter HUB checks near the top after PKI
  const merged = Array.from(byId.values());
  const hub = merged.filter((s) => BAXTER_HUB_CATALOG.some((h) => h.id === s.id));
  const rest = merged.filter((s) => !BAXTER_HUB_CATALOG.some((h) => h.id === s.id));
  const pki = rest.filter((s) => s.id.includes('pki') || s.name.toLowerCase().includes('pki'));
  const other = rest.filter((s) => !(s.id.includes('pki') || s.name.toLowerCase().includes('pki')));
  return [...pki, ...hub, ...other];
}
