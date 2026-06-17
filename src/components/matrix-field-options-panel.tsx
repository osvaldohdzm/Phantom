'use client';

import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_SEVERITY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
  loadMatrixSeverityOptions,
  loadMatrixStatusOptions,
  saveMatrixSeverityOptions,
  saveMatrixStatusOptions,
  type MatrixFieldOption,
} from '@/lib/matrix-field-options';

export function MatrixFieldOptionsPanel({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [severities, setSeverities] = useState<MatrixFieldOption[]>(() =>
    loadMatrixSeverityOptions()
  );
  const [statuses, setStatuses] = useState<MatrixFieldOption[]>(() => loadMatrixStatusOptions());

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 text-[11px]"
        onClick={() => {
          setSeverities(loadMatrixSeverityOptions());
          setStatuses(loadMatrixStatusOptions());
          setOpen(true);
        }}
      >
        <Settings2 className="size-3.5" />
        Opciones matriz
      </Button>
    );
  }

  const save = () => {
    saveMatrixSeverityOptions(severities);
    saveMatrixStatusOptions(statuses);
    setOpen(false);
    onSaved?.();
  };

  const reset = () => {
    setSeverities(DEFAULT_SEVERITY_OPTIONS);
    setStatuses(DEFAULT_STATUS_OPTIONS);
  };

  return (
    <div className="w-full rounded-lg border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">Opciones de severidad y estado (matriz)</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setOpen(false)}>
          Cerrar
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Una opción por línea. Se guardan en este navegador y alimentan los desplegables de la columna.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-[11px] space-y-1">
          <span className="text-muted-foreground">Severidades</span>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono"
            value={severities.map((o) => o.value).join('\n')}
            onChange={(e) =>
              setSeverities(
                e.target.value
                  .split('\n')
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .map((v) => ({ value: v, label: v }))
              )
            }
          />
        </label>
        <label className="text-[11px] space-y-1">
          <span className="text-muted-foreground">Estados</span>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-2 py-1.5 text-xs font-mono"
            value={statuses.map((o) => o.value).join('\n')}
            onChange={(e) =>
              setStatuses(
                e.target.value
                  .split('\n')
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .map((v) => ({ value: v, label: v }))
              )
            }
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-7 text-[11px]" onClick={save}>
          Guardar opciones
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={reset}>
          Restaurar predeterminadas
        </Button>
      </div>
    </div>
  );
}
