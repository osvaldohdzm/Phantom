'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Scale } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listComplianceControls,
  listComplianceFrameworks,
  type ComplianceControlRow,
} from '@/lib/secops-api';

export function CompliancePanel() {
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [controls, setControls] = useState<ComplianceControlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFrameworks = useCallback(async () => {
    try {
      const fws = await listComplianceFrameworks();
      setFrameworks(fws);
      if (fws.length && !selected) setSelected(fws[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar frameworks');
    }
  }, [selected]);

  const loadControls = useCallback(async (fw: string) => {
    if (!fw) return;
    setLoading(true);
    try {
      setControls(await listComplianceControls({ framework: fw }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar controles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFrameworks();
  }, [loadFrameworks]);

  useEffect(() => {
    if (selected) void loadControls(selected);
  }, [selected, loadControls]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ComplianceControlRow[]>();
    for (const c of controls) {
      const cat = c.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(c);
    }
    return map;
  }, [controls]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="type-h1 flex items-center gap-2">
          <Scale className="size-7 text-violet-500" />
          Compliance
        </h1>
        <p className="type-body text-muted-foreground mt-2 max-w-2xl">
          M17 — Controles PCI-DSS, ISO 27001, NIST CSF y más. El mapeo a hallazgos se hace desde la API;
          la UI de enlaces por CWE llegará en la siguiente fase.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {frameworks.map((fw) => (
          <button
            key={fw}
            type="button"
            onClick={() => setSelected(fw)}
            className={`rounded-full px-3 py-1.5 text-xs border transition-colors ${
              selected === fw
                ? 'border-violet-500/50 bg-violet-500/10 text-violet-800 dark:text-violet-200'
                : 'border-border text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {fw}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byCategory.entries()).map(([category, rows]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{category}</CardTitle>
                <CardDescription>{rows.length} control(es)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {rows.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 space-y-1"
                  >
                    <p className="text-sm font-medium">
                      <span className="font-mono text-muted-foreground mr-2">{c.control_id}</span>
                      {c.control_name}
                    </p>
                    {c.description ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
          {controls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay controles para este framework.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
