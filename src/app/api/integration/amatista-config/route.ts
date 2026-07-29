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
    const config = JSON.parse(raw);

    // Live connectivity check to verify if Amatista is currently active and reachable
    let liveConnected = false;
    if (config.isConnected && config.amatistaUrl && config.apiKey) {
      try {
        let url = config.amatistaUrl;
        if (url.includes('localhost')) {
          url = url.replace('localhost', '127.0.0.1');
        }
        // Call the integration ping endpoint in Amatista with a short timeout
        const testRes = await fetch(`${url}/api/integration/phantom?key=${config.apiKey}`, {
          signal: AbortSignal.timeout(3000)
        });
        if (testRes.ok) {
          liveConnected = true;
        }
      } catch (e) {
        liveConnected = false;
      }
    }

    return NextResponse.json({ ...config, isConnected: liveConnected });
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

    // Resolve localhost to 127.0.0.1 preferentially to prevent Node.js fetch DNS errors
    let resolvedAmatistaUrl = amatistaUrl;
    if (resolvedAmatistaUrl.includes('localhost')) {
      resolvedAmatistaUrl = resolvedAmatistaUrl.replace('localhost', '127.0.0.1');
    }

    try {
      const testRes = await fetch(`${resolvedAmatistaUrl}/api/integration/phantom?key=${apiKey}`);
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

    const syncRes = await fetch(`${resolvedAmatistaUrl}/api/integration/phantom`, {
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

    // Sincronizar Cyber Notes existentes si hay
    const NOTES_FILE = path.join(DATA_DIR, 'cyber-notes.json');
    if (fs.existsSync(NOTES_FILE)) {
      try {
        const rawNotes = fs.readFileSync(NOTES_FILE, 'utf-8');
        const notes = JSON.parse(rawNotes);
        let notesChanged = false;
        for (const note of notes) {
          const syncNoteRes = await fetch(`${resolvedAmatistaUrl}/api/integration/phantom/cyber-notes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              gemResourceId: note.id,
              title: note.title,
              category: note.category,
              content: note.content,
              version: note.version,
              lastModifiedBy: note.lastModifiedBy,
              lastModifiedAt: note.lastModifiedAt,
              amatistaDocId: note.amatistaDocId
            })
          });
          if (syncNoteRes.ok) {
            const syncNoteData = await syncNoteRes.json();
            if (syncNoteData.docId && note.amatistaDocId !== syncNoteData.docId) {
              note.amatistaDocId = syncNoteData.docId;
              notesChanged = true;
            }
          }
        }
        if (notesChanged) {
          fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
        }
      } catch (err) {
        console.error('Error syncing initial Cyber Notes:', err);
      }
    }

    const newConfig = {
      isConnected: true,
      amatistaUrl: resolvedAmatistaUrl,
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
