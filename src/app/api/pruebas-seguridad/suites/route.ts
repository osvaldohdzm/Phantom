import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { PRUEBAS_INITIAL } from '@/lib/data-pruebas';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'matrix-suites.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const defaultSuites = [
      {
        id: 'suite-wstg-v2',
        name: 'CROS Web Application Security Testing (WSTG) v2.0.0',
        projectName: 'Catálogo Oficial',
        type: 'Web Application',
        description: 'Guía oficial OWASP para pruebas de penetración y evaluación de seguridad en aplicaciones web.',
        framework: 'CROS Web Application Security Testing (WSTG) v2.0.0',
        createdAt: '2026-07-02',
        tests: PRUEBAS_INITIAL,
      },
      {
        id: 'suite-api-2023',
        name: 'OWASP API Security Top 10 Assessment v2023',
        projectName: 'Catálogo Oficial',
        type: 'API Testing',
        description: 'Marco de evaluación enfocado en APIs REST/GraphQL (BOLA, Auth Flaws, BFLA, SSRF, Rate Limit).',
        framework: 'OWASP API Security Top 10 Assessment v2023',
        createdAt: '2026-07-05',
        tests: PRUEBAS_INITIAL.map((t, idx) => ({
          ...t,
          idPruebaSeguridad: `API-${idx + 1}`,
          evaluacionAsociada: 'OWASP API Security Top 10 Assessment v2023',
        })),
      },
      {
        id: 'suite-istg-v1',
        name: 'CROS Infrastructure Security Testing (ISTG) v1.0.0',
        projectName: 'Catálogo Oficial',
        type: 'Infrastructure',
        description: 'Evaluación de seguridad en infraestructura de red, servidores, puertos y servicios expuestos.',
        framework: 'CROS Infrastructure Security Testing (ISTG) v1.0.0',
        createdAt: '2026-07-08',
        tests: PRUEBAS_INITIAL.map((t, idx) => ({
          ...t,
          idPruebaSeguridad: `ISTG-INFRA-${idx + 1}`,
          evaluacionAsociada: 'CROS Infrastructure Security Testing (ISTG) v1.0.0',
        })),
      },
      {
        id: 'suite-mastg-v2',
        name: 'OWASP Mobile Application Security Testing (MASTG) v2.0',
        projectName: 'Catálogo Oficial',
        type: 'Mobile Pentest',
        description: 'Guía de seguridad para aplicaciones móviles Android e iOS (Insecure Storage, Reverse Engineering).',
        framework: 'OWASP Mobile Application Security Testing (MASTG) v2.0',
        createdAt: '2026-07-10',
        tests: PRUEBAS_INITIAL.slice(0, 5).map((t, idx) => ({
          ...t,
          idPruebaSeguridad: `MASTG-MOB-${idx + 1}`,
          evaluacionAsociada: 'OWASP Mobile Application Security Testing (MASTG) v2.0',
        })),
      },
      {
        id: 'suite-pci-v4',
        name: 'PCI-DSS v4.0 Technical Security Assessment',
        projectName: 'Catálogo Oficial',
        type: 'Compliance & Security',
        description: 'Evaluación técnica de cumplimiento de estándares de seguridad para procesamiento de pagos.',
        framework: 'PCI-DSS v4.0 Technical Security Assessment',
        createdAt: '2026-07-12',
        tests: PRUEBAS_INITIAL.slice(0, 5).map((t, idx) => ({
          ...t,
          idPruebaSeguridad: `PCI-REQ-${idx + 1}`,
          evaluacionAsociada: 'PCI-DSS v4.0 Technical Security Assessment',
        })),
      },
      {
        id: 'suite-cis-cloud',
        name: 'Cloud Infrastructure Security Assessment (CIS)',
        projectName: 'Catálogo Oficial',
        type: 'Cloud Security',
        description: 'Auditoría de postura de seguridad y configuración en entornos AWS, Azure y Google Cloud.',
        framework: 'Cloud Infrastructure Security Assessment (CIS)',
        createdAt: '2026-07-14',
        tests: PRUEBAS_INITIAL.slice(0, 5).map((t, idx) => ({
          ...t,
          idPruebaSeguridad: `CIS-CLOUD-${idx + 1}`,
          evaluacionAsociada: 'Cloud Infrastructure Security Assessment (CIS)',
        })),
      },
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultSuites, null, 2), 'utf-8');
    return defaultSuites;
  }
  return null;
}

export async function GET(req: Request) {
  try {
    ensureDataFile();
    const url = new URL(req.url);
    const stat = fs.statSync(DATA_FILE);
    const version = stat.mtimeMs;

    if (url.searchParams.get('versionOnly') === 'true') {
      return NextResponse.json({ success: true, version });
    }

    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8');
    let rawInstances = JSON.parse(fileContent);
    if (!Array.isArray(rawInstances) || rawInstances.length === 0 || !rawInstances[0].tests) {
      rawInstances = ensureDataFile() || rawInstances;
    }

    const instances = rawInstances.map((inst: any) => ({
      ...inst,
      tests: Array.isArray(inst.tests) ? inst.tests : PRUEBAS_INITIAL,
    }));

    return NextResponse.json({ success: true, instances, version });
  } catch (error) {
    console.error('Error reading matrix-suites.json:', error);
    return NextResponse.json({ success: false, error: 'Failed to read matrix data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || !Array.isArray(body.instances)) {
      return NextResponse.json({ success: false, error: 'Invalid instances payload' }, { status: 400 });
    }

    ensureDataFile();
    fs.writeFileSync(DATA_FILE, JSON.stringify(body.instances, null, 2), 'utf-8');
    const stat = fs.statSync(DATA_FILE);

    // Sincronizar con Amatista si la integración está configurada y activa
    const configPath = path.join(DATA_DIR, 'amatista-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const configRaw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configRaw);
        if (config.isConnected) {
          const tests = body.instances[0]?.tests || [];
          let url = config.amatistaUrl;
          if (url.includes('localhost')) {
            url = url.replace('localhost', '127.0.0.1');
          }
          fetch(`${url}/api/integration/phantom`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
              username: config.username,
              userId: config.userId,
              phantomUrl: config.phantomUrl,
              tests
            })
          }).catch(err => console.error('Error syncing to Amatista on test suite save:', err));
        }
      } catch (err) {
        console.error('Failed to trigger Amatista sync:', err);
      }
    }

    return NextResponse.json({ success: true, version: stat.mtimeMs, timestamp: Date.now() });
  } catch (error) {
    console.error('Error saving matrix-suites.json:', error);
    return NextResponse.json({ success: false, error: 'Failed to save matrix data' }, { status: 500 });
  }
}
