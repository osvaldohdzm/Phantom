import { getApiBaseUrl } from '@/lib/api-base';
import type { PentestNode, NodeConnection, SuggestionRule } from '@/components/phantom/types';

const base = () => getApiBaseUrl();

export interface PhantomWorkspaceDto {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  engagement_id?: string | null;
  asset_id?: string | null;
  global_vars: Record<string, string>;
  nodes: PentestNode[];
  connections: NodeConnection[];
  custom_rules?: SuggestionRule[] | null;
  created_at: string;
  updated_at: string;
}

export async function listWorkspaces(engagementId?: string): Promise<PhantomWorkspaceDto[]> {
  const q = engagementId ? `?engagement_id=${engagementId}` : '';
  const res = await fetch(`${base()}/api/v1/workspaces${q}`);
  if (!res.ok) throw new Error('No se pudo cargar workspaces');
  return res.json();
}

export async function saveWorkspace(data: {
  name: string;
  description?: string;
  category?: string;
  engagement_id?: string;
  asset_id?: string;
  global_vars: Record<string, string>;
  nodes: PentestNode[];
  connections: NodeConnection[];
  custom_rules?: SuggestionRule[];
}): Promise<PhantomWorkspaceDto> {
  const res = await fetch(`${base()}/api/v1/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error al guardar workspace');
  }
  return res.json();
}

export async function updateWorkspace(
  id: string,
  data: Partial<{
    name: string;
    global_vars: Record<string, string>;
    nodes: PentestNode[];
    connections: NodeConnection[];
    custom_rules: SuggestionRule[];
  }>
): Promise<PhantomWorkspaceDto> {
  const res = await fetch(`${base()}/api/v1/workspaces/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar workspace');
  return res.json();
}

export async function logExecution(data: {
  engagement_id: string;
  asset_id?: string;
  node_id?: string;
  command: string;
  raw_output: string;
  executed_by?: string;
}): Promise<void> {
  await fetch(`${base()}/api/v1/execution/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function promoteNodeToFinding(data: {
  titulo: string;
  descripcion?: string;
  severidad?: string;
  engagement_id?: string;
  asset_id?: string;
  raw_tool_output?: string;
  explicacion_tecnica?: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${base()}/api/v1/findings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear hallazgo');
  return res.json();
}
