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
  requester?: string;
  requesterEmail?: string;
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
    desc: 'Multi-stage certification for Baxter Innovation HUB web applications: inventory, port scanning, endpoint enumeration, DAST, manual pentest, and executive sign-off.',
    defaultUrgency: 'High',
  },
  {
    id: MEDICAL_DEVICE_HUB_CHECK_ID,
    name: 'Medical Device Baxter HUB Check',
    desc: 'Multi-stage certification for HUB medical devices: classification, network segmentation, SBOM/firmware validation, interface testing, clinical risk assessment, and executive sign-off.',
    defaultUrgency: 'High',
  },
];

const WEB_APP_STAGES: CertificationStageDefinition[] = [
  {
    key: 'intake_scoping',
    label: 'Intake & Scope Definition',
    description: 'Scope definition, key contacts, testing environments, and rules of engagement aligned with Baxter Innovation HUB.',
    mode: 'manual',
    standardRef: 'OWASP SAMM / ISO 27001 A.8',
  },
  {
    key: 'asset_discovery',
    label: 'Asset Discovery & Inventory',
    description: 'Inventory of target hosts, certificates, dependencies, and attack surface exposed by the asset.',
    mode: 'automated',
    standardRef: 'CIS Controls 1–2',
  },
  {
    key: 'port_scan',
    label: 'Network Port Scanning',
    description: 'Discovery of authorized TCP/UDP ports and network services in scope.',
    mode: 'automated',
    standardRef: 'NIST SP 800-115',
  },
  {
    key: 'route_enumeration',
    label: 'Web Route Enumeration',
    description: 'Mapping web routes, API endpoints, hidden endpoints, and application parameters.',
    mode: 'automated',
    standardRef: 'OWASP WSTG-INFO',
  },
  {
    key: 'auth_mapping',
    label: 'Authenticated Application Mapping',
    description: 'Authenticated mapping of roles, session controls, and business logic workflows.',
    mode: 'hybrid',
    standardRef: 'OWASP WSTG-ATHN/ATHZ',
  },
  {
    key: 'dast',
    label: 'Dynamic Application Security Testing (DAST)',
    description: 'Dynamic runtime vulnerability scanning (injection, XSS, broken access, misconfigurations).',
    mode: 'automated',
    standardRef: 'OWASP ASVS L2 / WSTG',
  },
  {
    key: 'manual_pentest',
    label: 'Manual Penetration Testing',
    description: 'Controlled manual exploitation and in-depth validation of high-impact attack vectors.',
    mode: 'manual',
    standardRef: 'PTES / OWASP Testing Guide',
  },
  {
    key: 'vuln_triage',
    label: 'Vulnerability Triage & Risk Rating',
    description: 'CVSS and business impact triage, false positive elimination, and prioritized remediation roadmap.',
    mode: 'manual',
    standardRef: 'CVSS 3.1 / Baxter risk matrix',
  },
  {
    key: 'remediation_retest',
    label: 'Remediation Validation / Retest',
    description: 'Verification of applied remediation fixes and evidence collection before final sign-off.',
    mode: 'hybrid',
    standardRef: 'ISO 27001 A.8.8',
  },
  {
    key: 'certification_signoff',
    label: 'Baxter HUB Certification Sign-off',
    description: 'Issuance of the Baxter HUB certification attestation and client evidence package.',
    mode: 'manual',
    standardRef: 'Baxter Innovation HUB gate',
  },
];

const MEDICAL_DEVICE_STAGES: CertificationStageDefinition[] = [
  {
    key: 'device_classification',
    label: 'Device Classification & Scope',
    description: 'Device classification, clinical operating environment, interfaces, and engagement boundaries.',
    mode: 'manual',
    standardRef: 'IEC 62304 / FDA Premarket Cybersecurity',
  },
  {
    key: 'architecture_dataflow',
    label: 'Architecture & Data-Flow Review',
    description: 'Architecture, trust boundaries, and patient health information (PHI)/clinical data flows review.',
    mode: 'manual',
    standardRef: 'IEC 62443-3-2',
  },
  {
    key: 'network_segmentation_scan',
    label: 'Network Segmentation & Port Scan',
    description: 'Network segmentation validation and device exposure surface discovery.',
    mode: 'automated',
    standardRef: 'IEC 62443-3-3 / NIST 800-82',
  },
  {
    key: 'interface_protocol_testing',
    label: 'Interface & Protocol Security Testing',
    description: 'Clinical interface testing (HL7/FHIR/DICOM), proprietary protocols, and API security.',
    mode: 'hybrid',
    standardRef: 'IEC 80001 / HL7 security',
  },
  {
    key: 'firmware_sbom_review',
    label: 'Firmware / SBOM Review',
    description: 'Firmware analysis, third-party libraries, and Software Bill of Materials (SBOM) review.',
    mode: 'manual',
    standardRef: 'NTIA SBOM / FDA guidance',
  },
  {
    key: 'auth_access_control',
    label: 'Authentication & Access Control Review',
    description: 'Local accounts, clinical role management, default credentials check, and device hardening.',
    mode: 'manual',
    standardRef: 'IEC 62443-4-2',
  },
  {
    key: 'vulnerability_assessment',
    label: 'Vulnerability Assessment',
    description: 'Scanning and correlating CVEs affecting operating systems, runtimes, and device components.',
    mode: 'automated',
    standardRef: 'NIST SP 800-40',
  },
  {
    key: 'medical_device_pentest',
    label: 'Medical Device Penetration Testing',
    description: 'Manual penetration testing focused on patient safety, availability, and interface abuse.',
    mode: 'manual',
    standardRef: 'AAMI TIR57 / PTES',
  },
  {
    key: 'clinical_risk_assessment',
    label: 'Clinical Risk & Residual Risk Assessment',
    description: 'Residual clinical risk assessment and documented compensating security controls.',
    mode: 'manual',
    standardRef: 'ISO 14971 / AAMI TIR57',
  },
  {
    key: 'device_certification_signoff',
    label: 'Baxter HUB Device Certification Sign-off',
    description: 'Final medical device certification verdict in the Baxter Innovation HUB.',
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
  requester?: string;
  requesterEmail?: string;
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
    requester: input.requester,
    requesterEmail: input.requesterEmail,
    workflowId: template.id,
    currentStageKey: first?.key ?? null,
    stages,
    updates: [
      makeUpdate({
        at: input.createdAt,
        actor,
        message: `Certification request created — initial stage: ${first?.label ?? 'N/A'}.`,
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
        ? `Stage completed: ${completedStage.label}. ${opts.note.trim()}`
        : `Stage completed: ${completedStage.label}.`,
      stageKey: completedStage.key,
    }),
  ];

  if (next) {
    updates.push(
      makeUpdate({
        at,
        actor: opts.actor,
        message: `Current stage: ${next.label} (${next.mode}).`,
        stageKey: next.key,
      }),
    );
  } else {
    updates.push(
      makeUpdate({
        at,
        actor: opts.actor,
        message: 'Baxter HUB Certification completed. Attestation package ready for client.',
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
    description: 'Web certification of the Baxter HUB Innovation portal (QA environment).',
    createdAt: '2026-08-12',
    actor: 'cliente@demo.local',
  });

  const webInProgress = advanceCertificationStages(web, 3, {
    note: 'Automated demo progress — verified evidence stored in Phantom',
    actor: 'analyst@Phantom.local',
    at: '2026-08-18',
  });

  const device = buildCertificationTicket({
    id: 'TK-HUB-2402',
    serviceId: MEDICAL_DEVICE_HUB_CHECK_ID,
    serviceName: 'Medical Device Baxter HUB Check',
    target: 'infusion-pump-lab.hub.baxter.com',
    urgency: 'High',
    description: 'Infusion pump security certification in Innovation HUB laboratory.',
    createdAt: '2026-08-10',
    actor: 'cliente@demo.local',
  });

  const deviceFurther = advanceCertificationStages(device, 6, {
    note: 'HUB laboratory security validation',
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
