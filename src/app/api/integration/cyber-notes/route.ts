import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTES_FILE = path.join(DATA_DIR, 'cyber-notes.json');
const CONFIG_FILE = path.join(DATA_DIR, 'amatista-config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readNotes(): any[] {
  ensureDataDir();
  if (!fs.existsSync(NOTES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(NOTES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeNotes(notes: any[]) {
  ensureDataDir();
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const notes = readNotes();
    return NextResponse.json(notes);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, title, category, content, version, lastModifiedBy, force } = body;

    if (!title || !category || !content) {
      return NextResponse.json({ error: 'Faltan campos requeridos (title, category, content)' }, { status: 400 });
    }

    const notes = readNotes();
    let noteId = id || `cyber-note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let existingNoteIndex = notes.findIndex((n) => n.id === noteId);
    let existingNote = existingNoteIndex >= 0 ? notes[existingNoteIndex] : null;

    // Control de Concurrencia (Bloqueo Optimista)
    if (existingNote && !force) {
      if (version < existingNote.version) {
        return NextResponse.json(
          {
            error: 'Conflicto de edición: la nota fue modificada por otro usuario.',
            serverNote: existingNote,
          },
          { status: 409 }
        );
      }
    }

    const newVersion = existingNote ? Math.max(existingNote.version, version) + 1 : 1;
    const lastModifiedAt = new Date().toISOString();

    const noteToSave = {
      id: noteId,
      title,
      category,
      content,
      version: newVersion,
      lastModifiedBy: lastModifiedBy || 'operator',
      lastModifiedAt,
      amatistaDocId: existingNote ? existingNote.amatistaDocId : null,
    };

    if (existingNoteIndex >= 0) {
      notes[existingNoteIndex] = noteToSave;
    } else {
      notes.push(noteToSave);
    }

    writeNotes(notes);

    // Propagar cambio a Amatista App
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const configRaw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(configRaw);
        
        if (config.isConnected) {
          let url = config.amatistaUrl;
          if (url.includes('localhost')) {
            url = url.replace('localhost', '127.0.0.1');
          }

          const syncRes = await fetch(`${url}/api/integration/phantom/cyber-notes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
              gemResourceId: noteId,
              title,
              category,
              content,
              version: newVersion,
              lastModifiedBy: lastModifiedBy || 'operator',
              lastModifiedAt,
              amatistaDocId: noteToSave.amatistaDocId
            })
          });

          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.docId && noteToSave.amatistaDocId !== syncData.docId) {
              noteToSave.amatistaDocId = syncData.docId;
              writeNotes(notes);
            }
          }
        }
      } catch (e) {
        console.error('Error propagating Cyber Note sync to Amatista:', e);
      }
    }

    return NextResponse.json({ success: true, notes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    let notes = readNotes();
    const note = notes.find((n) => n.id === id);
    notes = notes.filter((n) => n.id !== id);
    writeNotes(notes);

    // Propagar eliminación a Amatista
    if (note && note.amatistaDocId && fs.existsSync(CONFIG_FILE)) {
      try {
        const configRaw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(configRaw);
        
        if (config.isConnected) {
          let url = config.amatistaUrl;
          if (url.includes('localhost')) {
            url = url.replace('localhost', '127.0.0.1');
          }

          await fetch(`${url}/api/integration/phantom/cyber-notes?docId=${note.amatistaDocId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${config.apiKey}`
            }
          });
        }
      } catch (e) {
        console.error('Error propagating Cyber Note delete to Amatista:', e);
      }
    }

    return NextResponse.json({ success: true, notes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
