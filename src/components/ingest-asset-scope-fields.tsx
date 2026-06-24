'use client';

import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { listAssetGroups, type AssetGroup } from '@/lib/secops-api';

export type IngestAssetScope = {
  assetGroup: string;
  assetSubgroup: string;
};

type Props = {
  value: IngestAssetScope;
  onChange: (next: IngestAssetScope) => void;
  className?: string;
  compact?: boolean;
};

export function IngestAssetScopeFields({ value, onChange, className, compact }: Props) {
  const groupId = useId();
  const subgroupId = useId();
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listAssetGroups()
      .then((rows) => {
        if (!cancelled) setGroups(rows);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const knownNames = groups.map((g) => g.nombre);
  const selectValue = value.assetGroup && knownNames.includes(value.assetGroup) ? value.assetGroup : '';

  return (
    <div
      className={className}
      title="Separa hallazgos con las mismas IPs entre proyectos o entornos distintos (p. ej. dos clusters GCP)."
    >
      {!compact ? (
        <p className="text-[11px] text-muted-foreground mb-2 leading-snug">
          Opcional: asigna <strong className="font-medium text-foreground">grupo</strong> y{' '}
          <strong className="font-medium text-foreground">subgrupo</strong> de activos para evitar
          traslapes cuando varios servicios comparten rangos IP. Si no eliges ninguno, se usa el alcance{' '}
          <span className="text-foreground">global del tenant</span>.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-xs space-y-1 min-w-[10rem] flex-1">
          <span className="text-muted-foreground">Grupo de activos</span>
          <div className="relative">
            {loading ? (
              <Loader2 className="absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
            <select
              id={groupId}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={selectValue}
              onChange={(e) => {
                const next = e.target.value;
                onChange({ ...value, assetGroup: next });
              }}
            >
              <option value="">Global (tenant)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.nombre}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="text-xs space-y-1 min-w-[10rem] flex-1">
          <span className="text-muted-foreground">Subgrupo (texto libre)</span>
          <input
            id={subgroupId}
            type="text"
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
            placeholder="p. ej. prod-k8s-gcp-west"
            value={value.assetSubgroup}
            onChange={(e) => onChange({ ...value, assetSubgroup: e.target.value })}
          />
        </label>
        {value.assetGroup && !knownNames.includes(value.assetGroup) ? (
          <label className="text-xs space-y-1 min-w-[10rem] flex-1">
            <span className="text-muted-foreground">Grupo personalizado</span>
            <input
              type="text"
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={value.assetGroup}
              onChange={(e) => onChange({ ...value, assetGroup: e.target.value })}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

export function appendAssetScopeToFormData(fd: FormData, scope: IngestAssetScope) {
  const group = scope.assetGroup.trim();
  const subgroup = scope.assetSubgroup.trim();
  if (group) fd.append('asset_group', group);
  if (subgroup) fd.append('asset_subgroup', subgroup);
}
