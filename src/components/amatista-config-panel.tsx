'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, RefreshCw, Shield, AlertTriangle } from 'lucide-react';

export function AmatistaConfigPanel() {
  const { user } = useAuth();
  const [config, setConfig] = useState<any>({
    isConnected: false,
    amatistaUrl: 'http://localhost:9090',
    hostIp: '',
    apiKey: '',
    phantomUrl: 'http://localhost:3000',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/integration/amatista-config');
        if (res.ok) {
          const data = await res.json();
          if (data.isConnected) {
            setConfig(data);
          }
        }
      } catch (err) {
        console.error('Error al cargar config de Amatista:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const username = user?.nombre || user?.email || 'operator';
    const userId = String(user?.id || user?.email || 'operator-id');

    try {
      const res = await fetch('/api/integration/amatista-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amatistaUrl: config.amatistaUrl,
          hostIp: config.hostIp,
          apiKey: config.apiKey,
          phantomUrl: config.phantomUrl,
          username,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al guardar configuración');
      } else {
        setConfig(data.config);
        setNotice('¡Configuración guardada y sincronizada correctamente!');
      }
    } catch (err: any) {
      setError(err.message || 'Error de red al intentar guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <RefreshCw className="animate-spin text-primary-500" size={24} />
      </div>
    );
  }

  return (
    <Card className="w-full bg-slate-900 border-slate-800 text-slate-100 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-primary-400" size={24} />
            <CardTitle>Integración con Amatista App</CardTitle>
          </div>
          <div>
            {config.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <CheckCircle size={12} />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400">
                <XCircle size={12} />
                Desconectado
              </span>
            )}
          </div>
        </div>
        <CardDescription className="text-slate-400 mt-2">
          Permite sincronizar automáticamente los Casos de Prueba con una bóveda y workspace en Amatista App mediante API Key.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Amatista Link / URL</label>
              <Input
                type="text"
                value={config.amatistaUrl}
                onChange={(e) => setConfig({ ...config, amatistaUrl: e.target.value })}
                placeholder="http://localhost:9090"
                required
                className="bg-slate-950 border-slate-800 text-slate-100 focus:border-primary-500 focus:ring-primary-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Host IP / Tailscale (Opcional)</label>
              <Input
                type="text"
                value={config.hostIp}
                onChange={(e) => setConfig({ ...config, hostIp: e.target.value })}
                placeholder="100.64.0.1"
                className="bg-slate-950 border-slate-800 text-slate-100 focus:border-primary-500 focus:ring-primary-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Phantom App URL (para Webhook)</label>
              <Input
                type="text"
                value={config.phantomUrl}
                onChange={(e) => setConfig({ ...config, phantomUrl: e.target.value })}
                placeholder="http://localhost:3000"
                required
                className="bg-slate-950 border-slate-800 text-slate-100 focus:border-primary-500 focus:ring-primary-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Amatista API Key</label>
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="amatista-key-secret-..."
                required
                className="bg-slate-950 border-slate-800 text-slate-100 focus:border-primary-500 focus:ring-primary-500/20"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-950/40 border border-red-900/50 text-red-400 text-xs">
              <AlertTriangle className="shrink-0 mt-0.5" size={14} />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-xs">
              <CheckCircle className="shrink-0 mt-0.5" size={14} />
              <span>{notice}</span>
            </div>
          )}

          {config.isConnected && config.username && (
            <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-md text-[11px] text-slate-400 space-y-1">
              <div><strong className="text-slate-300">Estado de Sincronización:</strong> Activo (Bidireccional)</div>
              <div><strong className="text-slate-300">ID de Bóveda en Amatista:</strong> <code className="bg-slate-900 px-1 py-0.5 rounded">{config.vaultId}</code></div>
              <div><strong className="text-slate-300">Última Sincronización:</strong> {config.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString() : 'N/A'}</div>
              <div className="text-primary-300 font-semibold mt-1">
                Integrado por: {config.username} (ID: {config.userId})
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary-600 hover:bg-primary-500 text-white font-medium"
            >
              {saving ? (
                <>
                  <RefreshCw className="animate-spin mr-2" size={14} />
                  Conectando y Sincronizando...
                </>
              ) : (
                'Probar y Guardar Configuración'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
