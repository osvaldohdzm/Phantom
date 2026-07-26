import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'amatista-config.json');
const SUITES_FILE = path.join(DATA_DIR, 'matrix-suites.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export async function GET() {
  try {
    ensureDataDir();
    if (!fs.existsSync(CONFIG_FILE)) {
      return NextResponse.json({ isConnected: false });
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amatistaUrl, hostIp, apiKey, username, userId, phantomUrl } = body;

    if (!amatistaUrl || !apiKey || !username || !userId) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    ensureDataDir();

    try {
      const testRes = await fetch(`${amatistaUrl}/api/integration/phantom?key=${apiKey}`);
      if (!testRes.ok) {
        return NextResponse.json({ error: 'La API Key de Amatista no es válida o Amatista no responde' }, { status: 400 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: `No se pudo conectar a Amatista: ${e.message}` }, { status: 400 });
    }

    let tests: any[] = [];
    if (fs.existsSync(SUITES_FILE)) {
      const rawSuites = fs.readFileSync(SUITES_FILE, 'utf-8');
      const suites = JSON.parse(rawSuites);
      if (Array.isArray(suites) && suites.length > 0) {
        tests = suites[0].tests || [];
      }
    }

    const syncRes = await fetch(`${amatistaUrl}/api/integration/phantom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        username,
        userId,
        phantomUrl: phantomUrl || 'https://localhost:3000',
        tests
      })
    });

    if (!syncRes.ok) {
      const errText = await syncRes.text();
      return NextResponse.json({ error: `Error al sincronizar con Amatista: ${errText}` }, { status: 500 });
    }

    const syncData = await syncRes.json();

    const newConfig = {
      isConnected: true,
      amatistaUrl,
      hostIp,
      apiKey,
      username,
      userId,
      phantomUrl: phantomUrl || 'https://localhost:3000',
      vaultId: syncData.vaultId,
      lastSyncedAt: new Date().toISOString()
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');

    return NextResponse.json({ success: true, config: newConfig });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
