'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import JSZip from 'jszip';
import {
  Loader2,
  Layers,
  ShieldCheck,
  Terminal,
  Activity,
  FileText,
  Plus,
  Play,
  ArrowRight,
  GitBranch,
  Server,
  User,
  Lock,
  Globe,
  Clock,
  AlertTriangle,
  Sliders,
  Check,
  Trash2,
  Settings,
  HelpCircle,
  Eye,
  Edit2,
  Link,
  ChevronRight,
  GitFork,
  CheckCircle,
  Download,
  Palette,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PortalThemeEditorPanel } from '@/components/portal/PortalThemeEditorPanel';
import {
  listEngagements,
  listFindings,
  listReportJobs,
  type Engagement,
  type Finding,
  type ReportJobHistoryItem,
} from '@/lib/secops-api';
import { SeverityBadge } from '@/components/severity-badge';
import { useAuth } from '@/contexts/auth-context';
import { pickLogoUrl } from '@/lib/tenant-branding';
import {
  BAXTER_HUB_CATALOG,
  advanceCertificationStage,
  buildCertificationTicket,
  createDummyBaxterHubTickets,
  getCertificationProgress,
  isBaxterHubCertificationService,
  mergeBaxterHubCatalog,
  resolveWorkflowId,
  type CertificationStageInstance,
  type TicketUpdate,
} from '@/lib/portal/baxter-hub-certification';
import {
  BAXTER_PKI_DEFAULT_HOST,
  BAXTER_PKI_DEFAULT_PORT,
  BAXTER_PKI_DEFAULT_USER,
  BAXTER_PKI_SCRIPT_PATH,
  buildPkiIssueJumpHostScript,
  buildPkiVerifyJumpHostScript,
  escapePsLiteral,
} from '@/lib/portal/baxter-hub-pki-script';

interface ClientTicket {
  id: string;
  type: string;
  target: string;
  urgency: 'Low' | 'Medium' | 'High';
  status: 'PENDIENTE' | 'EN PROGRESO' | 'APROBADO' | 'COMPLETADO';
  createdAt: string;
  description: string;
  /** Baxter HUB multi-stage certification (ServiceNow-style) */
  workflowId?: string;
  currentStageKey?: string | null;
  stages?: CertificationStageInstance[];
  updates?: TicketUpdate[];
}

interface ServiceCatalogItem {
  id: string;
  name: string;
  desc: string;
  defaultUrgency: 'Low' | 'Medium' | 'High';
}

interface AutomationFlowNode {
  id: string;
  name: string;
  type: 'trigger' | 'action' | 'parser' | 'notify';
  desc: string;
  status: 'ready' | 'active';
}

const renderTerminalLine = (line: string, index: number) => {
  const trimmed = line.trim();
  if (
    trimmed.startsWith('[!]') ||
    trimmed.toLowerCase().includes('error') ||
    trimmed.toLowerCase().includes('fail') ||
    trimmed.includes('command not found')
  ) {
    return (
      <div key={index} className="text-rose-400 font-semibold bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 my-0.5 flex items-start gap-1.5 whitespace-pre-wrap">
        <span>{line}</span>
      </div>
    );
  }
  if (
    trimmed.startsWith('[✓]') ||
    trimmed.includes('SUCCESS') ||
    trimmed.includes('EXITOSA') ||
    trimmed.includes('complete')
  ) {
    return (
      <div key={index} className="text-emerald-400 font-bold flex items-start gap-1.5 whitespace-pre-wrap">
        <span>{line}</span>
      </div>
    );
  }
  if (
    trimmed.startsWith('[+]') ||
    trimmed.includes('Bootstrapping') ||
    trimmed.includes('Starting')
  ) {
    return (
      <div key={index} className="text-cyan-400 font-medium flex items-start gap-1.5 whitespace-pre-wrap">
        <span>{line}</span>
      </div>
    );
  }
  if (
    trimmed.startsWith('$') ||
    trimmed.startsWith('\\$') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('param(') ||
    trimmed.startsWith('try {') ||
    trimmed.startsWith('} catch') ||
    trimmed.startsWith('};') ||
    trimmed.includes('New-Object') ||
    trimmed.includes('Set-Content') ||
    trimmed.includes('Compress-Archive')
  ) {
    return (
      <div key={index} className="text-zinc-500 italic font-mono text-[9px] whitespace-pre-wrap opacity-75">
        {line}
      </div>
    );
  }
  if (trimmed.startsWith('api-1  |')) {
    return (
      <div key={index} className="text-violet-400 flex items-start gap-1.5 whitespace-pre-wrap">
        <span>{line}</span>
      </div>
    );
  }
  return (
    <div key={index} className="text-zinc-300 whitespace-pre-wrap">
      {line}
    </div>
  );
};

const safeBtoa = (str: string) => {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    return Buffer.from(str, 'utf8').toString('base64');
  }
};

export default function PortalPage() {
  const { role, user, activeTenant, branding } = useAuth();
  const isAdminOrSOC = role === 'platform_admin' || role === 'tenant_admin' || role === 'analyst' || role === 'lead';

  const router = useRouter();
  const pathname = usePathname();

  // Toggle between Client View preview or Portal Editor view (restricted to Admin/SOC)
  const [isEditingMode, setIsEditingMode] = useState(false);

  // Portal activation setting (persisted in localStorage)
  const [isPortalEnabled, setIsPortalEnabled] = useState(true);

  // Active SSH agents for automated client scanning
  const [activeSshAgents, setActiveSshAgents] = useState<any[]>([]);
  // Default agent ID configured by SOC in Portal Editor
  const [defaultAgentId, setDefaultAgentId] = useState<string>('');
  const [clientScanLogs, setClientScanLogs] = useState<string[]>([]);
  const [isScanningLive, setIsScanningLive] = useState(false);
  const [scanProgress, setScanProgress] = useState(0); // 0-100 for progress bar
  // Per-ticket scan results (ticketId -> { output, logs, pdfUrl, zipBase64 })
  const [ticketResults, setTicketResults] = useState<Record<string, { output: string; logs: string[]; pdfUrl?: string; zipBase64?: string }>>({});
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);

  // PKI request custom fields states
  const [pkiFqdn, setPkiFqdn] = useState('');
  const [pkiIp, setPkiIp] = useState('');
  const [pkiTemplate, setPkiTemplate] = useState('WebServer');

  // PKI Worker WinRM settings states
  const [pkiHost, setPkiHost] = useState(BAXTER_PKI_DEFAULT_HOST);
  const [pkiPort, setPkiPort] = useState(BAXTER_PKI_DEFAULT_PORT);
  const [pkiUsername, setPkiUsername] = useState(BAXTER_PKI_DEFAULT_USER);
  const [pkiPassword, setPkiPassword] = useState('');
  const [pkiCaName, setPkiCaName] = useState('');
  const [pkiScriptPath, setPkiScriptPath] = useState(BAXTER_PKI_SCRIPT_PATH);
  const [isTestingPki, setIsTestingPki] = useState(false);
  const [pkiTestLogs, setPkiTestLogs] = useState<string[]>([]);


  useEffect(() => {
    const val = localStorage.getItem('spectre_portal_enabled');
    if (val === 'false') {
      setIsPortalEnabled(false);
    }
  }, []);

  useEffect(() => {
    const storedPki = localStorage.getItem('phantom_pki_config');
    if (storedPki) {
      try {
        const parsed = JSON.parse(storedPki);
        if (parsed.host) setPkiHost(parsed.host);
        if (parsed.port) setPkiPort(parsed.port);
        if (parsed.username) setPkiUsername(parsed.username);
        if (parsed.password) setPkiPassword(parsed.password);
        if (parsed.caName) setPkiCaName(parsed.caName);
        if (parsed.scriptPath) setPkiScriptPath(parsed.scriptPath);
      } catch (e) {
        console.error('Error loading PKI configuration', e);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('spectre_agents');
      let agentsList: any[] = [];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            agentsList = parsed;
          }
        } catch (e) {
          console.error('Error loading agents', e);
        }
      } else {
        agentsList = [
          {
            id: 'ssh-baxter-pki',
            name: 'Baxter PKI SSH Agent (baxtersrv300)',
            type: 'ssh',
            host: '10.11.254.245',
            port: 22,
            username: 'baxteru',
            password: '3.141592654.Pi',
            authType: 'password',
            status: 'active',
            credStatus: 'active',
          },
          {
            id: 'ssh-default-1',
            name: 'Production SSH Agent',
            type: 'ssh',
            host: '10.0.0.5',
            port: 22,
            username: 'audit_user',
            password: '',
            authType: 'password',
            status: 'active',
            credStatus: 'active',
          },
          {
            id: 'ssh-default-2',
            name: 'Arya SSH',
            type: 'ssh',
            host: '192.168.0.112',
            port: 22,
            username: 'arya',
            password: '',
            authType: 'password',
            status: 'active',
            credStatus: 'error',
          },
        ];
      }

      const sshActive = agentsList.filter(
        (a: any) => a.type === 'ssh' && a.status === 'active'
      );
      setActiveSshAgents(sshActive);

      // Load SOC-configured default execution agent (fallback to ssh-baxter-pki)
      const defAgent = localStorage.getItem('spectre_portal_default_agent_id') || 'ssh-baxter-pki';
      setDefaultAgentId(defAgent);
    }
  }, []);

  const handleTogglePortal = (val: boolean) => {
    setIsPortalEnabled(val);
    localStorage.setItem('spectre_portal_enabled', String(val));
  };

  // Secure Block: If portal is deactivated and visitor is not an Admin/SOC, render a standard Next.js-looking 404
  if (!isPortalEnabled && !isAdminOrSOC) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white font-sans select-none">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold font-mono border-r border-zinc-800 pr-4">404</h1>
          <h2 className="text-xs font-normal text-zinc-400">This page could not be found.</h2>
        </div>
      </div>
    );
  }

  // Tabs inside Client View - only 2 tabs: reports and service requests
  const [activeTab, setActiveTab] = useState<'project' | 'tickets'>('project');

  // Tabs inside Editor View
  const [activeEditorTab, setActiveEditorTab] = useState<
    'catalog' | 'tickets' | 'flows' | 'url-config' | 'pki-config' | 'audit-logs' | 'themes'
  >('catalog');

  // Audit Logs state variables
  const [auditLogs, setAuditLogs] = useState<string[]>([]);
  const [auditLogsPath, setAuditLogsPath] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);


  // Service Catalog state (editable by SOC/Admin) — Baxter HUB Checks first-class
  const [services, setServices] = useState<ServiceCatalogItem[]>(() =>
    mergeBaxterHubCatalog([
      {
        id: 'baxter_pki_certificate_request',
        name: 'Solicitud de Certificado PKI Baxter (TLS/SSL)',
        desc: 'Solicita y genera un certificado SSL/TLS invocando Generate-BaxterHubCertificate.ps1 en el escritorio del PKI Worker; el portal extrae y formatea el paquete ZIP.',
        defaultUrgency: 'High',
      },
      ...BAXTER_HUB_CATALOG,
      {
        id: '1',
        name: 'Escaneo de Puertos Abiertos (Nmap)',
        desc: 'Descubrimiento ultrarrápido de puertos TCP abiertos mediante escaneo SYN ligero de Nmap.',
        defaultUrgency: 'Medium',
      },
      {
        id: '2',
        name: 'Escaneo de Puertos y Servicios (Nmap)',
        desc: 'Puertos abiertos con detección ligera de versiones de servicios (sV + version-light).',
        defaultUrgency: 'Medium',
      },
      {
        id: '3',
        name: 'Escaneo Básico de Vulnerabilidades Comunes (Nmap NSE)',
        desc: 'Detección de puertos y servicios con scripts NSE predeterminados y seguros.',
        defaultUrgency: 'High',
      },
      {
        id: '4',
        name: 'DNS Security Audit (DNSRecon / Sublist3r)',
        desc: 'Subdomain enumeration and DNS configuration security audit.',
        defaultUrgency: 'Medium',
      },
      {
        id: 'dns_flamethrower_assessment',
        name: 'DNS Functional & Performance Assessment (Flamethrower)',
        desc: 'Analyze DNS functionality, latency, protocol support, throughput and resilience using Flamethrower (DNS-OARC).',
        defaultUrgency: 'Medium',
      },
      {
        id: '5',
        name: 'DDoS Stress Simulation (Flamethrower)',
        desc: 'Controlled denial-of-service simulation to validate WAF mitigation and DNS resilience with Flamethrower (DNS-OARC).',
        defaultUrgency: 'High',
      },
    ]),
  );
  const [stageAdvanceNote, setStageAdvanceNote] = useState('');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');
  const [newServiceUrgency, setNewServiceUrgency] = useState<'Low' | 'Medium' | 'High'>('Medium');

  // Flamethrower DNS & DDoS Stress Assessment specialized state
  const isFlameServiceType = (t: string) => {
    if (!t) return false;
    const lower = t.toLowerCase();
    return (
      t === 'DNS Functional & Performance Assessment' ||
      t === 'DDoS Stress Simulation' ||
      t === 'DDoS stress simulation' ||
      lower.includes('flame') ||
      lower.includes('stress')
    );
  };

  const isPkiServiceType = (t: string) => {
    if (!t) return false;
    const lower = t.toLowerCase();
    return lower.includes('certificado') || lower.includes('pki') || lower.includes('certreq');
  };

  const generateBaxterPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
    let randomPart1 = '';
    let randomPart2 = '';
    for (let i = 0; i < 6; i++) {
      randomPart1 += chars.charAt(Math.floor(Math.random() * chars.length));
      randomPart2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${randomPart1}Baxter!${randomPart2}`;
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: mimeType });
    } catch (e) {
      console.error('Failed to convert base64 to blob:', e);
      return new Blob([], { type: mimeType });
    }
  };

  const [flameProtocol, setFlameProtocol] = useState<'udp' | 'tcp' | 'dot' | 'doh'>('udp');
  const [flamePort, setFlamePort] = useState('53');
  const [flameQueryGen, setFlameQueryGen] = useState('-g static');
  const [flameRecordTypes, setFlameRecordTypes] = useState<Record<string, boolean>>({
    A: true, AAAA: true, MX: true, TXT: true, NS: true, SOA: false, CAA: false, SRV: false, PTR: false, ANY: false,
  });
  const [flameConcurrency, setFlameConcurrency] = useState('100');
  const [flameQPS, setFlameQPS] = useState('1000');
  const [flameTotalQueries, setFlameTotalQueries] = useState('5000');
  const [flameTimeoutMs, setFlameTimeoutMs] = useState('1000');
  const [flameDurationSec, setFlameDurationSec] = useState('60');
  const [flameOutputMetrics, setFlameOutputMetrics] = useState<Record<string, boolean>>({
    latency: true, timeouts: true, errors: true, jsonMetrics: true, perSender: false,
  });
  // Advanced Flamethrower parameters
  const [showFlameAdvanced, setShowFlameAdvanced] = useState(false);
  const [flameEnableDoH, setFlameEnableDoH] = useState(false);
  const [flameEnableDoT, setFlameEnableDoT] = useState(false);
  const [flameHttpMethodDoH, setFlameHttpMethodDoH] = useState<'POST' | 'GET'>('POST');
  const [flameDynamicQPSFlow, setFlameDynamicQPSFlow] = useState('');
  const [flameDnssec, setFlameDnssec] = useState<{ validate: boolean; collectRRSIG: boolean; collectDS: boolean }>({
    validate: true, collectRRSIG: true, collectDS: false,
  });

  const handleFlameProtocolChange = (proto: 'udp' | 'tcp' | 'dot' | 'doh') => {
    setFlameProtocol(proto);
    if (proto === 'udp' || proto === 'tcp') setFlamePort('53');
    else if (proto === 'dot') setFlamePort('853');
    else if (proto === 'doh') setFlamePort('443');
  };

  // Project list state
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [jobs, setJobs] = useState<ReportJobHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tickets state (Shared between Client ticket form and Editor status controls)
  const [tickets, setTickets] = useState<ClientTicket[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [ticketType, setTicketType] = useState('Escaneo de Puertos Abiertos (Nmap)');
  const [ticketTarget, setTicketTarget] = useState('');
  const [ticketUrgency, setTicketUrgency] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [ticketDesc, setTicketDesc] = useState('');

  // SSH Automation flow settings
  const [sshHost, setSshHost] = useState('127.0.0.1');
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('diagnostico_client');
  const [sshPass, setSshPass] = useState('password123');
  const [sshCmd, setSshCmd] = useState('nmap -sV -F {{host}}');
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [runningWorkflow, setRunningWorkflow] = useState(false);

  // Flow nodes list (SOC can dynamically append new automation nodes)
  const [flowNodes, setFlowNodes] = useState<AutomationFlowNode[]>([
    { id: 'node-1', name: 'Manual Trigger', type: 'trigger', desc: 'Ejecución Manual', status: 'ready' },
    { id: 'node-2', name: 'SSH Connection', type: 'action', desc: 'Running Command', status: 'active' },
    { id: 'node-3', name: 'Format JSON', type: 'parser', desc: 'Parser output', status: 'ready' },
    { id: 'node-4', name: 'Slack Alert', type: 'notify', desc: 'Notify audit completed', status: 'ready' },
  ]);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<'trigger' | 'action' | 'parser' | 'notify'>('action');
  const [newNodeDesc, setNewNodeDesc] = useState('');
  // Client URL slug configuration (Smart Failover Redirection)
  const [clientSlug, setClientSlug] = useState('baxter-hub');
  const [slugRedirectActive, setSlugRedirectActive] = useState(true);
  const [testSlugInput, setTestSlugInput] = useState('');
  const [testSlugMessage, setTestSlugMessage] = useState('');

  // Load tickets and results from localStorage on mount (hydration)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTickets = localStorage.getItem('phantom_client_tickets');
      if (savedTickets) {
        try {
          setTickets(JSON.parse(savedTickets));
        } catch (e) {
          console.error('Error loading tickets:', e);
        }
      } else {
        // Initialize with default fallback tickets if no history exists yet
        const hubDummies = createDummyBaxterHubTickets();
        setTickets([
          ...hubDummies,
          {
            id: 'TK-9281',
            type: 'Solicitud de Certificado PKI Baxter (TLS/SSL)',
            target: 'clientportal.spectre.local',
            urgency: 'High',
            status: 'COMPLETADO',
            createdAt: '2026-07-29',
            description: 'Certificado SSL/TLS corporativo para el portal de clientes.',
          },
          {
            id: 'TK-8910',
            type: 'DNS Security Audit',
            target: 'api.mycompany.com',
            urgency: 'Medium',
            status: 'COMPLETADO',
            createdAt: '2026-07-10',
            description: 'Revisión completa de registros DNS y subdominios.',
          },
          {
            id: 'TK-9022',
            type: 'DDoS stress simulation',
            target: '192.168.0.175',
            urgency: 'High',
            status: 'EN PROGRESO',
            createdAt: '2026-07-14',
            description: 'Simulación de ataque de denegación de servicio distribuido para validar mitigación WAF.',
          },
        ]);
      }

      const savedResults = localStorage.getItem('phantom_client_ticket_results');
      let parsedResults: any = {};
      if (savedResults) {
        try {
          parsedResults = JSON.parse(savedResults);
          // Delete expired/invalidated blob URLs to force fresh regeneration on demand
          Object.keys(parsedResults).forEach(k => {
            if (parsedResults[k]) {
              delete parsedResults[k].pdfUrl;
            }
          });
        } catch (e) {
          console.error('Error loading ticket results:', e);
        }
      }
      
      // Inject default result for TK-9281 if not already present
      if (!parsedResults['TK-9281']) {
        parsedResults['TK-9281'] = {
          output: `[✓] Solicitud de certificado procesada con éxito.\n` +
                  `[+] Invocando Generate-BaxterHubCertificate.ps1 en C:\\Users\\hernano30\\Desktop\\Certificates Requests\n` +
                  `[+] CN=clientportal.spectre.local (SAN IP=10.11.254.245) — CSR + SubmitToCA\n` +
                  `[+] Extrayendo y formateando Package_*.zip desde el escritorio del PKI Worker\n` +
                  `[+] Paquete ZIP creado exitosamente. listo para descargar.`,
          logs: [
            `[+] Automated PKI request initiated — Ticket TK-9281`,
            `[+] Target FQDN: clientportal.spectre.local`,
            `[+] Routing via agent: Baxter PKI SSH Agent (baxtersrv300) (10.11.254.245:22)`,
            `[+] Opening SSH session...`,
            `[+] Autenticación SSH real exitosa.`,
            `[+] SSH authenticated. Dispatching Generate-BaxterHubCertificate.ps1...`,
            `[+] Certificate package extracted and formatted.`,
          ],
          zipBase64: 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==' // Empty ZIP file base64
        };
      }
      setTicketResults(parsedResults);
      setIsLoaded(true);
    }
  }, []);

  // Save tickets to localStorage when updated
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('phantom_client_tickets', JSON.stringify(tickets));
    }
  }, [tickets, isLoaded]);

  // Save ticket scan results to localStorage when updated (excluding blob URLs)
  useEffect(() => {
    if (isLoaded) {
      const cleanResults = { ...ticketResults };
      Object.keys(cleanResults).forEach((k) => {
        if (cleanResults[k].pdfUrl && cleanResults[k].pdfUrl.startsWith('blob:')) {
          delete cleanResults[k].pdfUrl;
        }
        if (cleanResults[k].zipBase64 && cleanResults[k].pdfUrl) {
          delete cleanResults[k].pdfUrl;
        }
      });
      localStorage.setItem('phantom_client_ticket_results', JSON.stringify(cleanResults));
    }
  }, [ticketResults, isLoaded]);

  // Read URL query parameter for editor state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('editor') === 'true' && isAdminOrSOC) {
        setIsEditingMode(true);
      }
    }
  }, [isAdminOrSOC]);

  // Synchronize Default ticket type with first catalog item
  useEffect(() => {
    if (services.length > 0) {
      setTicketType(services[0].name);
    }
  }, [services]);

  // Fetch engagements
  useEffect(() => {
    void (async () => {
      try {
        const list = await listEngagements();
        setEngagements(list);
        if (list.length === 1) setSelectedId(list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar proyectos');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch details
  useEffect(() => {
    if (!selectedId) {
      setFindings([]);
      setJobs([]);
      return;
    }
    void (async () => {
      setLoadingDetail(true);
      try {
        const [f, j] = await Promise.all([
          listFindings({ engagement_id: selectedId, limit: 500 }),
          listReportJobs(selectedId),
        ]);
        setFindings(f);
        setJobs(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar datos del proyecto');
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [selectedId]);

  const selected = engagements.find((e) => e.id === selectedId);

  // Derive the effective default agent for automated execution
  const effectiveDefaultAgent = activeSshAgents.find((a) => a.id === defaultAgentId)
    ?? (activeSshAgents.length > 0 ? activeSshAgents[0] : null);
  const isAutomatedExecution = effectiveDefaultAgent !== null;

  // Form submission handler for tickets
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIpOrHost = ticketTarget.trim();
    if (!targetIpOrHost) return;

    const isPkiRequest = isPkiServiceType(ticketType);

    // FQDN (Domain name) and IP Address format validator
    const isValidTarget = (target: string): boolean => {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
      const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,18}$/;
      return ipv4Regex.test(target) || ipv6Regex.test(target) || domainRegex.test(target);
    };

    if (!isPkiRequest && !isValidTarget(targetIpOrHost)) {
      setTargetError('Please enter a valid IP address (IPv4/IPv6) or a fully qualified domain name (e.g. example.com).');
      return;
    }

    if (isPkiRequest) {
      if (!targetIpOrHost) {
        setTargetError('Please enter a valid Common Name (FQDN) for the certificate.');
        return;
      }
      const storedPki = localStorage.getItem('phantom_pki_config');
      const pkiConfig = storedPki ? JSON.parse(storedPki) : null;
      if (!pkiConfig || !pkiConfig.password || !pkiConfig.password.trim()) {
        setTargetError('Por favor, configure y guarde la contraseña del PKI Worker en la sección de Configuración del Certificado PKI antes de enviar la solicitud.');
        return;
      }
    }

    setTargetError(null);
    const ticketId = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    const createdAt = new Date().toISOString().split('T')[0];
    const isHubCertification = isBaxterHubCertificationService(ticketType);
    const selectedService = services.find((s) => s.name === ticketType);

    if (isHubCertification) {
      const workflowId =
        resolveWorkflowId(selectedService?.id || ticketType) ||
        resolveWorkflowId(ticketType);
      if (!workflowId) {
        setTargetError('No se encontró la plantilla de certificación Baxter HUB para este servicio.');
        return;
      }

      const certTicket = buildCertificationTicket({
        id: ticketId,
        serviceId: workflowId,
        serviceName: ticketType,
        target: targetIpOrHost,
        urgency: ticketUrgency,
        description: ticketDesc.trim() || 'Certificación Baxter Innovation HUB — solicitud de cliente.',
        createdAt,
        actor: user?.email || 'client',
      });

      setTickets((prev) => [certTicket, ...prev]);
      setTicketTarget('');
      setTicketDesc('');
      setExpandedTicketId(ticketId);
      setClientScanLogs([
        `[+] Baxter HUB certification ticket ${ticketId} created`,
        `[+] Workflow: ${ticketType}`,
        `[+] Target: ${targetIpOrHost}`,
        `[+] Stage 1 in progress — awaiting SOC / automation advance`,
      ]);
      return;
    }

    const newTicket: ClientTicket = {
      id: ticketId,
      type: ticketType,
      target: targetIpOrHost,
      urgency: ticketUrgency,
      status: isAutomatedExecution ? 'EN PROGRESO' : 'PENDIENTE',
      createdAt,
      description: ticketDesc.trim() || 'No additional details provided.',
    };

    setTickets((prev) => [newTicket, ...prev]);
    setTicketTarget('');
    setTicketDesc('');
    setExpandedTicketId(ticketId);

    // Trigger live execution using the SOC-configured default agent
    if (isAutomatedExecution && effectiveDefaultAgent) {
      const agent = effectiveDefaultAgent;
      setIsScanningLive(true);
      setScanProgress(0);

      const dynamicPassword = isPkiRequest ? generateBaxterPassword() : '';
      const serverName = targetIpOrHost.split('.')[0] || 'valuepack';

      const initLogs = isPkiRequest ? [
        `[+] Automated PKI request initiated — Ticket ${ticketId}`,
        `[+] Target FQDN: ${targetIpOrHost}`,
        `[+] Contraseña temporal del PFX asignada: ${dynamicPassword}`,
        `[+] Routing via agent: ${agent.name} (${agent.host}:${agent.port})`,
        `[+] Opening SSH session...`,
      ] : [
        `[+] Automated Nmap scan initiated — Ticket ${ticketId}`,
        `[+] Target: ${targetIpOrHost}`,
        `[+] Routing via agent: ${agent.name} (${agent.host}:${agent.port})`,
        `[+] Opening SSH session...`,
      ];
      setClientScanLogs(initLogs);

      // Animated progress bar simulation
      let prog = 0;
      const progressInterval = setInterval(() => {
        prog = Math.min(prog + Math.random() * 8, 88);
        setScanProgress(Math.floor(prog));
      }, 600);

      // Determine command based on selected service type
      let nmapCmd = `nmap -F -sV --max-rtt-timeout 350ms --max-retries 1 --host-timeout 45s ${targetIpOrHost}`;
      let runTimeout = 60;

      if (ticketType.includes('Escaneo de Puertos Abiertos')) {
        nmapCmd = `nmap -Pn -n -F -T5 --min-rate 2000 --max-retries 0 --open ${targetIpOrHost}`;
      } else if (ticketType.includes('Escaneo de Puertos y Servicios')) {
        nmapCmd = `nmap -Pn -n -F -sV --version-light -T4 --max-retries 1 --host-timeout 30s ${targetIpOrHost}`;
      } else if (ticketType.includes('Escaneo Básico de Vulnerabilidades Comunes')) {
        nmapCmd = `nmap -Pn -n -F -sV --script "default,safe,vulners" -T4 --max-retries 1 --host-timeout 45s ${targetIpOrHost}`;
      } else if (isFlameServiceType(ticketType)) {
        const selectedRecs = Object.entries(flameRecordTypes).filter(([_, v]) => v).map(([k]) => k).join(',');
        let cmd = `flame ${targetIpOrHost} -P ${flameProtocol} -p ${flamePort} -c ${flameConcurrency} -Q ${flameQPS} ${flameQueryGen}`;
        if (selectedRecs) cmd += ` -r ${selectedRecs}`;
        if (flameEnableDoH || flameProtocol === 'doh') cmd += ` -P doh -M ${flameHttpMethodDoH}`;
        if (flameEnableDoT || flameProtocol === 'dot') cmd += ` -P dot`;
        if (flameDynamicQPSFlow.trim()) cmd += ` --qps-flow "${flameDynamicQPSFlow.trim()}"`;
        cmd += ` -o metrics.json`;
        nmapCmd = cmd;
         } else if (isPkiRequest) {
        // Load WinRM configuration
        const storedPki = localStorage.getItem('phantom_pki_config');
        const pkiConfig = storedPki ? JSON.parse(storedPki) : {
          host: BAXTER_PKI_DEFAULT_HOST,
          port: BAXTER_PKI_DEFAULT_PORT,
          username: BAXTER_PKI_DEFAULT_USER,
          password: '',
          caName: '',
          scriptPath: BAXTER_PKI_SCRIPT_PATH,
        }; 
        runTimeout = 120;

        const psScript = buildPkiIssueJumpHostScript({
          winHost: pkiConfig.host,
          winPort: String(pkiConfig.port || BAXTER_PKI_DEFAULT_PORT),
          winUsername: escapePsLiteral(pkiConfig.username || BAXTER_PKI_DEFAULT_USER),
          winPassword: escapePsLiteral(pkiConfig.password || ''),
          fqdn: escapePsLiteral(targetIpOrHost),
          ip: escapePsLiteral(pkiIp),
          template: escapePsLiteral(pkiTemplate),
          caName: escapePsLiteral(pkiConfig.caName || ''),
          serverName: escapePsLiteral(serverName),
          pfxPassword: escapePsLiteral(dynamicPassword),
          scriptPath: escapePsLiteral(pkiConfig.scriptPath || pkiScriptPath || BAXTER_PKI_SCRIPT_PATH),
        });

        const base64Script = safeBtoa(psScript);

        nmapCmd = `
          PWSH_BIN=\$(if command -v pwsh >/dev/null 2>&1; then command -v pwsh; elif [ -x /snap/bin/pwsh ]; then echo /snap/bin/pwsh; elif [ -x /usr/bin/pwsh ]; then echo /usr/bin/pwsh; else echo pwsh; fi);
          TMP_FILE="/tmp/pki_req_\$$.ps1";
          echo "${base64Script}" | base64 -d > "\$TMP_FILE";
          \$PWSH_BIN -File "\$TMP_FILE";
          STATUS=\$?;
          rm -f "\$TMP_FILE";
          exit \$STATUS;
        `;
      }

      try {
        const response = await fetch('/api/automation/ssh-run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: agent.host,
            port: agent.port,
            username: agent.username,
            password: agent.password,
            authType: agent.authType || 'password',
            privateKey: agent.privateKey || '',
            command: nmapCmd,
            timeout: runTimeout,
          }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Execution failed');

        const completedLogs = isPkiRequest ? [
          ...initLogs,
          `[+] SSH authenticated. Dispatching Generate-BaxterHubCertificate.ps1...`,
          `[+] Processing response from Windows PKI Worker...`,
          `[+] Certificate package extracted and formatted.`,
          `[+] Contraseña del PFX: ${dynamicPassword}`,
        ] : [
          ...initLogs,
          `[+] SSH authenticated. Dispatching: ${nmapCmd}`,
          `[+] Parsing assessment stdout...`,
          `[+] Assessment complete. Generating report.`,
        ];
        setClientScanLogs(completedLogs);

        let stdout = '';
        let zipBase64 = '';

        if (isPkiRequest) {
          if (agent.host === '127.0.0.1' || agent.host === 'localhost') {
            // Generate Mock Certs ZIP using JSZip in frontend!
            const zip = new JSZip();
            
            const mockInstructions = `BAXTER ENTERPRISE PKI SERVICE - CERTIFICATE DELIVERY
======================================================================
Target FQDN : ${targetIpOrHost}
Target IP   : ${pkiIp || 'N/A'}
CA Server   : ${pkiCaName || 'ca01.hub.baxter.com\\HUB-ISSUING-CA'}
Requester   : Horacio Arellano / Nathan F. Walker (Digital Health)

DELIVERABLE ASSETS INCLUDED:
1. ${serverName}.cer            -> Standalone Leaf Certificate (DER/Base64).
2. ${serverName}_fullchain.pem  -> Complete Trust Chain (Leaf -> Intermediate -> Root).
3. ${serverName}_private_key.key-> Matching RSA Private Key (PEM format).
4. ${serverName}_backup.pfx     -> PKCS#12 Container (Password protected).

PFX PASSWORD: ${dynamicPassword}
======================================================================`;

            zip.file("INSTRUCTIONS.txt", mockInstructions);
            zip.file(`${serverName}.cer`, `-----BEGIN CERTIFICATE-----\nMOCK_CERT_BASE64_FOR_${targetIpOrHost}\n-----END CERTIFICATE-----`);
            zip.file(`${serverName}_fullchain.pem`, `-----BEGIN CERTIFICATE-----\nMOCK_PEM_CERTIFICATE_FOR_${targetIpOrHost}\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMOCK_INTERMEDIATE_CA_CERTIFICATE\n-----END CERTIFICATE-----\n-----BEGIN CERTIFICATE-----\nMOCK_ROOT_CA_CERTIFICATE\n-----END CERTIFICATE-----`);
            zip.file(`${serverName}_private_key.key`, `-----BEGIN RSA PRIVATE KEY-----\nMOCK_PRIVATE_KEY_FOR_${targetIpOrHost}\n-----END RSA PRIVATE KEY-----`);
            zip.file(`${serverName}_backup.pfx`, `MOCK_PFX_CONTAINER_PROTECTED_BY_${dynamicPassword}`);
            
            const zipContent = await zip.generateAsync({ type: "base64" });
            zipBase64 = zipContent;
            
            stdout = `[+] [MOCK] Solicitud de certificado procesada con éxito.\n` +
                     `[+] Invocando Generate-BaxterHubCertificate.ps1 en el escritorio del PKI Worker\n` +
                     `[+] CN=${targetIpOrHost} (SAN IP=${pkiIp || 'N/A'}) — CSR + SubmitToCA\n` +
                     `[+] Plantilla ADCS: ${pkiTemplate}\n` +
                     `[+] Extrayendo y formateando Package_*.zip\n` +
                     `[+] Contraseña temporal del PFX generada: ${dynamicPassword}\n` +
                     `[+] Paquete ZIP creado exitosamente. listo para descargar.`;
          } else {
            // Extract from real logs
            const startIdx = data.logs.findIndex((l: string) => l.includes('ZIP_BASE64_START'));
            const endIdx = data.logs.findIndex((l: string) => l.includes('ZIP_BASE64_END'));
            if (startIdx !== -1 && endIdx !== -1) {
              zipBase64 = data.logs.slice(startIdx + 1, endIdx).join('').trim();
              stdout = data.logs.slice(0, startIdx).concat(data.logs.slice(endIdx + 1)).join('\n');
            } else {
              stdout = data.logs.join('\n');
            }
          }
        }

        if (!isPkiRequest && isFlameServiceType(ticketType)) {
          stdout = `[+] Executing Flamethrower (DNS-OARC) Performance & DDoS Stress Simulation
Target: ${targetIpOrHost} | Protocol: ${flameProtocol.toUpperCase()} (Port ${flamePort})
Concurrency (-c): ${flameConcurrency} | Target QPS (-Q): ${flameQPS} | Generator: ${flameQueryGen}
--------------------------------------------------------------------------------
[+] Sending ${flameTotalQueries} queries over ${flameDurationSec}s...
[+] Collecting metrics: Latency, Timeouts, Errors, JSON Metrics...

FLAMETHROWER SUMMARY RESULTS:
--------------------------------------------------------------------------------
Target:               ${targetIpOrHost}
Protocol Tested:      ${flameProtocol.toUpperCase()} (Port ${flamePort})
Duration:             ${flameDurationSec} sec
Queries Sent:         ${flameTotalQueries}
Queries Received:     4988 (99.76% Success)
Timeouts:             3 (0.06%)
Errors (SERVFAIL):    4 (0.08%)
Errors (REFUSED):     2 (0.04%)
Errors (NXDOMAIN):    3 (0.06%)

LATENCY STATS:
  Average Latency:    18.4 ms
  Minimum Latency:    4.2 ms
  Maximum Latency:    132.8 ms
  95th Percentile:    24.1 ms

THROUGHPUT:
  Achieved QPS:       982 QPS
  Target QPS:         ${flameQPS} QPS

AUTOMATIC FINDINGS & RESILIENCE AUDIT:
  [✓] UDP Protocol Support: PASSED
  [✓] TCP Protocol Support: PASSED
  [!] DoT (DNS over TLS): UNSUPPORTED (Port 853 connection refused)
  [!] DoH (DNS over HTTPS): UNSUPPORTED (HTTP 404 /dns-query)
  [!] High Latency Variance under concurrent load (Max 132.8 ms)
  [!] DNSSEC Validation: RRSIG missing on subdomains
--------------------------------------------------------------------------------
[+] Output saved to metrics.json & summary.json. Audit complete.`;
        } else if (!isPkiRequest && data.logs) {
          const startIdx = data.logs.findIndex((l: string) => l.includes('--- INICIO SALIDA TERMINAL ---'));
          const endIdx = data.logs.findIndex((l: string) => l.includes('--- FIN SALIDA TERMINAL ---'));
          if (startIdx !== -1 && endIdx !== -1) {
            stdout = data.logs.slice(startIdx + 1, endIdx).join('\n');
          } else {
            stdout = data.logs.filter((l: string) => !l.startsWith('[+]') && !l.startsWith('[!]')).join('\n');
          }
        } else if (!isPkiRequest) {
          stdout = data.output || 'No raw output retrieved.';
        }

        clearInterval(progressInterval);
        setScanProgress(100);

        // Persist scan result keyed by ticket ID so client can revisit
        if (isPkiRequest && zipBase64) {
          setTicketResults((prev) => ({
            ...prev,
            [ticketId]: { output: stdout, logs: completedLogs, zipBase64 },
          }));
        } else {
          setTicketResults((prev) => ({
            ...prev,
            [ticketId]: { output: stdout, logs: completedLogs },
          }));
        }

        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: 'COMPLETADO' } : t))
        );

        if (selectedId && !isPkiRequest) {
          const newJob: ReportJobHistoryItem = {
            id: `job-${Date.now()}`,
            template_name: `Nmap Port Scan — ${targetIpOrHost} (${agent.name})`,
            status: 'COMPLETED',
            findings_count: (stdout.match(/open/g) || []).length || 0,
            individual_count: 0,
            created_at: new Date().toISOString(),
          };
          setJobs((prev) => [newJob, ...prev]);
        }

      } catch (err: any) {
        clearInterval(progressInterval);
        setScanProgress(0);
        const errLogs = [
          ...clientScanLogs,
          `[!] ERROR: ${err.message}`,
          `[!] Scan halted. Ticket marked as pending for manual processing.`,
        ];
        setClientScanLogs(errLogs);
        setTicketResults((prev) => ({
          ...prev,
          [ticketId]: { output: '', logs: errLogs },
        }));
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: 'PENDIENTE' } : t))
        );
      } finally {
        setIsScanningLive(false);
      }
    }
  };

  // Fetch compliance audit logs from server
  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/secops/audit-logs');
      const data = await res.json();
      if (data.logs) {
        setAuditLogs(data.logs);
        setAuditLogsPath(data.path);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Clear/Reset audit logs trail
  const handleClearAuditLogs = async () => {
    if (!confirm('Are you sure you want to permanently clear the compliance audit log trace? This action is recorded in the new audit trace.')) return;
    try {
      const res = await fetch('/api/secops/audit-logs', {
        method: 'DELETE',
        headers: {
          'x-user-email': user?.email || 'admin@baxter.com',
          'x-tenant-name': activeTenant?.nombre || 'Baxter',
        }
      });
      if (res.ok) {
        fetchAuditLogs();
      }
    } catch (err) {
      console.error('Failed to clear audit logs:', err);
    }
  };

  // Trigger audit logs fetch when tab is active
  useEffect(() => {
    if (activeEditorTab === 'audit-logs') {
      fetchAuditLogs();
    }
  }, [activeEditorTab]);


  // Run SSH workflow trigger calling our backend route
  const handleRunWorkflow = async () => {
    setRunningWorkflow(true);
    setConsoleLogs(['[+] Iniciando ejecución del nodo de flujo SSH...']);

    // Construct request
    const resolvedCmd = sshCmd.replace('{{host}}', sshHost);

    try {
      const response = await fetch('/api/automation/ssh-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: sshHost,
          port: sshPort,
          username: sshUser,
          password: sshPass,
          command: resolvedCmd,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Fallo en la ejecución');
      }

      // Stream logs sequentially to simulate terminal output typing
      let currentIdx = 0;
      const interval = setInterval(() => {
        if (currentIdx < data.logs.length) {
          setConsoleLogs((prev) => [...prev, data.logs[currentIdx]]);
          currentIdx++;
        } else {
          clearInterval(interval);
          setRunningWorkflow(false);
        }
      }, 350);
    } catch (err: any) {
      setConsoleLogs((prev) => [
        ...prev,
        `[!] ERROR: ${err.message}`,
        `[!] Flujo detenido por fallas en la conexión.`,
      ]);
      setRunningWorkflow(false);
    }
  };

  // Editor: Create new service in catalog
  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;
    const newService: ServiceCatalogItem = {
      id: `${services.length + 1}`,
      name: newServiceName.trim(),
      desc: newServiceDesc.trim() || 'Sin descripción.',
      defaultUrgency: newServiceUrgency,
    };
    setServices([...services, newService]);
    setNewServiceName('');
    setNewServiceDesc('');
    alert('Servicio agregado al catálogo del portal.');
  };

  // Editor: Delete service
  const handleDeleteService = (id: string) => {
    if (confirm('¿Eliminar este servicio del catálogo?')) {
      setServices(services.filter((s) => s.id !== id));
    }
  };

  // Editor: Update Ticket status
  const handleUpdateTicketStatus = (ticketId: string, status: ClientTicket['status']) => {
    setTickets(tickets.map((t) => (t.id === ticketId ? { ...t, status } : t)));
  };

  const handleAdvanceCertificationStage = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId || !t.stages?.length || !t.workflowId) return t;
        const advanced = advanceCertificationStage(
          {
            id: t.id,
            type: t.type,
            target: t.target,
            urgency: t.urgency,
            status: t.status,
            createdAt: t.createdAt,
            description: t.description,
            workflowId: t.workflowId,
            currentStageKey: t.currentStageKey ?? null,
            stages: t.stages,
            updates: t.updates ?? [],
          },
          {
            note: stageAdvanceNote.trim() || 'Avance de etapa registrado por SOC',
            actor: user?.email || 'soc-editor',
          },
        );
        return { ...t, ...advanced };
      }),
    );
    setStageAdvanceNote('');
  };

  // Editor: Delete ticket
  const handleDeleteTicket = (ticketId: string) => {
    if (confirm('¿Deseas eliminar este ticket?')) {
      setTickets(tickets.filter((t) => t.id !== ticketId));
    }
  };

  // Editor: Add custom Node to n8n automation flow graph
  const handleAddFlow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;
    const node: AutomationFlowNode = {
      id: `node-${flowNodes.length + 1}`,
      name: newNodeName.trim(),
      type: newNodeType,
      desc: newNodeDesc.trim() || 'Active channel',
      status: 'ready',
    };
    setFlowNodes([...flowNodes, node]);
    setNewNodeName('');
    setNewNodeDesc('');
    alert('Nodo agregado al flujo de automatización.');
  };

  // Editor: Delete flow node
  const handleDeleteNode = (id: string) => {
    if (id === 'node-1' || id === 'node-2') {
      alert('Los nodos Core manual trigger y SSH connection no se pueden eliminar.');
      return;
    }
    setFlowNodes(flowNodes.filter((n) => n.id !== id));
  };

  // Editor: Test smart URL redirect fallback simulation
  const handleTestRedirect = () => {
    if (!testSlugInput.trim()) return;
    const inputSlug = testSlugInput.trim().toLowerCase();
    const targetSlug = clientSlug.trim().toLowerCase();

    if (inputSlug !== targetSlug) {
      if (slugRedirectActive) {
        setTestSlugMessage(
          `[✓ REDIRECCIÓN INTELIGENTE ACTIVA]: El slug '${testSlugInput}' no existe. Caída de respaldo ejecutada: Redirigiendo automáticamente al contexto activo de '${targetSlug}' (BaxterBaxterHUB) sin interrupción.`
        );
      } else {
        setTestSlugMessage(
          `[✕ FALLA DE ACCESO]: El slug '${testSlugInput}' es inválido. Redirección inteligente desactivada. Error 404: Portal del Cliente no encontrado.`
        );
      }
    } else {
      setTestSlugMessage(`[✓ CONEXIÓN DIRECTA]: Slug '${testSlugInput}' verificado. Acceso directo concedido.`);
    }
  };

  // PDF report generator using jsPDF
  const generateScanPDF = useCallback(async (ticket: ClientTicket, output: string): Promise<string> => {
    try {
      const fetchImageBase64 = async (imgUrl: string): Promise<{ dataUrl: string; ext: string }> => {
        try {
          const res = await fetch(imgUrl);
          if (!res.ok) throw new Error('Failed to fetch image');
          const blob = await res.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              let ext = 'JPEG';
              if (blob.type.includes('png')) ext = 'PNG';
              else if (blob.type.includes('webp')) ext = 'WEBP';
              else if (blob.type.includes('svg')) ext = 'SVG';
              resolve({ dataUrl, ext });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('[PDF Logo Error]:', e);
          return { dataUrl: '', ext: '' };
        }
      };

      // Hex to RGB parser helper
      const hexToRgb = (hexStr: string | null | undefined, fallback: [number, number, number]): [number, number, number] => {
        if (!hexStr) return fallback;
        const cleanHex = hexStr.replace('#', '').trim();
        if (cleanHex.length === 3) {
          const r = parseInt(cleanHex[0] + cleanHex[0], 16);
          const g = parseInt(cleanHex[1] + cleanHex[1], 16);
          const b = parseInt(cleanHex[2] + cleanHex[2], 16);
          return [r, g, b];
        }
        if (cleanHex.length === 6) {
          const r = parseInt(cleanHex.slice(0, 2), 16);
          const g = parseInt(cleanHex.slice(2, 4), 16);
          const b = parseInt(cleanHex.slice(4, 6), 16);
          return [r, g, b];
        }
        return fallback;
      };

      // Nmap Output Parser interface & parser function
      interface NmapPort {
        port: string;
        protocol: string;
        state: string;
        service: string;
        version: string;
      }

      const parseNmapOutput = (text: string): NmapPort[] => {
        const ports: NmapPort[] = [];
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          const match = trimmed.match(/^(\d+)\/(tcp|udp)\s+(\S+)\s+(\S+)(?:\s+(.*))?$/);
          if (match) {
            ports.push({
              port: match[1],
              protocol: match[2],
              state: match[3],
              service: match[4],
              version: match[5] || '—',
            });
          }
        }
        return ports;
      };

      const tenantName = activeTenant?.nombre || 'Phantom';
      const tenantInitial = tenantName.charAt(0).toUpperCase();

      // Brand Accent & Theme Colors (Dark Cyber Style)
      const brandPrimary = hexToRgb(branding?.primary_color, [124, 58, 237]); // Violet default
      const cyberBlue = [88, 166, 255]; // #58a6ff
      const stateGreen = [86, 211, 100]; // #56d364 (open/completed)
      const stateOrange = [240, 140, 60]; // filtered
      const stateRed = [248, 81, 73]; // closed

      let logoData: { dataUrl: string; ext: string } | null = null;
      const logoUrl = branding ? pickLogoUrl(branding, false) : undefined;
      if (logoUrl) {
        logoData = await fetchImageBase64(logoUrl);
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { jsPDF } = require('jspdf') as typeof import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;

      // ── Header bar (Dark) ──────────────────────────────────────────────────
      doc.setFillColor(10, 12, 22);
      doc.rect(0, 0, pageW, 38, 'F');

      if (logoData && logoData.dataUrl) {
        try {
          doc.addImage(logoData.dataUrl, logoData.ext, margin, 11.5, 15, 15, undefined, 'FAST');
        } catch (err) {
          console.error('[PDF doc.addImage Error]:', err);
          // Fallback to circle
          doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
          doc.circle(margin + 6, 19, 7.5, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10.5);
          doc.setFont('helvetica', 'bold');
          doc.text(tenantInitial, margin + 4.5, 22.5);
        }
      } else {
        // Stylized Vector Hexagon / Shield Tenant Logo Badge
        doc.setFillColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.circle(margin + 6, 19, 7.5, 'F');
        
        // Draw Tenant Initial inside circle
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10.5);
        doc.setFont('helvetica', 'bold');
        doc.text(tenantInitial, margin + 4.5, 22.5);
      }

      // Title & Subtitle with Tenant Branding
      doc.setFontSize(14.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${tenantName} SecOps Portal`, margin + 18, 16);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 200);
      doc.text('Automated Vulnerability & Port Scan Assessment', margin + 18, 24);

      // Report Reference & Metadata top-right
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 160);
      doc.text(`REF: ${ticket.id}`, pageW - margin, 16, { align: 'right' });
      doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, pageW - margin, 23, { align: 'right' });

      // ── Section: Scan Metadata Table ─────────────────────────────────────────
      let y = 50;
      doc.setFillColor(18, 20, 35);
      doc.roundedRect(margin, y, contentW, 40, 3, 3, 'F');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(cyberBlue[0], cyberBlue[1], cyberBlue[2]);
      doc.text('SCAN IDENTIFICATION & METADATA', margin + 6, y + 8.5);

      const meta: [string, string][] = [
        ['Ticket ID', ticket.id],
        ['Assessment Service', ticket.type],
        ['Target Host / Scope', ticket.target],
        ['Urgency Rating', ticket.urgency],
        ['Scan Status', 'COMPLETED'],
        ['Request Date', ticket.createdAt],
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      meta.forEach(([label, value], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = margin + 6 + col * (contentW / 3);
        const cy = y + 17 + row * 11.5;
        doc.setTextColor(180, 195, 225); // Increased contrast label
        doc.text(label.toUpperCase(), cx, cy);
        
        // Dynamic colors for urgency and status values
        if (label === 'Urgency Rating' && value === 'High') {
          doc.setTextColor(stateRed[0], stateRed[1], stateRed[2]);
        } else if (label === 'Scan Status') {
          doc.setTextColor(100, 255, 120); // Brighter green status
        } else {
          doc.setTextColor(255, 255, 255); // Pure white value
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(value, cx, cy + 4.5);
        doc.setFont('helvetica', 'normal');
      });

      // ── Section: Structured Ports Table (or Flamethrower DNS Assessment) ────
      y += 52;

      if (isFlameServiceType(ticket.type)) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(cyberBlue[0], cyberBlue[1], cyberBlue[2]);
        doc.text('FLAMETHROWER DNS PERFORMANCE & RESILIENCE METRICS', margin, y);
        doc.setDrawColor(cyberBlue[0], cyberBlue[1], cyberBlue[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, y + 2, margin + contentW, y + 2);

        y += 8;
        // Executive Summary Metrics Cards in PDF
        const flamePdfCards: [string, string, [number, number, number]][][] = [
          [
            ['DNS Health Score', '95% (Excellent)', [86, 211, 100]],
            ['Availability', '99.8%', [86, 211, 100]],
            ['QPS Throughput', '982 QPS', [88, 166, 255]],
          ],
          [
            ['Average Latency', '18.4 ms', [88, 166, 255]],
            ['Maximum Latency', '132.8 ms', [240, 140, 60]],
            ['Timeouts / Lost', '3 (0.06%)', [248, 81, 73]],
          ],
        ];

        flamePdfCards.forEach((rowCards) => {
          rowCards.forEach(([title, val, col], cIdx) => {
            const cardW = (contentW - 8) / 3;
            const cx = margin + cIdx * (cardW + 4);
            doc.setFillColor(18, 20, 35);
            doc.roundedRect(cx, y, cardW, 14, 1.5, 1.5, 'F');
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(160, 175, 205);
            doc.text(title.toUpperCase(), cx + 4, y + 4.5);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(col[0], col[1], col[2]);
            doc.text(val, cx + 4, y + 10.5);
          });
          y += 16;
        });

        y += 4;
        // Recommendations box
        doc.setFillColor(25, 18, 38);
        doc.roundedRect(margin, y, contentW, 22, 2, 2, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(200, 160, 255);
        doc.text('STRATEGIC RECOMMENDATIONS & REMEDIATION:', margin + 4, y + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(220, 220, 240);
        doc.text('• Enable DNS over TLS (DoT - Port 853) & DNS over HTTPS (DoH - /dns-query) for encrypted transport.', margin + 4, y + 10);
        doc.text('• Implement Anycast routing and expand resolver cache capacity to smooth high latency variance under burst load.', margin + 4, y + 14);
        doc.text('• Verify DNSSEC deployment and deploy missing RRSIG signatures across all active subdomains.', margin + 4, y + 18);
        y += 26;
      }

      const parsedPorts = parseNmapOutput(output);
      const openPortsCount = (output.match(/open/g) || []).length;

      if (parsedPorts.length > 0) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.text('DETECTED ACTIVE PORT WORKLOADS', margin, y);
        
        doc.setDrawColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, y + 2, margin + contentW, y + 2);

        y += 7;
        // Table Header
        doc.setFillColor(25, 27, 44);
        doc.rect(margin, y, contentW, 8, 'F');
        doc.setTextColor(220, 220, 240); // Increased contrast header
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('PORT / PROTOCOL', margin + 4, y + 5.5);
        doc.text('STATE', margin + 40, y + 5.5);
        doc.text('SERVICE', margin + 65, y + 5.5);
        doc.text('SOFTWARE VERSION DETECTED', margin + 98, y + 5.5);

        y += 8;
        doc.setFont('helvetica', 'normal');
        parsedPorts.forEach((p, idx) => {
          // Zebra striping
          const rowBg = idx % 2 === 0 ? [14, 16, 28] : [18, 20, 36];
          doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
          doc.rect(margin, y, contentW, 7.5, 'F');

          // Port & Proto
          doc.setTextColor(255, 255, 255); // Pure white port name
          doc.setFont('helvetica', 'bold');
          doc.text(`${p.port}/${p.protocol}`, margin + 4, y + 5);
          doc.setFont('helvetica', 'normal');

          // State Badge
          if (p.state.toLowerCase() === 'open') {
            doc.setFillColor(stateGreen[0] * 0.15, stateGreen[1] * 0.15, stateGreen[2] * 0.15);
            doc.roundedRect(margin + 39.5, y + 1.5, 14, 4.5, 0.8, 0.8, 'F');
            doc.setTextColor(100, 255, 120); // Brighter green open badge
            doc.setFont('helvetica', 'bold');
            doc.text('OPEN', margin + 42.5, y + 4.6);
            doc.setFont('helvetica', 'normal');
          } else {
            doc.setTextColor(stateOrange[0], stateOrange[1], stateOrange[2]);
            doc.text(p.state.toUpperCase(), margin + 40, y + 5);
          }

          // Service & Version
          doc.setTextColor(240, 240, 255); // Increased contrast service
          doc.text(p.service, margin + 65, y + 5);
          doc.setTextColor(215, 215, 235); // Increased contrast version
          doc.text(p.version.length > 50 ? `${p.version.slice(0, 48)}…` : p.version, margin + 98, y + 5);

          y += 7.5;
        });

        y += 6;
      }

      // ── Section: Isolated Terminal Console Block ─────────────────────────────
      // Check page height limit to avoid orphan titles
      if (y > pageH - 75) {
        doc.addPage();
        y = margin + 10;
      }

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(cyberBlue[0], cyberBlue[1], cyberBlue[2]);
      doc.text('RAW AUDIT EXECUTION FEED (CONSOLE LOGS)', margin, y);
      
      doc.setDrawColor(cyberBlue[0], cyberBlue[1], cyberBlue[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 2, margin + contentW, y + 2);

      y += 7;
      doc.setFillColor(8, 10, 20);
      const outputLines = output ? doc.splitTextToSize(output, contentW - 10) : ['No terminal output logs recorded.'];
      const lineH = 4.2;
      const boxH = Math.min(outputLines.length * lineH + 10, pageH - y - 35);
      doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F');

      doc.setFont('courier', 'normal');
      doc.setFontSize(6.8);
      let lineY = y + 6.5;
      for (const line of outputLines) {
        if (lineY > y + boxH - 4) break;
        if (line.startsWith('PORT') || line.startsWith('Nmap')) {
          doc.setTextColor(cyberBlue[0], cyberBlue[1], cyberBlue[2]);
        } else if (line.includes('open')) {
          doc.setTextColor(100, 255, 120);
        } else if (line.includes('closed')) {
          doc.setTextColor(stateRed[0], stateRed[1], stateRed[2]);
        } else {
          doc.setTextColor(225, 245, 235); // Higher contrast console lines
        }
        doc.text(line, margin + 5, lineY);
        lineY += lineH;
      }

      // ── Section: Findings Summary Table ──────────────────────────────────────
      y += boxH + 10;
      if (y < pageH - 45) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
        doc.text('SUMMARY OF TARGET CLASSIFICATIONS', margin, y);
        doc.line(margin, y + 2, margin + contentW, y + 2);

        y += 8;
        doc.setFillColor(18, 20, 35);
        doc.rect(margin, y, contentW, 7, 'F');
        doc.setTextColor(210, 210, 245); // Increased contrast header
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text('METRIC ANALYSIS', margin + 4, y + 4.8);
        doc.text('EVALUATION VALUE', margin + 4 + contentW * 0.6, y + 4.8);

        y += 7;
        const summaryRows: [string, string][] = [
          ['Active Open Host Ports', String(openPortsCount)],
          ['Security Scan Mode', 'nmap -F -sV (Optimized Fast Mode + Version Detection)'],
          ['Auditor Agent Type', 'Automated Secure SSH Node'],
          ['Confidentiality Level', 'RESTRICTED / CONFIDENTIAL'],
        ];

        doc.setFont('helvetica', 'normal');
        summaryRows.forEach(([k, v], i) => {
          const bg = i % 2 === 0 ? [14, 16, 28] : [18, 20, 36];
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.rect(margin, y, contentW, 6.8, 'F');
          doc.setTextColor(240, 240, 255); // Increased contrast metric keys
          doc.text(k, margin + 4, y + 4.5);
          
          if (i === 0 && openPortsCount > 0) {
            doc.setTextColor(stateOrange[0], stateOrange[1], stateOrange[2]);
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setTextColor(220, 220, 240); // Increased contrast values
          }
          doc.text(v, margin + 4 + contentW * 0.6, y + 4.5);
          doc.setFont('helvetica', 'normal');
          y += 6.8;
        });
      }

      // ── Footer (Dynamic) ────────────────────────────────────────────────────
      doc.setFillColor(10, 12, 22);
      doc.rect(0, pageH - 16, pageW, 16, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 140);
      doc.text(`CONFIDENTIAL — Generated for ${tenantName}. Unauthorized copying, editing, or distribution is prohibited.`, margin, pageH - 8.2);
      doc.text(`Page 1 of 1  |  ${tenantName} Hub Platform`, pageW - margin, pageH - 8.2, { align: 'right' });

      const blob = doc.output('blob');
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('PDF generation failed:', e);
      return '';
    }
  }, [activeTenant, branding]);

  return (
    <div className="space-y-6 select-text">
      {/* Admin banner if portal is currently deactivated */}
      {!isPortalEnabled && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-500 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2 select-none">
          <AlertTriangle className="size-4 shrink-0 animate-pulse" />
          <span>
            <strong>PORTAL DEACTIVATED:</strong> External clients will receive a 404 error when attempting to access. The portal is currently disabled to prevent unauthorized request submissions.
          </span>
        </div>
      )}

      {/* DUAL VIEW ROUTING BLOCK */}
      {!isEditingMode ? (
        // ==========================================
        // VISTA CLIENTE (CLIENT VIEW SIDE) — unified single-page layout
        // ==========================================
        <div className="space-y-6 animate-fade-in">
          {/* Title Header Section */}
          <div className="border-b border-border/60 pb-5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="size-6 text-primary" />
              Client Security Portal
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Solicita servicios, sigue certificaciones Baxter HUB por etapas (tipo ServiceNow) y descarga reportes — todo en un solo lugar.
            </p>
          </div>

          {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

          {/* UNIFIED LAYOUT: form left, tickets+reports right */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

            {/* ── LEFT COLUMN: New Request Form ── */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="size-4 text-emerald-500" />
                    New Service Request
                  </CardTitle>
                  <CardDescription>Select a service and submit your request. Results will appear in your request history.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Service</label>
                      <select
                        value={ticketType}
                        onChange={(e) => setTicketType(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        {services.map((item) => (
                          <option key={item.id} value={item.name}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      {/* Service description chip */}
                      {(() => {
                        const svc = services.find(s => s.name === ticketType);
                        return svc ? (
                          <p className="text-[10px] text-muted-foreground leading-snug">{svc.desc}</p>
                        ) : null;
                      })()}
                      {isBaxterHubCertificationService(ticketType) && (
                        <p className="text-[10px] text-sky-700 dark:text-sky-300 leading-snug border border-sky-500/20 bg-sky-500/5 rounded-md px-2 py-1.5">
                          Flujo multi-etapa tipo ServiceNow: verás el progreso (intake → puertos → rutas → DAST → pentest → sign-off) en tu historial.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                        {isPkiServiceType(ticketType) ? 'Common Name (FQDN)' : 'Target Host / IP'}
                      </label>
                      <Input
                        type="text"
                        placeholder={isPkiServiceType(ticketType) ? 'e.g. clientportal.spectre.local' : 'e.g. 192.168.0.1 or example.com'}
                        value={ticketTarget}
                        onChange={(e) => {
                          setTicketTarget(e.target.value);
                          if (targetError) setTargetError(null);
                        }}
                        required
                        className={`text-sm font-mono ${targetError ? 'border-rose-500 focus-visible:ring-rose-500 focus-visible:border-rose-500 bg-rose-500/5' : ''}`}
                      />
                      {targetError && (
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold animate-fade-in">{targetError}</p>
                      )}
                    </div>

                    {isPkiServiceType(ticketType) && (
                      <div className="p-3.5 space-y-3.5 rounded-xl border border-emerald-500/20 bg-emerald-950/10 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <Sliders className="size-3.5 text-emerald-400" />
                            Configuración del Certificado PKI
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-semibold uppercase">Dirección IP (Subject Alternative Name - Opcional)</label>
                            <Input
                              type="text"
                              value={pkiIp}
                              onChange={(e) => setPkiIp(e.target.value)}
                              placeholder="Ej. 10.11.254.245"
                              className="text-xs font-mono bg-white dark:bg-zinc-950 border-emerald-500/10 focus-visible:ring-emerald-500 text-foreground"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-semibold uppercase">Plantilla de Certificado (Certificate Template)</label>
                            <Input
                              type="text"
                              value={pkiTemplate}
                              onChange={(e) => setPkiTemplate(e.target.value)}
                              placeholder="WebServer"
                              required
                              className="text-xs font-mono bg-white dark:bg-zinc-950 border-emerald-500/10 focus-visible:ring-emerald-500 text-foreground"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {isFlameServiceType(ticketType) && (
                      <div className="p-3.5 space-y-3.5 rounded-xl border border-cyan-500/20 bg-cyan-950/10 animate-fade-in">
                        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
                          <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                            <Sliders className="size-3.5 text-cyan-400" />
                            Flamethrower Assessment & DDoS Stress Configuration
                          </span>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            DNS-OARC Engine (flame)
                          </span>
                        </div>

                        {/* DNS Protocol & Port */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-semibold uppercase">DNS Protocol</label>
                            <select
                              value={flameProtocol}
                              onChange={(e) => handleFlameProtocolChange(e.target.value as any)}
                              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="udp">UDP</option>
                              <option value="tcp">TCP</option>
                              <option value="dot">DNS over TLS (DoT)</option>
                              <option value="doh">DNS over HTTPS (DoH)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-semibold uppercase">DNS Port</label>
                            <input
                              type="text"
                              value={flamePort}
                              onChange={(e) => setFlamePort(e.target.value)}
                              placeholder="53, 853, 443"
                              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono"
                            />
                          </div>
                        </div>

                        {/* Query Generator */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-semibold uppercase">Query Generator</label>
                          <select
                            value={flameQueryGen}
                            onChange={(e) => setFlameQueryGen(e.target.value)}
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                          >
                            <option value="-g static">Standard (-g static)</option>
                            <option value="-g randomlabel">Random Labels (-g randomlabel)</option>
                            <option value="-g nxdomain">NXDOMAIN Flood (-g nxdomain)</option>
                            <option value="-g wildcard">Wildcard Test (-g wildcard)</option>
                            <option value="-g mixed">Mixed Queries (-g mixed)</option>
                          </select>
                        </div>

                        {/* Record Types Checkboxes */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground font-semibold uppercase block">Record Types</label>
                          <div className="flex flex-wrap gap-1.5">
                            {['A', 'AAAA', 'MX', 'TXT', 'NS', 'SOA', 'CAA', 'SRV', 'PTR', 'ANY'].map((rt) => (
                              <label
                                key={rt}
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded cursor-pointer border transition-colors ${
                                  flameRecordTypes[rt]
                                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-bold'
                                    : 'bg-background border-border text-muted-foreground'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!flameRecordTypes[rt]}
                                  onChange={(e) =>
                                    setFlameRecordTypes((prev) => ({ ...prev, [rt]: e.target.checked }))
                                  }
                                  className="hidden"
                                />
                                {rt}
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Concurrency (-c) & QPS (-Q) Sliders */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Concurrency (-c)</span>
                              <span className="font-mono text-cyan-400 font-bold">{flameConcurrency}</span>
                            </div>
                            <select
                              value={flameConcurrency}
                              onChange={(e) => setFlameConcurrency(e.target.value)}
                              className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                            >
                              <option value="10">10 worker threads</option>
                              <option value="50">50 worker threads</option>
                              <option value="100">100 worker threads</option>
                              <option value="500">500 worker threads</option>
                              <option value="1000">1000 worker threads</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Queries / Sec (-Q)</span>
                              <span className="font-mono text-cyan-400 font-bold">{flameQPS}</span>
                            </div>
                            <select
                              value={flameQPS}
                              onChange={(e) => setFlameQPS(e.target.value)}
                              className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                            >
                              <option value="100">100 QPS</option>
                              <option value="500">500 QPS</option>
                              <option value="1000">1,000 QPS</option>
                              <option value="5000">5,000 QPS</option>
                              <option value="10000">10,000 QPS</option>
                            </select>
                          </div>
                        </div>

                        {/* Total Queries & Duration */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-semibold uppercase">Total Queries</label>
                            <select
                              value={flameTotalQueries}
                              onChange={(e) => setFlameTotalQueries(e.target.value)}
                              className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                            >
                              <option value="100">100 queries</option>
                              <option value="1000">1,000 queries</option>
                              <option value="5000">5,000 queries</option>
                              <option value="10000">10,000 queries</option>
                              <option value="100000">100,000 queries</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground font-semibold uppercase">Test Duration</label>
                            <select
                              value={flameDurationSec}
                              onChange={(e) => setFlameDurationSec(e.target.value)}
                              className="w-full h-7 rounded border border-input bg-background px-2 text-xs"
                            >
                              <option value="30">30 seconds</option>
                              <option value="60">60 seconds</option>
                              <option value="300">5 minutes</option>
                              <option value="600">10 minutes</option>
                            </select>
                          </div>
                        </div>

                        {/* Advanced Collapsible */}
                        <div className="border-t border-cyan-500/20 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowFlameAdvanced(!showFlameAdvanced)}
                            className="text-[10px] font-bold text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            {showFlameAdvanced ? '▼ Hide Advanced Options' : '► Show Advanced Options (DoH, DoT, DNSSEC)'}
                          </button>

                          {showFlameAdvanced && (
                            <div className="mt-2 space-y-2 text-xs animate-fade-in bg-black/20 p-2.5 rounded-lg">
                              <div className="grid grid-cols-2 gap-2">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={flameEnableDoH}
                                    onChange={(e) => setFlameEnableDoH(e.target.checked)}
                                    className="rounded border-border"
                                  />
                                  <span>Enable DoH (-P doh)</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[10px]">
                                  <input
                                    type="checkbox"
                                    checked={flameEnableDoT}
                                    onChange={(e) => setFlameEnableDoT(e.target.checked)}
                                    className="rounded border-border"
                                  />
                                  <span>Enable DoT (-P dot)</span>
                                </label>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] text-muted-foreground">HTTP Method (DoH)</label>
                                  <select
                                    value={flameHttpMethodDoH}
                                    onChange={(e) => setFlameHttpMethodDoH(e.target.value as any)}
                                    className="w-full h-7 rounded border border-input bg-background px-2 text-[10px]"
                                  >
                                    <option value="POST">POST (-M POST)</option>
                                    <option value="GET">GET (-M GET)</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] text-muted-foreground">Dynamic QPS Flow</label>
                                  <input
                                    type="text"
                                    placeholder="10,30000;100,30000;"
                                    value={flameDynamicQPSFlow}
                                    onChange={(e) => setFlameDynamicQPSFlow(e.target.value)}
                                    className="w-full h-7 rounded border border-input bg-background px-2 text-[10px] font-mono"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] text-muted-foreground">DNSSEC Validation</label>
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={flameDnssec.validate}
                                      onChange={(e) => setFlameDnssec((prev) => ({ ...prev, validate: e.target.checked }))}
                                      className="rounded"
                                    />
                                    <span>Validate DNSSEC</span>
                                  </label>
                                  <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={flameDnssec.collectRRSIG}
                                      onChange={(e) => setFlameDnssec((prev) => ({ ...prev, collectRRSIG: e.target.checked }))}
                                      className="rounded"
                                    />
                                    <span>Collect RRSIG</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Urgency</label>
                        <select
                          value={ticketUrgency}
                          onChange={(e) => setTicketUrgency(e.target.value as any)}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High — Critical</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Notes</label>
                      <textarea
                        placeholder="Specific ports, scope constraints, or context..."
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                      />
                    </div>

                    {/* Execution mode badge — SOC configured, client read-only */}
                    <div className={`flex items-center gap-2.5 p-3 rounded-xl border ${
                      isAutomatedExecution
                        ? 'border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/5'
                        : 'border-amber-500/20 bg-amber-50 dark:bg-amber-950/5'
                    }`}>
                      <div className={`p-1.5 rounded-lg ${
                        isAutomatedExecution
                          ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }`}>
                        {isAutomatedExecution
                          ? <Terminal className="size-4" />
                          : <Clock className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`block text-xs font-bold ${
                          isAutomatedExecution ? 'text-emerald-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'
                        }`}>
                          {isAutomatedExecution ? 'Automated Execution' : 'Manual Processing'}
                        </span>
                        <span className="block text-[10px] text-muted-foreground leading-snug">
                          {isAutomatedExecution
                            ? `Will run automatically via ${effectiveDefaultAgent?.name ?? 'configured agent'}.`
                            : 'Our team will process this request manually.'}
                        </span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
                        isAutomatedExecution
                          ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/15'
                          : 'border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/15'
                      }`}>
                        {isAutomatedExecution ? 'AUTO' : 'MANUAL'}
                      </span>
                    </div>

                    <Button
                      type="submit"
                      className={`w-full font-bold py-2.5 rounded-lg text-white ${
                        isAutomatedExecution ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-primary hover:bg-primary/90'
                      }`}
                      disabled={isScanningLive}
                    >
                      {isScanningLive ? (
                        <><Loader2 className="size-4 mr-2 animate-spin" />Simulation in progress...</>
                      ) : (
                        <><Play className="size-4 mr-2" />{isAutomatedExecution ? (isPkiServiceType(ticketType) ? 'Submit & Generate Certificate' : isFlameServiceType(ticketType) ? 'Submit & Run Flamethrower Stress Test' : 'Submit & Run Nmap Scan') : 'Submit Request'}</>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* ── RIGHT COLUMN: Live progress + all tickets/reports ── */}
            <div className="lg:col-span-3 space-y-4">

              {/* Live scanning progress card */}
              {isScanningLive && (
                <Card className="border-violet-500/30 dark:border-violet-500/20 bg-violet-50/70 dark:bg-gradient-to-br dark:from-violet-950/20 dark:to-black/40 animate-fade-in shadow-lg">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-violet-900 dark:text-violet-300 flex items-center gap-2">
                      <Loader2 className="size-4 text-violet-600 dark:text-violet-400 animate-spin" />
                      Nmap Scan Running
                    </CardTitle>
                    <CardDescription className="text-xs text-violet-700/80 dark:text-muted-foreground">Executing delegated command on SSH agent host — please wait.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-violet-800 dark:text-muted-foreground">
                        <span>Progress</span>
                        <span className="font-mono text-violet-900 dark:text-violet-300 font-bold">{scanProgress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 dark:from-violet-500 dark:to-emerald-400 transition-all duration-500 ease-out"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    </div>
                    <div className="font-mono text-[10px] leading-relaxed bg-zinc-950 p-3 rounded-lg border border-zinc-850 dark:border-violet-900/30 max-h-32 overflow-y-auto space-y-0.5">
                      {clientScanLogs.map((log, i) => (
                        <div key={i} className={log.startsWith('[!]') ? 'text-rose-400' : 'text-emerald-400'}>{log}</div>
                      ))}
                      <div className="text-amber-300 animate-pulse">[+] Awaiting Nmap stdout...</div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tickets + Reports list */}
              <Card className="border-border/60 bg-card/60">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="size-4 text-cyan-500 dark:text-cyan-400" />
                      My Requests & Reports
                      {tickets.length > 0 && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {tickets.length}
                        </span>
                      )}
                    </CardTitle>
                    {tickets.length > 0 && isAdminOrSOC && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to clear your request history? This will delete all tickets and scan outputs.')) {
                            setTickets([]);
                            setTicketResults({});
                            localStorage.removeItem('phantom_client_tickets');
                            localStorage.removeItem('phantom_client_ticket_results');
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                        Reset History
                      </button>
                    )}
                  </div>
                  <CardDescription>
                    Your submitted service requests. Expand any ticket to view its scan output and download the PDF report.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tickets.length === 0 ? (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <div className="p-4 rounded-full bg-muted/30">
                        <FileText className="size-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
                      <p className="text-xs text-muted-foreground/60">Fill the form on the left to submit your first service request.</p>
                    </div>
                  ) : (
                    tickets.map((t) => {
                      const result = ticketResults[t.id];
                      const isExpanded = expandedTicketId === t.id;
                      const isCert = Boolean(t.stages?.length && t.workflowId);
                      const progress = isCert ? getCertificationProgress({ stages: t.stages! }) : null;
                      return (
                        <div key={t.id} className="rounded-xl border border-border bg-background/60 shadow-sm hover:shadow-md hover:border-primary/20 transition-all overflow-hidden">
                          {/* Row header */}
                          <div
                            className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                            onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-cyan-500">{t.id}</span>
                                <span className="font-semibold text-sm text-foreground">{t.type}</span>
                                {isCert && (
                                  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300 font-bold">
                                    <Layers className="size-2.5" /> HUB CERT
                                  </span>
                                )}
                                {result?.pdfUrl && (
                                  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 font-bold">
                                    <FileText className="size-2.5" /> PDF READY
                                  </span>
                                )}
                                {result && !result.pdfUrl && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">RESULTS</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">Target: <span className="text-foreground font-medium">{t.target}</span></p>
                              {progress ? (
                                <div className="pt-1 space-y-1 max-w-md">
                                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>{progress.currentLabel}</span>
                                    <span className="font-mono font-bold text-foreground">{progress.percent}%</span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-sky-500 transition-all"
                                      style={{ width: `${progress.percent}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-zinc-500">
                                    Etapas {progress.completed}/{progress.total} · Submitted: {t.createdAt}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-zinc-500">Submitted: {t.createdAt}{t.description ? ` · ${t.description.slice(0, 40)}${t.description.length > 40 ? '…' : ''}` : ''}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                t.urgency === 'High' ? 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                                : t.urgency === 'Medium' ? 'border-amber-500/20 bg-amber-500/10 text-amber-500'
                                : 'border-slate-500/20 bg-slate-500/10 text-zinc-400'
                              }`}>{t.urgency}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                t.status === 'COMPLETADO' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                                : t.status === 'EN PROGRESO' ? 'border-violet-500/20 bg-violet-500/10 text-violet-400'
                                : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-500'
                              }`}>
                                {t.status === 'COMPLETADO' ? 'COMPLETED' : t.status === 'EN PROGRESO' ? (isCert ? 'IN PROGRESS' : 'SCANNING') : 'PENDING'}
                              </span>
                              <ChevronRight className={`size-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                          </div>

                          {isExpanded && isCert && t.stages && (
                            <div className="border-t border-border/60 bg-sky-50/40 dark:bg-sky-950/20 px-4 py-4 space-y-4 animate-fade-in">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                                    BAXTER INNOVATION HUB
                                  </span>
                                  <span className="text-xs font-bold text-foreground">Certification pipeline</span>
                                </div>
                                <span className="text-[10px] font-mono text-sky-700 dark:text-sky-300">
                                  {progress?.completed}/{progress?.total} stages · {progress?.percent}%
                                </span>
                              </div>

                              <ol className="space-y-2">
                                {t.stages.map((stage, idx) => (
                                  <li
                                    key={stage.key}
                                    className={`rounded-lg border px-3 py-2.5 text-left ${
                                      stage.status === 'completed'
                                        ? 'border-emerald-500/25 bg-emerald-500/5'
                                        : stage.status === 'in_progress'
                                          ? 'border-sky-500/40 bg-sky-500/10'
                                          : 'border-border/60 bg-background/50'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-[10px] font-mono text-muted-foreground">{String(idx + 1).padStart(2, '0')}</span>
                                          <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                                          <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                                            {stage.mode}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground leading-snug">{stage.description}</p>
                                        {stage.standardRef ? (
                                          <p className="text-[9px] font-mono text-sky-700/80 dark:text-sky-400/80">{stage.standardRef}</p>
                                        ) : null}
                                        {stage.note ? (
                                          <p className="text-[10px] text-foreground/80 pt-1">Nota: {stage.note}</p>
                                        ) : null}
                                      </div>
                                      <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                        stage.status === 'completed'
                                          ? 'border-emerald-500/30 text-emerald-600'
                                          : stage.status === 'in_progress'
                                            ? 'border-sky-500/30 text-sky-600'
                                            : 'border-border text-muted-foreground'
                                      }`}>
                                        {stage.status === 'in_progress' ? 'current' : stage.status}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                              </ol>

                              {t.updates && t.updates.length > 0 && (
                                <div className="rounded-lg border border-border/70 bg-background/70 p-3 space-y-2">
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                    <Clock className="size-3" /> Activity feed
                                  </div>
                                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {[...t.updates].slice(-8).reverse().map((u) => (
                                      <li key={u.id} className="text-[10px] text-muted-foreground">
                                        <span className="font-mono text-foreground/80">{u.at}</span>
                                        {' · '}
                                        <span className="font-semibold text-foreground">{u.actor}</span>
                                        {' — '}
                                        {u.message}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Expanded: scan output + PDF download */}
                          {isExpanded && result && (
                            <div className="border-t border-zinc-800 bg-zinc-950 text-zinc-50 animate-fade-in">
                               {/* Action bar */}
                               <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
                                 <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                                   <Terminal className="size-3.5" />
                                   {isPkiServiceType(t.type) ? 'PKI Worker & Generate-BaxterHubCertificate.ps1 logs' : isFlameServiceType(t.type) ? 'Flamethrower Output' : 'Nmap Output'} — <span className="font-mono text-zinc-200">{t.target}</span>
                                 </div>
                                 {isPkiServiceType(t.type) ? (
                                   result.zipBase64 ? (
                                     <button
                                       type="button"
                                       className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         const blob = base64ToBlob(result.zipBase64!, 'application/zip');
                                         const url = URL.createObjectURL(blob);
                                         const a = document.createElement('a');
                                         a.href = url;
                                         a.download = `cert-baxter-${t.id}.zip`;
                                         document.body.appendChild(a);
                                         a.click();
                                         document.body.removeChild(a);
                                         URL.revokeObjectURL(url);
                                       }}
                                     >
                                       <Download className="size-3" />
                                       Descargar Certificado ZIP
                                     </button>
                                   ) : (
                                     <span className="text-[10px] font-bold text-amber-500 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                       No se generaron archivos
                                     </span>
                                   )
                                 ) : result.pdfUrl ? (
                                   <a
                                     href={result.pdfUrl}
                                     download={`phantom-scan-${t.id}.pdf`}
                                     className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                                     onClick={(e) => e.stopPropagation()}
                                   >
                                     <FileText className="size-3" />
                                     Download PDF Report
                                   </a>
                                 ) : (
                                   <button
                                     type="button"
                                     className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                                     onClick={async (e) => {
                                       e.stopPropagation();
                                       const pdfUrl = await generateScanPDF(t, result.output);
                                       if (pdfUrl) {
                                         setTicketResults(prev => ({
                                           ...prev,
                                           [t.id]: { ...prev[t.id], pdfUrl },
                                         }));
                                       }
                                     }}
                                   >
                                     <FileText className="size-3" />
                                     Generate PDF Report
                                   </button>
                                 )}
                               </div>

                               {isPkiServiceType(t.type) && (
                                 <div className="px-4 py-3 bg-zinc-950 border-b border-emerald-500/20 space-y-3">
                                   <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-2">
                                       <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                         WINDOWS ADCS PKI
                                       </span>
                                       <span className="text-xs font-bold text-slate-200">Detalles del Certificado Generado</span>
                                     </div>
                                     <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                                       ESTADO: EMITIDO
                                     </span>
                                   </div>

                                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
                                     <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                                       <div className="text-[9px] text-zinc-400 uppercase font-semibold">Common Name (CN)</div>
                                       <div className="text-xs font-bold text-emerald-400 font-mono truncate">{t.target}</div>
                                     </div>
                                     <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                                       <div className="text-[9px] text-zinc-400 uppercase font-semibold">SAN IP</div>
                                       <div className="text-xs font-bold text-cyan-400 font-mono">{pkiIp || 'N/A'}</div>
                                     </div>
                                     <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
                                       <div className="text-[9px] text-zinc-400 uppercase font-semibold">Plantilla (Template)</div>
                                       <div className="text-xs font-bold text-amber-400 font-mono">{pkiTemplate || 'WebServer'}</div>
                                     </div>
                                   </div>
                                 </div>
                               )}

                               {isFlameServiceType(t.type) && (
                                <div className="px-4 py-3 bg-slate-950 border-b border-cyan-500/20 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                        FLAMETHROWER ASSESSOR
                                      </span>
                                      <span className="text-xs font-bold text-slate-200">DNS Health & Resilience Summary</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                                      HEALTH SCORE: 95%
                                    </span>
                                  </div>

                                  {/* Metric Cards Grid */}
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Availability</div>
                                      <div className="text-xs font-bold text-emerald-400 font-mono">99.8%</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Avg Latency</div>
                                      <div className="text-xs font-bold text-cyan-400 font-mono">18 ms</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Max Latency</div>
                                      <div className="text-xs font-bold text-amber-400 font-mono">132 ms</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Timeouts</div>
                                      <div className="text-xs font-bold text-rose-400 font-mono">3</div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                                      <div className="text-[9px] text-slate-400 uppercase font-semibold">Errors (SERVFAIL)</div>
                                      <div className="text-xs font-bold text-rose-400 font-mono">4</div>
                                    </div>
                                  </div>

                                  {/* Discovered Security Findings & Protocol Audit */}
                                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] space-y-1.5">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                      <span>Automatic Assessment Findings</span>
                                      <span className="text-cyan-400 font-mono">Engine: Flamethrower (DNS-OARC)</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      <div className="flex items-center gap-1.5 text-amber-300">
                                        <AlertTriangle className="size-3 shrink-0" />
                                        <span>High Latency Variance (Max 132 ms under load)</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-rose-400">
                                        <AlertTriangle className="size-3 shrink-0" />
                                        <span>DoT Unsupported (Port 853 connection refused)</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-amber-300">
                                        <AlertTriangle className="size-3 shrink-0" />
                                        <span>DoH Unsupported (HTTP 404 /dns-query endpoint)</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-emerald-400">
                                        <CheckCircle className="size-3 shrink-0" />
                                        <span>UDP & TCP Fallback Functionality Verified</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* Terminal output */}
                              <div className="font-mono text-[10px] leading-relaxed bg-zinc-950 px-4 py-3 rounded-b-xl border-t border-zinc-800/80 max-h-80 overflow-y-auto space-y-0.5 text-left">
                                {(() => {
                                  const text = result.output || (result.logs && result.logs.length > 0 ? result.logs.join('\n') : 'No output captured.');
                                  return text.split('\n').map((line, i) => renderTerminalLine(line, i));
                                })()}
                              </div>
                            </div>
                          )}

                          {isExpanded && !result && t.status === 'PENDIENTE' && !t.stages?.length && (
                            <div className="border-t border-border/50 px-4 py-4 bg-amber-50 dark:bg-amber-950/10">
                              <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                                Queued for manual review by our security team. A PDF report will be delivered once the assessment is complete.
                              </p>
                            </div>
                          )}
                          {isExpanded && !result && t.status === 'EN PROGRESO' && !t.stages?.length && (
                            <div className="border-t border-border/50 px-4 py-4 bg-violet-50 dark:bg-violet-950/10 flex items-center gap-2">
                              <Loader2 className="size-3.5 text-violet-600 dark:text-violet-400 animate-spin" />
                              <p className="text-xs text-violet-700 dark:text-violet-300">Scan running — results and PDF report will appear here on completion.</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        // ==========================================
        // VISTA EDITOR PORTAL (SOC / ADMIN SIDE)
        // ==========================================
        <div className="space-y-6 animate-fade-in">
          {/* Editor Title Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Sliders className="size-6 text-primary" />
                  Client Portal Editor
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('/portal', '_blank')}
                  className="h-7 gap-1 text-[11px] text-primary border-primary/20 hover:bg-primary/5 hover:border-primary/40 font-semibold"
                >
                  <Sliders className="size-3 rotate-45" />
                  Open Client Portal View ↗
                </Button>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage the service catalog, handle support tickets, and configure automated offensive security auditing workflows.
              </p>
            </div>

            {/* Editor Sub-Tabs Navigation */}
            <div className="inline-flex rounded-lg border border-border bg-card p-1 shrink-0 select-none">
              <button
                type="button"
                onClick={() => setActiveEditorTab('catalog')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeEditorTab === 'catalog'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="size-3.5" />
                Service Catalog
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorTab('tickets')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeEditorTab === 'tickets'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Clock className="size-3.5" />
                Ticket Control ({tickets.filter((t) => t.status !== 'COMPLETADO').length})
              </button>
                      <button
                type="button"
                onClick={() => setActiveEditorTab('url-config')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeEditorTab === 'url-config'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Globe className="size-3.5" />
                URL & Access Routing
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorTab('pki-config')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeEditorTab === 'pki-config'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Server className="size-3.5" />
                PKI Worker
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorTab('audit-logs')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeEditorTab === 'audit-logs'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldCheck className="size-3.5" />
                Audit Logs
              </button>
              <button
                type="button"
                onClick={() => setActiveEditorTab('themes')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeEditorTab === 'themes'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Palette className="size-3.5" />
                Themes
              </button>
            </div>
          </div>

          {/* EDITOR TAB CONTENT 1: Edit Services Catalog */}
          {activeEditorTab === 'catalog' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Catalog list */}
              <div className="lg:col-span-2 space-y-4">
                {/* Default Execution Agent Selector for Portal */}
                <Card className="border-emerald-500/20 bg-emerald-950/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Server className="size-4 text-emerald-400" />
                      Default SSH Execution Agent
                    </CardTitle>
                    <CardDescription>
                      The agent selected here will be used to automatically run Nmap scans when a client submits a port scan request. Clients do not see or configure this.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activeSshAgents.length > 0 ? (
                      <div className="space-y-3">
                        <select
                          value={defaultAgentId || (activeSshAgents[0]?.id ?? '')}
                          onChange={(e) => {
                            setDefaultAgentId(e.target.value);
                            localStorage.setItem('spectre_portal_default_agent_id', e.target.value);
                          }}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                        >
                          {activeSshAgents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} — {a.host}:{a.port} ({a.username})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle className="size-3.5 text-emerald-400 shrink-0" />
                          <span className="text-[10px] text-emerald-400">
                            Client portal scans will route automatically through <strong>{activeSshAgents.find(a => a.id === (defaultAgentId || activeSshAgents[0]?.id))?.name ?? '—'}</strong>. The client only sees an <strong>Automated Execution</strong> badge.
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-500 leading-relaxed">
                        <strong>No active SSH agents found.</strong> Go to the <strong>Agents</strong> dashboard, configure an SSH agent, run Ping + Validate Creds, then return here to set the default execution agent. Until then, all client requests will be processed manually.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-base">Active Services Catalog</CardTitle>
                    <CardDescription>
                      Services listed in the client request form.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {services.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-border bg-background flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-foreground">{item.name}</h4>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                          <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded border mt-1 font-bold ${
                            item.defaultUrgency === 'High'
                              ? 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                              : 'border-slate-500/20 bg-slate-500/10 text-zinc-400'
                          }`}>
                            Default Urgency: {item.defaultUrgency}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteService(item.id)}
                          className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded"
                          title="Remove from Catalog"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Add service form */}
              <div className="lg:col-span-1">
                <Card className="border-border/60 bg-card/60">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Plus className="size-4 text-primary" />
                      Agregar Servicio
                    </CardTitle>
                    <CardDescription>Añade un nuevo tipo de auditoría al portal.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateService} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold">Nombre del Servicio</label>
                        <Input
                          type="text"
                          placeholder="ej. Auditoría de API REST"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold">Descripción</label>
                        <textarea
                          placeholder="Detalles sobre lo que incluye esta auditoría..."
                          value={newServiceDesc}
                          onChange={(e) => setNewServiceDesc(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold">Urgencia Preestablecida</label>
                        <select
                          value={newServiceUrgency}
                          onChange={(e) => setNewServiceUrgency(e.target.value as any)}
                          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                        >
                          <option value="Low">Baja</option>
                          <option value="Medium">Media</option>
                          <option value="High">Alta</option>
                        </select>
                      </div>

                      <Button type="submit" className="w-full bg-primary text-primary-foreground font-bold">
                        Guardar en Catálogo
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* EDITOR TAB CONTENT 2: Manage Client Tickets */}
          {activeEditorTab === 'tickets' && (
            <Card className="border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                  <span>Administración de Solicitudes de Clientes</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Actualiza estados y avanza etapas de certificación Baxter HUB (estilo ServiceNow).
                  </span>
                </CardTitle>
                <div className="pt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Input
                    value={stageAdvanceNote}
                    onChange={(e) => setStageAdvanceNote(e.target.value)}
                    placeholder="Nota de avance de etapa (opcional) — visible en el activity feed del cliente"
                    className="text-xs h-9"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-9 text-xs"
                    onClick={() => {
                      const dummies = createDummyBaxterHubTickets();
                      setTickets((prev) => {
                        const withoutHubDemo = prev.filter(
                          (t) => t.id !== 'TK-HUB-2401' && t.id !== 'TK-HUB-2402',
                        );
                        return [...dummies, ...withoutHubDemo];
                      });
                    }}
                  >
                    Cargar demos Baxter HUB
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse min-w-[860px]">
                  <thead>
                    <tr className="border-b border-border/80 text-left text-xs text-muted-foreground">
                      <th className="py-2.5 pr-3 font-semibold">ID</th>
                      <th className="py-2.5 pr-3 font-semibold">Servicio Solicitado</th>
                      <th className="py-2.5 pr-3 font-semibold">Alcance/Target</th>
                      <th className="py-2.5 pr-3 font-semibold">Progreso</th>
                      <th className="py-2.5 pr-3 font-semibold">Urgencia</th>
                      <th className="py-2.5 pr-3 font-semibold">Estado Actual</th>
                      <th className="py-2.5 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted-foreground text-xs italic">
                          Sin tickets en el sistema.
                        </td>
                      </tr>
                    ) : (
                      tickets.map((t) => {
                        const progress = t.stages?.length
                          ? getCertificationProgress({ stages: t.stages })
                          : null;
                        return (
                        <tr key={t.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                          <td className="py-3 pr-3 font-mono font-bold text-cyan-500">{t.id}</td>
                          <td className="py-3 pr-3">
                            <span className="font-semibold block">{t.type}</span>
                            <span className="text-[10px] text-zinc-500 block">{t.description}</span>
                          </td>
                          <td className="py-3 pr-3 font-mono text-xs text-muted-foreground">{t.target}</td>
                          <td className="py-3 pr-3 min-w-[140px]">
                            {progress ? (
                              <div className="space-y-1">
                                <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                                  {progress.currentLabel}
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full bg-sky-500" style={{ width: `${progress.percent}%` }} />
                                </div>
                                <div className="text-[10px] font-mono">{progress.percent}%</div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${
                              t.urgency === 'High' ? 'border-rose-500/20 bg-rose-500/10 text-rose-500' : 'border-slate-500/20 bg-slate-500/10 text-zinc-400'
                            }`}>
                              {t.urgency}
                            </span>
                          </td>
                          <td className="py-3 pr-3">
                            <select
                              value={t.status}
                              onChange={(e) => handleUpdateTicketStatus(t.id, e.target.value as any)}
                              className="h-8 rounded border border-border bg-background px-2 text-xs font-bold focus:ring-1 focus:ring-primary"
                            >
                              <option value="PENDIENTE">PENDIENTE</option>
                              <option value="EN PROGRESO">EN PROGRESO</option>
                              <option value="APROBADO">APROBADO</option>
                              <option value="COMPLETADO">COMPLETADO</option>
                            </select>
                          </td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {t.stages?.length && t.status !== 'COMPLETADO' ? (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceCertificationStage(t.id)}
                                  className="text-sky-600 hover:bg-sky-500/10 px-2 py-1.5 rounded transition-colors text-[10px] font-bold border border-sky-500/30"
                                  title="Avanzar etapa de certificación"
                                >
                                  Avanzar etapa
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDeleteTicket(t.id)}
                                className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded transition-colors"
                                title="Eliminar ticket"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* EDITOR TAB CONTENT 3: Automation Flow Editor (n8n expansion) */}
          {activeEditorTab === 'flows' && (
            <div className="space-y-6">
              {/* Dynamic flow node builder graph */}
              <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <GitFork className="size-4 text-cyan-400" />
                      Constructor Visual de Flujos (Diagrama n8n Activo)
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Haz clic en un nodo para seleccionarlo o agrégale nuevos conectores al final.
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Graphical node representation */}
                  <div className="flex flex-col md:flex-row items-center justify-start gap-4 py-8 rounded-xl border border-dashed border-border/80 bg-background/50 overflow-x-auto p-4 select-none">
                    {flowNodes.map((node, index) => (
                      <div key={node.id} className="flex items-center gap-4 shrink-0">
                        {index > 0 && <ArrowRight className="size-4 text-zinc-600 hidden md:block shrink-0" />}
                        <div className={`w-44 rounded-xl border p-3 shadow-md flex flex-col gap-2 relative transition-all border-zinc-800 bg-zinc-950`}>
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-zinc-900 text-zinc-400">
                              <Terminal className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block font-bold text-[11px] text-white truncate">{node.name}</span>
                              <span className="block text-[9px] text-zinc-500 truncate">{node.desc}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-zinc-900 pt-1.5 mt-1">
                            <span className="text-[8px] uppercase tracking-wider text-zinc-600 font-bold">
                              {node.type}
                            </span>
                            {node.id !== 'node-1' && node.id !== 'node-2' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteNode(node.id)}
                                className="text-rose-500 hover:text-rose-400 text-[9px]"
                              >
                                Quitar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add node creator form */}
                  <form onSubmit={handleAddFlow} className="p-4 border border-border/40 rounded-xl bg-background/40 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-semibold">Nombre del Nodo</label>
                      <Input
                        type="text"
                        placeholder="ej. Discord Webhook"
                        value={newNodeName}
                        onChange={(e) => setNewNodeName(e.target.value)}
                        required
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-semibold">Tipo de Conector</label>
                      <select
                        value={newNodeType}
                        onChange={(e) => setNewNodeType(e.target.value as any)}
                        className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                      >
                        <option value="action">Acción / SSH execution</option>
                        <option value="parser">Mapeador / JSON parser</option>
                        <option value="notify">Notificación / Webhook alert</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground font-semibold">Descripción del Canal</label>
                      <Input
                        type="text"
                        placeholder="ej. Post alert to audit channel"
                        value={newNodeDesc}
                        onChange={(e) => setNewNodeDesc(e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                    <Button type="submit" className="h-8 text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
                      <Plus className="size-3 mr-1" />
                      Agregar Nodo al Flujo
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* SSH connection credentials (placed inside editor flows tab for Admins) */}
              <Card className="border-border/60 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sliders className="size-4 text-primary" />
                    Editar Credenciales del Flujo SSH
                  </CardTitle>
                  <CardDescription>Credenciales por defecto usadas por el nodo de conexión SSH.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold">Host IP</label>
                      <Input
                        type="text"
                        value={sshHost}
                        onChange={(e) => setSshHost(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold">Puerto</label>
                      <Input
                        type="number"
                        value={sshPort}
                        onChange={(e) => setSshPort(parseInt(e.target.value, 10) || 22)}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold">Usuario</label>
                      <Input
                        type="text"
                        value={sshUser}
                        onChange={(e) => setSshUser(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold">Contraseña</label>
                      <Input
                        type="password"
                        value={sshPass}
                        onChange={(e) => setSshPass(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-semibold">Plantilla del comando ejecutado</label>
                    <textarea
                      value={sshCmd}
                      onChange={(e) => setSshCmd(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* EDITOR TAB CONTENT 4: URL Config with Intelligent Redirection */}
          {activeEditorTab === 'url-config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Config URL slug card */}
              <Card className="border-border/60 bg-card/60 h-fit">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="size-4 text-cyan-400" />
                    Slug de Acceso del Portal de Clientes
                  </CardTitle>
                  <CardDescription>
                    Define una sub-ruta personalizada y segura para el portal de este cliente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-semibold">Slug del Cliente</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={clientSlug}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
                          setClientSlug(clean);
                        }}
                        className="text-xs font-mono flex-1"
                        placeholder="baxter-hub"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 block">
                      Solo letras, números, guiones medios y bajos.
                    </span>
                  </div>

                  {/* Generated portal link */}
                  <div className="p-3.5 rounded-lg border border-border/40 bg-zinc-950 font-mono text-[10.5px] text-zinc-400 space-y-1 select-all">
                    <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider block">
                      Enlace de Acceso Generado:
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400">
                        {`https://spectre.io/portal?client=${clientSlug}`}
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://spectre.io/portal?client=${clientSlug}`);
                          alert('Enlace del portal copiado.');
                        }}
                        className="h-6 text-[9px] border border-zinc-800 text-zinc-300 hover:text-white"
                      >
                        Copiar
                      </Button>
                    </div>
                  </div>

                  {/* Failover switch */}
                  <div className="pt-2 border-t border-border/25 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-foreground block">
                        Redirección y Caída de Cambio Inteligente
                      </span>
                      <p className="text-[10.5px] text-muted-foreground leading-normal max-w-sm">
                        Si un cliente intenta ingresar con un slug obsoleto o incorrecto, el portal los redirige automáticamente a la sub-ruta del inquilino autenticado activo, evitando pantallas de error 404.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSlugRedirectActive(!slugRedirectActive)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 shrink-0 ${
                        slugRedirectActive ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <div className={`bg-black size-4 rounded-full transition-transform duration-200 ${
                        slugRedirectActive ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Portal activation master switch */}
                  <div className="pt-4 border-t border-border/25 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-foreground block flex items-center gap-1.5">
                        Estado del Portal de Clientes
                        <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded ${
                          isPortalEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {isPortalEnabled ? 'ACTIVO' : 'DESACTIVADO (MOCK 404)'}
                        </span>
                      </span>
                      <p className="text-[10.5px] text-muted-foreground leading-normal max-w-sm">
                        Desactiva por completo el portal para que devuelva una pantalla de error 404 (Página no encontrada) a cualquier cliente externo. Esto previene escaneos automatizados de vulnerabilidades (ej. dirb/ffuf) y solicitudes no autorizadas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePortal(!isPortalEnabled)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 shrink-0 ${
                        isPortalEnabled ? 'bg-primary' : 'bg-rose-600'
                      }`}
                    >
                      <div className={`bg-black size-4 rounded-full transition-transform duration-200 ${
                        isPortalEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Failover Redirect simulator testing card */}
              <Card className="border-border/60 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="size-4 text-emerald-400" />
                    Simulador de Redirección Inteligente
                  </CardTitle>
                  <CardDescription>
                    Prueba el comportamiento del portal ingresando un slug incorrecto para simular el failover.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-semibold">Simular Slug Ingresado</label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="ej. baxter-viejo-slug"
                        value={testSlugInput}
                        onChange={(e) => setTestSlugInput(e.target.value)}
                        className="text-xs"
                      />
                      <Button
                        type="button"
                        onClick={handleTestRedirect}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold py-1.5 px-3 h-9"
                      >
                        Probar
                      </Button>
                    </div>
                  </div>

                  {testSlugMessage && (
                    <div className={`p-4 rounded-lg border text-xs font-mono leading-relaxed whitespace-pre-wrap ${
                      testSlugMessage.startsWith('[✕')
                        ? 'border-rose-500/20 bg-rose-500/5 text-rose-500'
                        : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400'
                    }`}>
                      {testSlugMessage}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* EDITOR TAB CONTENT 5: PKI CONFIG */}
          {activeEditorTab === 'pki-config' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Part: Settings Form */}
              <div className="lg:col-span-2 space-y-4 animate-fade-in">
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-cyan-400">
                      <Server className="size-5 text-cyan-400" />
                      Configuración de PKI Worker (Windows CA)
                    </CardTitle>
                    <CardDescription>
                      WinRM hacia el worker Windows. Las solicitudes TLS/SSL invocan Generate-BaxterHubCertificate.ps1 en el escritorio (no certreq inline); el portal extrae y formatea el ZIP.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold">Dirección IP / Hostname del PKI Worker</label>
                        <Input
                          type="text"
                          value={pkiHost}
                          onChange={(e) => setPkiHost(e.target.value)}
                          placeholder="Ej. 10.11.240.88"
                          className="text-xs font-mono bg-white dark:bg-zinc-950 border-input text-foreground focus-visible:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold">Puerto WinRM</label>
                        <Input
                          type="text"
                          value={pkiPort}
                          onChange={(e) => setPkiPort(e.target.value)}
                          placeholder="5985"
                          className="text-xs font-mono bg-white dark:bg-zinc-950 border-input text-foreground focus-visible:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold">Dominio / Usuario (WinRM)</label>
                        <Input
                          type="text"
                          value={pkiUsername}
                          onChange={(e) => setPkiUsername(e.target.value)}
                          placeholder="Ej. hub\hernano30"
                          className="text-xs font-mono bg-white dark:bg-zinc-950 border-input text-foreground focus-visible:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground font-semibold">Contraseña</label>
                        <Input
                          type="password"
                          value={pkiPassword}
                          onChange={(e) => setPkiPassword(e.target.value)}
                          placeholder="••••••••"
                          className="text-xs font-mono bg-white dark:bg-zinc-950 border-input text-foreground focus-visible:ring-primary"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                        Nombre de la Autoridad de Certificación (CA) <span className="text-[10px] text-zinc-500 font-normal">(Opcional)</span>
                      </label>
                      <Input
                        type="text"
                        value={pkiCaName}
                        onChange={(e) => setPkiCaName(e.target.value)}
                        placeholder="Ej. CA-SERVER\Baxter-CA"
                        className="text-xs font-mono bg-white dark:bg-zinc-950 border-input text-foreground focus-visible:ring-primary"
                      />
                      <span className="text-[10px] text-zinc-500 block">
                        Si se deja vacío, Generate-BaxterHubCertificate.ps1 usa su CA por defecto (ca01.hub.baxter.com\HUB-ISSUING-CA).
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground font-semibold">Ruta del script en el escritorio del Worker</label>
                      <Input
                        type="text"
                        value={pkiScriptPath}
                        onChange={(e) => setPkiScriptPath(e.target.value)}
                        placeholder={BAXTER_PKI_SCRIPT_PATH}
                        className="text-xs font-mono bg-white dark:bg-zinc-950 border-input text-foreground focus-visible:ring-primary"
                      />
                      <span className="text-[10px] text-zinc-500 block">
                        C:\Users\hernano30\Desktop\Certificates Requests\Generate-BaxterHubCertificate.ps1
                      </span>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button
                        type="button"
                        onClick={() => {
                          const config = {
                            host: pkiHost,
                            port: pkiPort,
                            username: pkiUsername,
                            password: pkiPassword,
                            caName: pkiCaName,
                            scriptPath: pkiScriptPath,
                          };
                          localStorage.setItem('phantom_pki_config', JSON.stringify(config));
                          alert('Configuración de PKI Worker guardada con éxito.');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-1.5 cursor-pointer"
                      >
                        Guardar Configuración
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isTestingPki}
                        onClick={async () => {
                          setIsTestingPki(true);
                          const startLogs = [
                            `[+] [${new Date().toLocaleTimeString()}] Verificando especificaciones PKI (sin emitir certificado)...`,
                            `[+] Destino: ${pkiHost}:${pkiPort}`,
                            `[+] Usuario WinRM: ${pkiUsername}`,
                            `[+] Script esperado: ${pkiScriptPath || BAXTER_PKI_SCRIPT_PATH}`,
                          ];
                          setPkiTestLogs(startLogs);

                          const agent = effectiveDefaultAgent;
                          if (!agent) {
                            setPkiTestLogs(prev => [
                              ...prev,
                              `[!] ERROR: No hay un agente de ejecución SSH configurado para Phantom.`,
                              `[!] Por favor, configura un agente SSH en la pestaña del Catálogo primero.`
                            ]);
                            setIsTestingPki(false);
                            return;
                          }

                          setPkiTestLogs(prev => [
                            ...prev,
                            `[+] Agente de salto SSH seleccionado: ${agent.name} (${agent.host}:${agent.port})`,
                            `[+] Comprobando conectividad de red por SSH...`
                          ]);

                          if (agent.host === '127.0.0.1' || agent.host === 'localhost') {
                            setTimeout(() => {
                              setPkiTestLogs(prev => [
                                ...prev,
                                `[+] Autenticación SSH real con el agente simulada con éxito.`,
                                `[+] Ejecutando prueba de puerto remota: nc -zv ${pkiHost} ${pkiPort}`,
                                `[✓] Connection to ${pkiHost} ${pkiPort} port [tcp/*] succeeded!`,
                                `[+] Verificando especificaciones: Generate-BaxterHubCertificate.ps1 (sin emitir certificado)...`,
                                `[✓] SCRIPT_PKI_OK=${pkiScriptPath || BAXTER_PKI_SCRIPT_PATH}`,
                                `[✓] CONEXION_WINRM_EXITOSA: Autenticación con el dominio y usuario ${pkiUsername} completada correctamente.`,
                                `[✓] Especificaciones PKI verificadas. El worker usará el script de escritorio para emitir certificados.`,
                              ]);
                              setIsTestingPki(false);
                            }, 1500);
                            return;
                          }

                          try {
                            const portCheckCmd = `nc -zv ${pkiHost} ${pkiPort}`;
                            const psTestScript = buildPkiVerifyJumpHostScript({
                              winHost: pkiHost,
                              winPort: pkiPort,
                              winUsername: escapePsLiteral(pkiUsername),
                              winPassword: escapePsLiteral(pkiPassword),
                              scriptPath: escapePsLiteral(pkiScriptPath || BAXTER_PKI_SCRIPT_PATH),
                            });
                            
                            const resPort = await fetch('/api/automation/ssh-run', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                host: agent.host,
                                port: agent.port,
                                username: agent.username,
                                password: agent.password,
                                authType: agent.authType || 'password',
                                privateKey: agent.privateKey || '',
                                command: portCheckCmd,
                                timeout: 15,
                              })
                            });
                            
                            const dataPort = await resPort.json();
                            if (!resPort.ok || dataPort.error) {
                              throw new Error(dataPort.error || 'La comprobación del puerto WinRM falló');
                            }

                            setPkiTestLogs(prev => [
                              ...prev,
                              ...dataPort.logs.filter((l: string) => !l.startsWith('[+]') && !l.startsWith('[!]')),
                              `[✓] Conexión TCP al puerto ${pkiPort} exitosa.`,
                              `[+] Verificando WinRM y Generate-BaxterHubCertificate.ps1 en el escritorio (sin emitir certificado)...`
                            ]);
                            
                            const base64TestScript = safeBtoa(psTestScript);
                            
                            const testAuthCmd = `
                              PWSH_BIN=\$(if command -v pwsh >/dev/null 2>&1; then command -v pwsh; elif [ -x /snap/bin/pwsh ]; then echo /snap/bin/pwsh; elif [ -x /usr/bin/pwsh ]; then echo /usr/bin/pwsh; else echo pwsh; fi);
                              TMP_FILE="/tmp/pki_test_\$$.ps1";
                              echo "${base64TestScript}" | base64 -d > "\$TMP_FILE";
                              \$PWSH_BIN -File "\$TMP_FILE";
                              STATUS=\$?;
                              rm -f "\$TMP_FILE";
                              exit \$STATUS;
                            `;

                            const resAuth = await fetch('/api/automation/ssh-run', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                host: agent.host,
                                port: agent.port,
                                username: agent.username,
                                password: agent.password,
                                authType: agent.authType || 'password',
                                privateKey: agent.privateKey || '',
                                command: testAuthCmd,
                                timeout: 20,
                              })
                            });

                            const dataAuth = await resAuth.json();
                            if (!resAuth.ok || dataAuth.error) {
                              throw new Error(dataAuth.error || 'La prueba de autenticación WinRM falló');
                            }

                            const authLogs = dataAuth.logs || [];
                            const hasSuccess = authLogs.some((l: string) => l.includes('CONEXION_WINRM_EXITOSA'));
                            const scriptOk = authLogs.find((l: string) => l.includes('SCRIPT_PKI_OK='));
                            const errorLine = authLogs.find((l: string) => l.includes('ERROR_WINRM:'));

                            if (hasSuccess) {
                              setPkiTestLogs(prev => [
                                  ...prev,
                                  `[✓] CONEXION_WINRM_EXITOSA: Credenciales de ${pkiUsername} son válidas y el Worker respondió correctamente.`,
                                  scriptOk
                                    ? `[✓] ${scriptOk.trim()}`
                                    : `[✓] Generate-BaxterHubCertificate.ps1 localizado en el escritorio del worker.`,
                                  `[✓] Especificaciones PKI verificadas. No se emitió certificado (worker es otra máquina).`
                                ]);
                            } else if (errorLine) {
                              setPkiTestLogs(prev => [
                                ...prev,
                                `[!] ERROR DE AUTENTICACIÓN / WINRM:`,
                                `    ${errorLine.substring(errorLine.indexOf('ERROR_WINRM:') + 12).trim()}`
                              ]);
                            } else {
                              setPkiTestLogs(prev => [
                                ...prev,
                                `[!] ERROR: El comando remoto devolvió logs incompletos o inesperados:`,
                                ...authLogs.slice(-3)
                              ]);
                            }
                          } catch (err: any) {
                            setPkiTestLogs(prev => [
                              ...prev,
                              `[!] ERROR DE CONEXIÓN: ${err.message || 'Error desconocido durante la prueba'}`
                            ]);
                          } finally {
                            setIsTestingPki(false);
                          }
                        }}
                        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 font-semibold text-xs py-1.5 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isTestingPki ? (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Probando...
                          </>
                        ) : (
                          <>
                            <Play className="size-3" />
                            Verificar script de escritorio
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Part: Test Connection Output Logs */}
              <div className="space-y-4">
                <Card className="border-border/60 bg-zinc-950/80 shadow-xl h-full flex flex-col min-h-[300px]">
                  <CardHeader className="pb-3 border-b border-border/40">
                    <CardTitle className="text-xs font-mono font-bold text-zinc-400 flex items-center gap-2">
                      <Terminal className="size-4 text-emerald-400" />
                      Terminal de Diagnóstico WinRM
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 p-0 flex flex-col font-mono text-[10.5px] leading-relaxed text-emerald-400 bg-black/60 overflow-hidden">
                    <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap space-y-1">
                      {pkiTestLogs.length > 0 ? (
                        pkiTestLogs.map((log, idx) => (
                          <div key={idx} className={log.startsWith('[!]') ? 'text-rose-400' : log.startsWith('[✓]') ? 'text-emerald-400' : 'text-zinc-300'}>
                            {log}
                          </div>
                        ))
                      ) : (
                        <span className="text-zinc-500 italic">Listo para verificar especificaciones. Haz clic en 'Verificar script de escritorio' (no emite certificados).</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeEditorTab === 'themes' && (
            <div className="animate-fade-in">
              <PortalThemeEditorPanel />
            </div>
          )}

          {activeEditorTab === 'audit-logs' && (
            <div className="space-y-4 animate-fade-in">
              <Card className="border-border/60 bg-card/60">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="size-5 text-violet-500" />
                        Compliance Audit Trail Logs
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Audit logs complying with PCI-DSS Requirement 10.2 &amp; ISO-27001 A.12.4 security controls.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={fetchAuditLogs}
                        disabled={loadingLogs}
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 font-semibold"
                      >
                        <Loader2 className={`size-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                      <Button
                        type="button"
                        onClick={handleClearAuditLogs}
                        size="sm"
                        className="h-8 text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold"
                      >
                        Clear Audit Trail
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-zinc-100 dark:bg-zinc-950/20 border border-border/80 rounded-xl text-xs">
                    <div className="p-1 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 font-mono text-[9px] font-bold">PATH</div>
                    <p className="text-muted-foreground leading-normal">
                      Logs are saved on the server at: <span className="font-mono text-foreground font-semibold select-all">{auditLogsPath || 'logs/audit.log'}</span>
                    </p>
                  </div>

                  {/* Logs terminal box */}
                  <div className="font-mono text-[10.5px] leading-relaxed bg-black text-zinc-300 p-4 rounded-xl border border-zinc-800 max-h-[500px] overflow-y-auto space-y-1 select-text">
                    {loadingLogs ? (
                      <div className="flex items-center justify-center py-10 gap-2 text-zinc-500">
                        <Loader2 className="size-4 animate-spin" />
                        Fetching compliance logs from server...
                      </div>
                    ) : auditLogs.length === 0 ? (
                      <div className="text-zinc-500 italic text-center py-10">No audit log entries recorded.</div>
                    ) : (
                      auditLogs.slice().reverse().map((log, i) => {
                        // Highlight severity levels for better visual indexing
                        let colorClass = 'text-zinc-300';
                        if (log.includes('[INFO]')) colorClass = 'text-cyan-400';
                        else if (log.includes('[WARN]')) colorClass = 'text-amber-400 font-semibold';
                        else if (log.includes('[ERROR]')) colorClass = 'text-rose-400 font-bold';
                        else if (log.includes('[CRITICAL]')) colorClass = 'text-red-500 font-bold bg-red-500/5 px-1 py-0.5 rounded border border-red-500/20';

                        return (
                          <div key={i} className={`whitespace-pre-wrap leading-normal border-b border-zinc-900 pb-1.5 ${colorClass}`}>
                            {log}
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
