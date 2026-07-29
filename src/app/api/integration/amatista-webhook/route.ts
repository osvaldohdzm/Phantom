import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SUITES_FILE = path.join(DATA_DIR, 'matrix-suites.json');
const NOTES_FILE = path.join(DATA_DIR, 'cyber-notes.json');

function parseMarkdownTestCase(md: string) {
  let title = "";
  const titleMatch = md.match(/title:\s*"([^"]+)"/) || md.match(/title:\s*'([^']+)'/) || md.match(/title:\s*([^\r\n]+)/);
  if (titleMatch) title = titleMatch[1].trim();

  if (!title) {
    const h1Match = md.match(/^#\s+(.+)$/m);
    if (h1Match) title = h1Match[1].trim();
  }

  let idPrueba = "";
  const idMatch = md.match(/-\s+\*\*ID de Prueba\*\*:\s*([^\r\n]*)/i);
  if (idMatch) idPrueba = idMatch[1].trim();

  let resultado = "";
  const resMatch = md.match(/-\s+\*\*Resultado\*\*:\s*([^\r\n]*)/i);
  if (resMatch) resultado = resMatch[1].trim();

  let descripcion = "";
  const descMatch = md.match(/## Descripción\r?\n([\s\S]*?)(?=\r?\n##|$)/);
  if (descMatch) descripcion = descMatch[1].trim();

  let comentarios = "";
  const commentsMatch = md.match(/## Comentarios\r?\n([\s\S]*?)(?=\r?\n##|$)/);
  if (commentsMatch) comentarios = commentsMatch[1].trim();

  let referencias = "";
  const refsMatch = md.match(/## Referencias Externas\r?\n([\s\S]*?)(?=\r?\n##|$)/);
  if (refsMatch) {
    const lines = refsMatch[1].split("\n");
    const urls = lines
      .map(line => {
        const linkMatch = line.match(/\[.*?\]\((.*?)\)/) || line.match(/-\s*(https?:\/\/\S+)/) || line.match(/-\s*(\S+)/);
        return linkMatch ? linkMatch[1].trim() : null;
      })
      .filter(Boolean);
    referencias = urls.join(", ");
  }

  return { title, idPrueba, resultado, descripcion, comentarios, referencias };
}

function parseMarkdownCyberNote(md: string) {
  const fmMatch = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let title = "";
  let category = "Other";
  let version = 1;
  let lastModifiedBy = "operator";

  if (fmMatch) {
    const fm = fmMatch[1];
    const tMatch = fm.match(/title:\s*"([^"]+)"/) || fm.match(/title:\s*([^\r\n]+)/);
    if (tMatch) title = tMatch[1].trim();

    const cMatch = fm.match(/category:\s*"([^"]+)"/) || fm.match(/category:\s*([^\r\n]+)/);
    if (cMatch) category = cMatch[1].trim();

    const vMatch = fm.match(/version:\s*(\d+)/);
    if (vMatch) version = parseInt(vMatch[1], 10);

    const lMatch = fm.match(/lastModifiedBy:\s*"([^"]+)"/) || fm.match(/lastModifiedBy:\s*([^\r\n]+)/);
    if (lMatch) lastModifiedBy = lMatch[1].trim();
  }

  const bodyContent = md.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
  return { title, category, version, lastModifiedBy, content: bodyContent };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, docId, gemResourceId, path: relPath, content } = body;

    // 1. Enrutar si es Cyber Notes
    if (relPath && relPath.startsWith('Cyber Notes/')) {
      if (!fs.existsSync(NOTES_FILE)) {
        return NextResponse.json({ success: true }); // nada que actualizar aún
      }
      const rawNotes = fs.readFileSync(NOTES_FILE, 'utf-8');
      let notes = JSON.parse(rawNotes);

      let note = notes.find((n: any) => n.amatistaDocId === docId || n.id === gemResourceId);

      if (action === 'delete') {
        notes = notes.filter((n: any) => n.id !== note?.id);
      } else if (action === 'update' && content) {
        const parsed = parseMarkdownCyberNote(content);
        if (note) {
          note.title = parsed.title || note.title;
          note.category = parsed.category || note.category;
          note.content = parsed.content;
          note.version = parsed.version;
          note.lastModifiedBy = parsed.lastModifiedBy;
          note.lastModifiedAt = new Date().toISOString();
        } else {
          // Si no existe, lo creamos
          notes.push({
            id: gemResourceId || `cyber-note-${Date.now()}`,
            title: parsed.title || "Nota Importada",
            category: parsed.category,
            content: parsed.content,
            version: parsed.version,
            lastModifiedBy: parsed.lastModifiedBy,
            lastModifiedAt: new Date().toISOString(),
            amatistaDocId: docId
          });
        }
      }

      fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    }

    // 2. Por defecto: Casos de Prueba (matrix-suites.json)
    if (!fs.existsSync(SUITES_FILE)) {
      return NextResponse.json({ success: false, error: 'matrix-suites.json not found' }, { status: 404 });
    }

    const rawSuites = fs.readFileSync(SUITES_FILE, 'utf-8');
    const suites = JSON.parse(rawSuites);
    if (!Array.isArray(suites) || suites.length === 0) {
      return NextResponse.json({ success: false, error: 'No suites found' }, { status: 400 });
    }

    const tests = suites[0].tests || [];

    let testItem = null;
    if (gemResourceId) {
      testItem = tests.find((t: any) => String(t.id) === String(gemResourceId));
    }

    if (action === 'delete') {
      if (testItem) {
        testItem.resultadoPrueba = 'Out Of Scope';
        testItem.comentariosPrueba = 'Nota eliminada en Amatista.';
      }
    } else if (action === 'update' && content) {
      const parsed = parseMarkdownTestCase(content);
      
      if (!testItem && parsed.idPrueba) {
        testItem = tests.find((t: any) => t.idPruebaSeguridad === parsed.idPrueba);
      }

      if (testItem) {
        if (parsed.title) testItem.nombrePrueba = parsed.title;
        if (parsed.resultado) testItem.resultadoPrueba = parsed.resultado;
        if (parsed.descripcion) testItem.descripcionPrueba = parsed.descripcion;
        if (parsed.comentarios) testItem.comentariosPrueba = parsed.comentarios;
        if (parsed.referencias) testItem.referencias = parsed.referencias;
      } else {
        return NextResponse.json({ success: false, error: 'Test case not found in Phantom' }, { status: 404 });
      }
    }

    fs.writeFileSync(SUITES_FILE, JSON.stringify(suites, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
