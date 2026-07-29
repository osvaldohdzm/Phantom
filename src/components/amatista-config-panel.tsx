/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface AmatistaConfig {
  amatistaUrl: string;
  hostIp: string;
  phantomUrl: string;
  apiKey: string;
  isConnected: boolean;
  vaultId?: string;
  lastSyncedAt?: string;
  userId?: string;
  username?: string;
}

export function AmatistaConfigPanel() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AmatistaConfig>({
    amatistaUrl: 'http://localhost:9090',
    hostIp: '127.0.0.1',
    phantomUrl: 'https://localhost:3000',
    apiKey: 'amatista-key-secret-987654',
    isConnected: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/integration/amatista-config');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setConfig({
            amatistaUrl: data.amatistaUrl || 'http://localhost:9090',
            hostIp: data.hostIp || '127.0.0.1',
            phantomUrl: data.phantomUrl || 'https://localhost:3000',
            apiKey: data.apiKey || 'amatista-key-secret-987654',
            isConnected: data.isConnected || false,
            vaultId: data.vaultId,
            lastSyncedAt: data.lastSyncedAt,
            userId: data.userId,
            username: data.username,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching Amatista config', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    setError(null);

    try {
      const payload = {
        ...config,
        userId: user?.id || 'admin-id',
        username: user?.nombre || user?.email || 'admin',
      };

      const res = await fetch('/api/integration/amatista-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.config) {
          setConfig(data.config);
        } else {
          setConfig((prev) => ({
            ...prev,
            isConnected: true,
            vaultId: data.vaultId || prev.vaultId,
            lastSyncedAt: new Date().toISOString(),
            userId: data.userId || prev.userId,
            username: data.username || prev.username,
          }));
        }
        setNotice('¡Conexión exitosa con Amatista App! Bóveda y Webhook sincronizados.');
      } else {
        setError(data.error || data.message || 'No se pudo verificar la conexión con Amatista App.');
      }
    } catch (err) {
      setError('Error de red al intentar conectar con Amatista App.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <RefreshCw className="animate-spin text-violet-500" size={24} />
      </div>
    );
  }

  return (
    <Card className="w-full bg-card border-border text-card-foreground shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-violet-500" size={24} />
            <CardTitle className="text-foreground font-bold">Integración con Amatista App</CardTitle>
          </div>
          <div>
            {config.isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                <CheckCircle size={12} />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted border border-border text-muted-foreground">
                <XCircle size={12} />
                Desconectado
              </span>
            )}
          </div>
        </div>
        <CardDescription className="text-muted-foreground mt-2">
          Permite sincronizar automáticamente los Casos de Prueba con una bóveda y workspace en Amatista App mediante API Key.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Amatista Link / URL</label>
              <Input
                type="text"
                value={config.amatistaUrl}
                onChange={(e) => setConfig({ ...config, amatistaUrl: e.target.value })}
                placeholder="http://localhost:9090"
                required
                className="bg-background border-input text-foreground focus:border-violet-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Host IP / Tailscale (Opcional)</label>
              <Input
                type="text"
                value={config.hostIp}
                onChange={(e) => setConfig({ ...config, hostIp: e.target.value })}
                placeholder="100.64.0.1"
                className="bg-background border-input text-foreground focus:border-violet-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Phantom App URL (para Webhook)</label>
              <Input
                type="text"
                value={config.phantomUrl}
                onChange={(e) => setConfig({ ...config, phantomUrl: e.target.value })}
                placeholder="http://localhost:3000"
                required
                className="bg-background border-input text-foreground focus:border-violet-500 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Amatista API Key</label>
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="amatista-key-secret-..."
                required
                className="bg-background border-input text-foreground focus:border-violet-500 font-mono text-xs"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
              <AlertTriangle className="shrink-0 mt-0.5" size={14} />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs">
              <CheckCircle className="shrink-0 mt-0.5" size={14} />
              <span>{notice}</span>
            </div>
          )}

          {config.isConnected && config.username && (
            <div className="p-3.5 bg-muted/30 border border-border/80 rounded-xl text-[11px] text-muted-foreground space-y-1 font-mono">
              <div><strong className="text-foreground">Estado de Sincronización:</strong> Activo (Bidireccional)</div>
              <div><strong className="text-foreground">ID de Bóveda en Amatista:</strong> <code className="bg-muted text-foreground px-1.5 py-0.5 rounded font-bold">{config.vaultId}</code></div>
              <div><strong className="text-foreground">Última Sincronización:</strong> {config.lastSyncedAt ? new Date(config.lastSyncedAt).toLocaleString() : 'N/A'}</div>
              <div className="text-violet-400 font-semibold mt-1">
                Integrado por: {config.username} (ID: {config.userId})
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-500 text-white font-semibold shadow-md cursor-pointer"
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
