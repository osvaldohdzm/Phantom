'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Search,
  Plus,
  Save,
  BookOpen,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Edit3,
  Eye,
  Lock,
} from 'lucide-react';

interface CyberNote {
  id: string;
  title: string;
  category: string;
  content: string;
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
  amatistaDocId?: string | null;
}

const CATEGORIES = ['CTF', 'Writeup', 'Cheat Sheet', 'Vulnerability', 'Other'];

export default function CyberNotesPage() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<CyberNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<CyberNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editMode, setEditMode] = useState<'write' | 'preview'>('write');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Integration config state
  const [integrationConfig, setIntegrationConfig] = useState<any>(null);

  // Conflict management states
  const [conflictNote, setConflictNote] = useState<CyberNote | null>(null);
  const [isConflictOpen, setIsConflictOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CTF');
  const [content, setContent] = useState('');

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/integration/cyber-notes');
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
        if (data.length > 0 && !selectedNote) {
          handleSelectNote(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching cyber notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIntegrationConfig = async () => {
    try {
      const res = await fetch('/api/integration/amatista-config');
      if (res.ok) {
        const data = await res.json();
        setIntegrationConfig(data);
      }
    } catch (err) {
      console.error('Error fetching integration config:', err);
    }
  };

  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    if (!integrationConfig) return;
    setSyncingAll(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/integration/amatista-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amatistaUrl: integrationConfig.amatistaUrl,
          hostIp: integrationConfig.hostIp,
          apiKey: integrationConfig.apiKey,
          username: integrationConfig.username,
          userId: integrationConfig.userId,
          phantomUrl: integrationConfig.phantomUrl,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNotice('¡Sincronización completa con Amatista realizada!');
        await fetchNotes(); // recargar notas
      } else {
        setError(data.error || 'Error al sincronizar con Amatista');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setSyncingAll(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    fetchIntegrationConfig();
  }, []);

  const handleSelectNote = (note: CyberNote) => {
    setSelectedNote(note);
    setTitle(note.title);
    setCategory(note.category);
    setContent(note.content);
    setError(null);
    setNotice(null);
  };

  const handleCreateNew = () => {
    setSelectedNote(null);
    setTitle('Nueva Nota Cyber');
    setCategory('CTF');
    setContent('# Nueva Nota Cyber\n\nEscribe aquí tu CTF writeup o cheatsheet...');
    setError(null);
    setNotice(null);
  };

  const handleSave = async (forceOverwrite = false) => {
    setSaving(true);
    setError(null);
    setNotice(null);

    const username = user?.nombre || user?.email || 'operator';
    const payload = {
      id: selectedNote?.id || null,
      title,
      category,
      content,
      version: forceOverwrite ? (conflictNote?.version || 1) : (selectedNote?.version || 0),
      lastModifiedBy: username,
      force: forceOverwrite,
    };

    try {
      const res = await fetch('/api/integration/cyber-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 409) {
        setConflictNote(data.serverNote);
        setIsConflictOpen(true);
        setError('Conflicto detectado: la nota ha sido modificada por otro usuario.');
      } else if (!res.ok) {
        setError(data.error || 'Error al guardar la nota');
      } else {
        setNotice('¡Nota guardada y sincronizada correctamente!');
        const updatedNotes = data.notes;
        setNotes(updatedNotes);
        const match = updatedNotes.find((n: CyberNote) => n.title === title || n.id === selectedNote?.id);
        if (match) {
          handleSelectNote(match);
        }
        setIsConflictOpen(false);
        setConflictNote(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    if (!confirm('¿Seguro que deseas eliminar esta nota de forma permanente?')) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/integration/cyber-notes?id=${selectedNote.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setNotice('Nota eliminada correctamente');
        setNotes(data.notes);
        if (data.notes.length > 0) {
          handleSelectNote(data.notes[0]);
        } else {
          setSelectedNote(null);
          setTitle('');
          setContent('');
        }
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleResolveConflict = async (action: 'overwrite' | 'reload') => {
    if (action === 'overwrite') {
      await handleSave(true);
    } else {
      if (conflictNote) {
        handleSelectNote(conflictNote);
      }
      setIsConflictOpen(false);
      setConflictNote(null);
      setError(null);
    }
  };

  const filteredNotes = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || n.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-2 text-foreground">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <BookOpen className="text-primary" />
            Cyber Notes
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            CTF writeups, apuntes de OSCP/eLearnSecurity y guías técnicas sincronizados con Amatista.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {integrationConfig?.isConnected && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(`${integrationConfig.amatistaUrl}/dashboard?vaultId=${integrationConfig.vaultId}`, '_blank')}
                className="flex items-center gap-1.5 border-primary/40 hover:bg-primary/10 text-primary font-semibold transition"
              >
                <BookOpen size={16} />
                Abrir Amatista
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={syncingAll}
                onClick={handleSyncAll}
                className="flex items-center gap-1.5 border-primary/40 hover:bg-primary/10 text-primary font-semibold transition"
              >
                <RotateCw size={16} className={syncingAll ? 'animate-spin' : ''} />
                {syncingAll ? 'Sincronizando...' : 'Sincronizar con Amatista'}
              </Button>
            </>
          )}
          <Button
            type="button"
            onClick={handleCreateNew}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5"
          >
            <Plus size={16} />
            Nueva Nota
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={fetchNotes}
            className="flex items-center gap-1.5"
          >
            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
            Refrescar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Filter and List */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="bg-card border-border">
            <CardContent className="p-3 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" size={16} />
                <Input
                  type="text"
                  placeholder="Buscar notas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background border-border text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categoría</label>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-2.5 py-1 rounded text-xs transition ${
                      selectedCategory === 'all'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/80'
                    }`}
                  >
                    Todos
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded text-xs transition ${
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                          : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/80'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* List */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">No se encontraron notas.</p>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedNote?.id === note.id
                      ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                      : 'bg-card border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <h4 className="font-semibold text-sm truncate max-w-[130px]">{note.title}</h4>
                    <span className="px-1.5 py-0.5 rounded bg-secondary text-[9px] font-semibold text-secondary-foreground border border-border/60 uppercase tracking-wide">
                      {note.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-1">
                    {note.content.replace(/[#*`_-]/g, '').substring(0, 50)}
                  </p>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground/80 mt-2">
                    <div className="flex items-center gap-1">
                      <User size={10} className="text-muted-foreground/60" />
                      {note.lastModifiedBy}
                    </div>
                    <div>v{note.version}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Active Note Editor */}
        <div className="lg:col-span-3">
          <Card className="bg-card border-border h-full flex flex-col min-h-[550px]">
            <CardContent className="p-4 flex-1 flex flex-col space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título de la nota"
                    className="font-bold text-lg bg-background border-border text-foreground w-64 md:w-80 focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-background border border-border rounded px-2.5 py-1.5 text-xs text-foreground font-medium focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditMode('write')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-l border border-r-0 ${
                      editMode === 'write'
                        ? 'bg-primary text-primary-foreground font-semibold border-primary'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border'
                    }`}
                  >
                    <Edit3 size={13} />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditMode('preview')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-r border ${
                      editMode === 'preview'
                        ? 'bg-primary text-primary-foreground font-semibold border-primary'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border'
                    }`}
                  >
                    <Eye size={13} />
                    Vista Previa
                  </button>
                </div>
              </div>

              {selectedNote && (
                <div className="flex flex-wrap items-center gap-4 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User size={12} className="text-muted-foreground/60" />
                    Último cambio por: <strong className="text-foreground font-medium">{selectedNote.lastModifiedBy}</strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-muted-foreground/60" />
                    Fecha: <strong className="text-foreground font-medium">{new Date(selectedNote.lastModifiedAt).toLocaleString()}</strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <Lock size={12} className="text-muted-foreground/60" />
                    Versión: <strong className="text-foreground font-medium">v{selectedNote.version}</strong>
                  </div>
                  {selectedNote.amatistaDocId && integrationConfig?.isConnected && (
                    <a
                      href={`${integrationConfig.amatistaUrl}/dashboard?vaultId=${integrationConfig.vaultId}&id=${selectedNote.amatistaDocId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all font-semibold ml-auto"
                    >
                      <CheckCircle size={10} />
                      Sincronizado Amatista (Ver Recurso)
                    </a>
                  )}
                </div>
              )}

              {/* Editor/Preview Area */}
              <div className="flex-1 flex flex-col min-h-[300px]">
                {editMode === 'write' ? (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Contenido en Markdown..."
                    className="flex-1 w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none min-h-[300px]"
                  />
                ) : (
                  <div className="flex-1 bg-muted/40 border border-border rounded-lg p-4 text-sm font-sans prose dark:prose-invert overflow-y-auto max-h-[400px]">
                    {content ? (
                      <pre className="whitespace-pre-wrap font-mono text-xs text-foreground bg-transparent p-0 border-0">
                        {content}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground italic">Sin contenido.</p>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  <AlertTriangle className="shrink-0 mt-0.5" size={14} />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="flex items-start gap-2 p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs">
                  <CheckCircle className="shrink-0 mt-0.5" size={14} />
                  <span>{notice}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-border">
                {selectedNote ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    Eliminar Nota
                  </Button>
                ) : (
                  <div />
                )}
                <Button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5"
                >
                  <Save size={16} />
                  {saving ? 'Guardando...' : 'Guardar y Sincronizar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Conflict Dialog */}
      {isConflictOpen && conflictNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">Conflicto de Edición Colaborativa</h3>
            </div>
            <p className="text-muted-foreground text-sm">
              Esta nota fue actualizada recientemente en Amatista o por otro operador:
            </p>
            <div className="p-3 bg-muted/80 rounded border border-border text-xs text-muted-foreground space-y-1">
              <div>Modificado por: <strong className="text-foreground">{conflictNote.lastModifiedBy}</strong></div>
              <div>Fecha: <strong className="text-foreground">{new Date(conflictNote.lastModifiedAt).toLocaleString()}</strong></div>
              <div>Versión actual en servidor: <strong className="text-foreground">v{conflictNote.version}</strong> (Tú tienes la versión v{selectedNote?.version})</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Tus cambios locales</div>
                <div className="bg-muted p-2 rounded h-24 overflow-y-auto text-[11px] font-mono border border-border">
                  {content.substring(0, 150)}...
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Contenido en Servidor</div>
                <div className="bg-muted p-2 rounded h-24 overflow-y-auto text-[11px] font-mono border border-border">
                  {conflictNote.content.substring(0, 150)}...
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleResolveConflict('reload')}
                className="text-foreground border-border"
              >
                Cargar Cambios del Servidor
              </Button>
              <Button
                type="button"
                onClick={() => handleResolveConflict('overwrite')}
                className="bg-destructive hover:bg-destructive/95 text-destructive-foreground"
              >
                Sobreescribir con mis Cambios
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
