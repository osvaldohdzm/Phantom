'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Database, Download, Server, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  downloadDeploymentEnv,
  getDatabaseRuntimeConfig,
  listDeploymentProfiles,
  type AdminDatabaseRuntime,
  type AdminDeploymentProfile,
} from '@/lib/auth-api';

const MODE_LABEL: Record<string, string> = {
  postgresql: 'PostgreSQL',
  sqlite: 'SQLite embebido',
  other: 'Otro motor',
};

export function DatabaseConfigPanel() {
  const [runtime, setRuntime] = useState<AdminDatabaseRuntime | null>(null);
  const [profiles, setProfiles] = useState<AdminDeploymentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rt, prof] = await Promise.all([
        getDatabaseRuntimeConfig(),
        listDeploymentProfiles(),
      ]);
      setRuntime(rt);
      setProfiles(prof);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar configuración de base de datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copiado al portapapeles`);
    } catch {
      setNotice('No se pudo copiar');
    }
  };

  const showPreview = async (profileId: string) => {
    try {
      const res = await downloadDeploymentEnv(profileId);
      setPreviewId(profileId);
      setPreviewContent(res.env_content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al generar plantilla');
    }
  };

  const downloadEnv = async (profileId: string, filename: string) => {
    try {
      const res = await downloadDeploymentEnv(profileId);
      const blob = new Blob([res.env_content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/\.example$/, '') || 'phantom.env';
      a.click();
      URL.revokeObjectURL(url);
      setNotice(`Descargado ${a.download}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar plantilla');
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando configuración de base de datos…</p>;
  }

  if (error && !runtime) {
    return (
      <p className="text-sm text-rose-600 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">
        {error}
      </p>
    );
  }

  if (!runtime) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 flex gap-3">
        <ShieldAlert className="size-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Solo lectura — tu instancia actual no se modifica</p>
          <p className="text-xs mt-1 opacity-90">
            {runtime.switch_note} Los perfiles de abajo son para otra persona que descargue la app
            en un equipo nuevo, sin tu base de datos.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-600 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="size-5" />
            Conexión activa (runtime)
          </CardTitle>
          <CardDescription>
            Motor en uso ahora mismo por este servidor · {MODE_LABEL[runtime.mode] ?? runtime.mode}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Detail label="Modo" value={MODE_LABEL[runtime.mode] ?? runtime.mode} />
            <Detail label="Driver SQLAlchemy" value={runtime.driver ?? '—'} />
            <Detail label="Variable" value={runtime.connection_name} mono />
            <Detail label="Host" value={runtime.host ?? '— (archivo local)'} />
            <Detail label="Puerto" value={runtime.port != null ? String(runtime.port) : '—'} />
            <Detail label="Base / archivo" value={runtime.database ?? '—'} mono />
            <Detail label="Usuario" value={runtime.username ?? '—'} />
            <Detail label="Contraseña" value={runtime.password_masked ?? '—'} mono />
            <Detail label="Redis" value={runtime.redis_url_masked} mono className="sm:col-span-2" />
            <Detail
              label="URL (enmascarada)"
              value={runtime.database_url_masked}
              mono
              className="sm:col-span-2"
            />
            <Detail label="Auth requerido" value={runtime.auth_required ? 'Sí' : 'No'} />
            <Detail label="JWT (min)" value={String(runtime.jwt_expire_minutes)} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyText(runtime.database_url_masked, 'URL enmascarada')}
            >
              <Copy className="size-3.5 mr-1" />
              Copiar URL (sin contraseña)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo CFR (Next.js)</CardTitle>
          <CardDescription>
            El backend usa <code className="text-xs">DATABASE_URL</code> en{' '}
            <code className="text-xs">backend/.env</code>. Las rutas del catálogo en el frontend
            leen por separado <code className="text-xs">POSTGRES_*</code> en{' '}
            <code className="text-xs">.env.local</code> — no comparten la misma variable.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            En instalaciones con SQLite embebido, hallazgos, usuarios y matriz funcionan con el
            backend; el catálogo CFR completo sigue requiriendo PostgreSQL en el frontend.
          </p>
          <p>
            Para otro equipo: copia también{' '}
            <code className="text-[10px]">.env.local.example</code> si van a usar{' '}
            <code className="text-[10px]">/vulns-catalog</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="size-5" />
            Perfiles para instalación nueva
          </CardTitle>
          <CardDescription>
            Elige PostgreSQL robusto o SQLite embebido para quien instale Phantom en otro equipo.
            Copia el archivo a <code className="text-xs">backend/.env</code> y reinicia el backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-lg border border-border p-4 space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{profile.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{profile.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Recomendado: {profile.recommended_for.join(' · ')}
                  </p>
                  {profile.limitations?.length ? (
                    <ul className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 list-disc pl-4">
                      {profile.limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void showPreview(profile.id)}
                  >
                    Ver .env
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void downloadEnv(profile.id, profile.env_file_name)}
                  >
                    <Download className="size-3.5 mr-1" />
                    Descargar
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {previewId && previewContent ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium">Vista previa — {previewId}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => void copyText(previewContent, 'Plantilla .env')}
                >
                  <Copy className="size-3 mr-1" />
                  Copiar
                </Button>
              </div>
              <pre className="text-[10px] overflow-x-auto whitespace-pre-wrap font-mono text-muted-foreground">
                {previewContent}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-xs break-all' : 'text-sm'}>{value}</dd>
    </div>
  );
}
