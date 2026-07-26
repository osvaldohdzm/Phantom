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
        id: 'suite-1',
        name: 'Prueba de Pentest WSTG - Banco Digital',
        projectName: 'Digital Banking Portal (EIM ID – 9847446)',
        framework: 'CROS Web Application Security Testing (WSTG) v2.0.0',
        createdAt: '2026-07-02',
        tests: PRUEBAS_INITIAL,
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
    const instances = JSON.parse(fileContent);
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
          fetch(`${config.amatistaUrl}/api/integration/phantom`, {
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
