import { describe, expect, it } from 'vitest';
import {
  BAXTER_HUB_CATALOG,
  MEDICAL_DEVICE_HUB_CHECK_ID,
  WEB_APP_HUB_CHECK_ID,
  advanceCertificationStage,
  buildCertificationTicket,
  createDummyBaxterHubTickets,
  getCertificationProgress,
  getTemplateForService,
  isBaxterHubCertificationService,
  resolveTicketStatusFromStages,
} from './baxter-hub-certification';

describe('Baxter HUB certification catalog', () => {
  it('exposes Web Application and Medical Device catalog entries', () => {
    const ids = BAXTER_HUB_CATALOG.map((s) => s.id);
    expect(ids).toContain(WEB_APP_HUB_CHECK_ID);
    expect(ids).toContain(MEDICAL_DEVICE_HUB_CHECK_ID);
    expect(BAXTER_HUB_CATALOG).toHaveLength(2);
  });

  it('detects certification services by id and name', () => {
    expect(isBaxterHubCertificationService(WEB_APP_HUB_CHECK_ID)).toBe(true);
    expect(isBaxterHubCertificationService('Web Application Baxter HUB Check')).toBe(true);
    expect(isBaxterHubCertificationService('Medical Device Baxter HUB Check')).toBe(true);
    expect(isBaxterHubCertificationService('Escaneo de Puertos Abiertos (Nmap)')).toBe(false);
  });
});

describe('stage templates', () => {
  it('defines professional multi-stage web certification workflow', () => {
    const template = getTemplateForService(WEB_APP_HUB_CHECK_ID);
    expect(template).toBeTruthy();
    const keys = template!.stages.map((s) => s.key);
    expect(keys).toEqual([
      'intake_scoping',
      'asset_discovery',
      'port_scan',
      'route_enumeration',
      'auth_mapping',
      'dast',
      'manual_pentest',
      'vuln_triage',
      'remediation_retest',
      'certification_signoff',
    ]);
    expect(template!.stages.some((s) => s.mode === 'automated')).toBe(true);
    expect(template!.stages.some((s) => s.mode === 'manual')).toBe(true);
  });

  it('defines medical device workflow with clinical risk and SBOM stages', () => {
    const template = getTemplateForService(MEDICAL_DEVICE_HUB_CHECK_ID);
    expect(template).toBeTruthy();
    const keys = template!.stages.map((s) => s.key);
    expect(keys).toContain('device_classification');
    expect(keys).toContain('firmware_sbom_review');
    expect(keys).toContain('clinical_risk_assessment');
    expect(keys).toContain('device_certification_signoff');
    expect(template!.stages.length).toBeGreaterThanOrEqual(8);
  });
});

describe('ticket lifecycle', () => {
  it('builds a ticket with pending first stage and remaining queued', () => {
    const ticket = buildCertificationTicket({
      id: 'TK-1001',
      serviceId: WEB_APP_HUB_CHECK_ID,
      serviceName: 'Web Application Baxter HUB Check',
      target: 'hub-check.baxter.example',
      urgency: 'High',
      description: 'Innovation Hub web app certification',
      createdAt: '2026-08-20',
    });

    expect(ticket.workflowId).toBe(WEB_APP_HUB_CHECK_ID);
    expect(ticket.stages).toHaveLength(10);
    expect(ticket.stages[0].status).toBe('in_progress');
    expect(ticket.stages.slice(1).every((s) => s.status === 'queued')).toBe(true);
    expect(ticket.status).toBe('EN PROGRESO');
    expect(ticket.currentStageKey).toBe('intake_scoping');
  });

  it('computes progress percent from completed stages', () => {
    const ticket = buildCertificationTicket({
      id: 'TK-1002',
      serviceId: WEB_APP_HUB_CHECK_ID,
      serviceName: 'Web Application Baxter HUB Check',
      target: 'app.example.com',
      urgency: 'Medium',
      description: 'progress check',
      createdAt: '2026-08-20',
    });

    expect(getCertificationProgress(ticket)).toEqual({
      completed: 0,
      total: 10,
      percent: 0,
      currentLabel: 'Intake & Scope Definition',
    });

    const afterTwo = advanceCertificationStage(ticket, {
      note: 'Scope approved by Baxter HUB security lead',
      actor: 'analyst@Phantom.local',
    });
    const afterThree = advanceCertificationStage(afterTwo, {
      note: 'Asset inventory synced',
      actor: 'automation',
    });

    expect(getCertificationProgress(afterThree)).toEqual({
      completed: 2,
      total: 10,
      percent: 20,
      currentLabel: 'Network Port Scanning',
    });
    expect(afterThree.stages[0].status).toBe('completed');
    expect(afterThree.stages[1].status).toBe('completed');
    expect(afterThree.stages[2].status).toBe('in_progress');
    expect(afterThree.currentStageKey).toBe('port_scan');
    expect(afterThree.status).toBe('EN PROGRESO');
  });

  it('marks ticket COMPLETADO when final stage is advanced', () => {
    let ticket = buildCertificationTicket({
      id: 'TK-1003',
      serviceId: MEDICAL_DEVICE_HUB_CHECK_ID,
      serviceName: 'Medical Device Baxter HUB Check',
      target: 'infusion-pump-lab.hub.baxter.com',
      urgency: 'High',
      description: 'device cert',
      createdAt: '2026-08-20',
    });

    const total = ticket.stages.length;
    for (let i = 0; i < total; i++) {
      ticket = advanceCertificationStage(ticket, {
        note: `Completed stage ${i + 1}`,
        actor: 'soc-editor',
      });
    }

    expect(ticket.stages.every((s) => s.status === 'completed')).toBe(true);
    expect(ticket.status).toBe('COMPLETADO');
    expect(ticket.currentStageKey).toBeNull();
    expect(getCertificationProgress(ticket).percent).toBe(100);
    expect(resolveTicketStatusFromStages(ticket.stages)).toBe('COMPLETADO');
  });

  it('is idempotent when advancing an already completed ticket', () => {
    let ticket = buildCertificationTicket({
      id: 'TK-1004',
      serviceId: WEB_APP_HUB_CHECK_ID,
      serviceName: 'Web Application Baxter HUB Check',
      target: 'done.example.com',
      urgency: 'Low',
      description: 'done',
      createdAt: '2026-08-20',
    });
    for (let i = 0; i < ticket.stages.length; i++) {
      ticket = advanceCertificationStage(ticket, { note: 'ok', actor: 'soc' });
    }
    const again = advanceCertificationStage(ticket, { note: 'noop', actor: 'soc' });
    expect(again).toEqual(ticket);
  });
});

describe('dummy seed tickets', () => {
  it('returns realistic ServiceNow-style examples in different progress states', () => {
    const dummies = createDummyBaxterHubTickets();
    expect(dummies.length).toBeGreaterThanOrEqual(2);
    expect(dummies.some((t) => t.workflowId === WEB_APP_HUB_CHECK_ID)).toBe(true);
    expect(dummies.some((t) => t.workflowId === MEDICAL_DEVICE_HUB_CHECK_ID)).toBe(true);
    expect(dummies.some((t) => t.status === 'EN PROGRESO')).toBe(true);
    expect(dummies.every((t) => Array.isArray(t.stages) && t.stages.length > 0)).toBe(true);
    expect(dummies.every((t) => t.updates && t.updates.length > 0)).toBe(true);
  });
});
